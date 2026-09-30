import "server-only";
import { cookies } from "next/headers";
import { DATA_SOURCE, db } from "@/lib/data/store";
import type { Admin } from "@/lib/data/types";
import { authSecret } from "@/lib/session";
import { codeDelivery, DeliveryNotConfiguredError } from "./delivery";
import { maskEmail, maskPhone, normalizeIndianPhone } from "./identifiers";
import {
  IssueThrottle,
  MemoryChallengeStore,
  currentChallenge,
  discardChallenge,
  fromCarried,
  issueChallenge,
  resendChallenge,
  toCarried,
  verifyChallenge,
  viewOf,
  type ChallengeView,
  type OtpChallenge,
  type OtpDeps,
  type ResendResult,
  type VerifyResult,
} from "./otp";
import {
  MFA_COOKIE,
  MFA_TICKET_TTL_MS,
  adminRef,
  decoyAdminRef,
  mfaCookieOptions,
  newTicketNonce,
  resignMfaTicket,
  resolveAdminRef,
  signMfaTicket,
  verifyMfaTicket,
  type CodeChannel,
  type MfaTicket,
  type SignInMethod,
} from "./ticket";

/**
 * Server wiring for two-step sign-in: the pending-login cookie, the challenge
 * store, the send throttle and code delivery. Pure logic lives in ./otp and
 * ./ticket; this file connects it to cookies, the admin records and the clock.
 *
 * Where challenge state lives:
 *  - Always: `MemoryChallengeStore` next to the demo store (same `globalThis`
 *    pattern). That is per server instance.
 *  - Demo mode (`CARRY_STATE`): also inside the signed `tp_mfa` cookie,
 *    re-signed after every attempt and resend, because Vercel can run step 1
 *    and step 2 on different instances. When this instance has its own copy
 *    the two are merged (attempts never go down). KNOWN LIMITATION, accepted
 *    for demo only because the code is shown on screen anyway: replaying an
 *    older cookie against an instance that never saw the newer state resets
 *    the attempt counter.
 *  - Production: no carried state. Replace `MemoryChallengeStore` with a
 *    Firestore `ChallengeStore` (collection `signInChallenges/{nonce}`,
 *    `mutate` via runTransaction so counters are atomic, TTL policy on
 *    `deadline`) and move `IssueThrottle` there too, before real delivery is
 *    switched on.
 */
const CARRY_STATE = DATA_SOURCE === "demo";

const g = globalThis as unknown as { __tpOtpStore?: MemoryChallengeStore; __tpOtpThrottle?: IssueThrottle };

function otpDeps(): OtpDeps {
  return { store: (g.__tpOtpStore ??= new MemoryChallengeStore()), secret: authSecret(), now: () => Date.now() };
}

/**
 * 5 codes per destination per hour. The demo accounts are shared by everyone
 * trying the console and demo mode shows the code on screen (nothing to
 * guess), so demo mode allows 30 an hour instead: still bounded, not a wall.
 */
function throttle(): IssueThrottle {
  return (g.__tpOtpThrottle ??= new IssueThrottle(CARRY_STATE ? 30 : 5));
}

/** The cookie's copy of the challenge (demo mode), with the admin resolved server side. */
function carriedChallenge(ticket: MfaTicket): OtpChallenge | undefined {
  if (!CARRY_STATE || !ticket.st) return undefined;
  const ids = db()
    .admins.filter((a) => a.status === "active")
    .map((a) => a.id);
  const adminId = resolveAdminRef(authSecret(), ticket.sid, ticket.st.u, ids);
  return fromCarried(ticket.st, { nonce: ticket.sid, channel: ticket.ch, createdAt: ticket.iat, deadline: ticket.exp, adminId });
}

function clearCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/login", maxAge: 0 };
}

/** Writes the challenge's new state back into the cookie (demo), or clears it when gone. */
async function persistTicket(ticket: MfaTicket, state: OtpChallenge | null | undefined, demoCode?: string | null) {
  if (state === undefined) return;
  const jar = await cookies();
  if (state === null) {
    jar.set(MFA_COOKIE, "", clearCookieOptions());
    return;
  }
  if (!CARRY_STATE || !ticket.st) return;
  const code = demoCode === undefined ? ticket.st.c : demoCode;
  const { token, ticket: next } = resignMfaTicket(ticket, toCarried(state, ticket.st.u, code), authSecret());
  jar.set(MFA_COOKIE, token, mfaCookieOptions(next, Date.now()));
}

export type StartResult =
  | { ok: true }
  | { ok: false; reason: "throttled"; retryAt: number }
  | { ok: false; reason: "unavailable"; message: string };

/**
 * Step 1 succeeded (or, for phone, was answered): create the challenge, send
 * the code when there is an operator behind it, and set the ticket cookie.
 * `adminId: null` makes a decoy that behaves identically but can never pass.
 */
export async function startSignInChallenge(input: {
  adminId: string | null;
  method: SignInMethod;
  channel: CodeChannel;
  destination: string;
}): Promise<StartResult> {
  const delivery = codeDelivery();
  if (!delivery.ready(input.channel)) {
    return { ok: false, reason: "unavailable", message: new DeliveryNotConfiguredError(input.channel).message };
  }
  const now = Date.now();
  const gate = throttle().take(`${input.channel}:${input.destination}`, now);
  if (!gate.ok) return { ok: false, reason: "throttled", retryAt: gate.retryAt };

  const secret = authSecret();
  const sid = newTicketNonce();
  const deadline = now + MFA_TICKET_TTL_MS;
  const deps = otpDeps();
  const { code, challenge } = await issueChallenge(deps, {
    nonce: sid,
    adminId: input.adminId,
    channel: input.channel,
    destination: input.destination,
    deadline,
  });
  if (code) {
    try {
      await delivery.sendCode({ channel: input.channel, to: input.destination, code });
    } catch (e) {
      await discardChallenge(deps, sid);
      // Never include the code or the provider payload in what we surface.
      console.error("[auth] sign-in code delivery failed:", e instanceof Error ? e.name : "unknown error");
      return { ok: false, reason: "unavailable", message: "We couldn't send a code right now. Try again in a minute." };
    }
  }

  const dst = input.channel === "email" ? maskEmail(input.destination) : maskPhone(input.destination);
  const ref = input.adminId ? adminRef(secret, sid, input.adminId) : decoyAdminRef();
  const st = CARRY_STATE ? toCarried(challenge, ref, delivery.mode === "demo" ? code : null) : undefined;
  const { token, ticket } = signMfaTicket({ sid, method: input.method, ch: input.channel, dst, st }, secret, now);
  (await cookies()).set(MFA_COOKIE, token, mfaCookieOptions(ticket, now));
  return { ok: true };
}

export async function readTicket(): Promise<MfaTicket | null> {
  const token = (await cookies()).get(MFA_COOKIE)?.value;
  return verifyMfaTicket(token, authSecret(), Date.now());
}

/** Server actions only (cookies can't be written during render). */
export async function clearTicket(ticket?: MfaTicket | null) {
  if (ticket) await discardChallenge(otpDeps(), ticket.sid);
  (await cookies()).set(MFA_COOKIE, "", clearCookieOptions());
}

export interface VerifyScreenState {
  view: ChallengeView | null;
  /** Demo mode only: the code "sent" (nothing was). */
  demoCode: string | null;
  now: number;
}

export async function verifyScreenState(ticket: MfaTicket): Promise<VerifyScreenState> {
  const deps = otpDeps();
  const c = await currentChallenge(deps, ticket.sid, carriedChallenge(ticket));
  return {
    view: c ? viewOf(c) : null,
    demoCode: c && CARRY_STATE && c.adminId ? (ticket.st?.c ?? null) : null,
    now: deps.now(),
  };
}

export async function checkCode(ticket: MfaTicket, code: unknown): Promise<VerifyResult> {
  const { result, state } = await verifyChallenge(otpDeps(), ticket.sid, code, carriedChallenge(ticket));
  await persistTicket(ticket, state);
  return result;
}

export type ResendOutcome = ResendResult | { ok: false; reason: "unavailable"; message: string };

export async function resendCode(ticket: MfaTicket): Promise<ResendOutcome> {
  const delivery = codeDelivery();
  if (!delivery.ready(ticket.ch)) return { ok: false, reason: "unavailable", message: new DeliveryNotConfiguredError(ticket.ch).message };
  const { result, state } = await resendChallenge(otpDeps(), ticket.sid, carriedChallenge(ticket));
  if (result.ok && result.code) {
    try {
      await delivery.sendCode({ channel: result.channel, to: result.destination, code: result.code });
    } catch (e) {
      console.error("[auth] sign-in code delivery failed:", e instanceof Error ? e.name : "unknown error");
      return { ok: false, reason: "unavailable", message: "We couldn't send a code right now. Try again in a minute." };
    }
  }
  await persistTicket(ticket, state, result.ok ? (delivery.mode === "demo" ? result.code : null) : undefined);
  return result;
}

/** Active operator whose phone normalises to the same E.164 number. */
export function findActiveAdminByPhone(e164: string): Admin | undefined {
  return db().admins.find((a) => a.status === "active" && !!a.phone && normalizeIndianPhone(a.phone) === e164);
}
