/**
 * Pending-login ticket: the short-lived, signed, httpOnly cookie (`tp_mfa`)
 * that carries an operator from step 1 (password, phone or, later, Google)
 * to step 2 (the 6-digit code). Modelled on the NutriGreenz console's
 * `createMfaTicket` / `verifyMfaTicket`, adapted:
 *
 *  - HMAC-SHA256 over the body, with a domain-separation prefix
 *    (`fyt.mfa.v1.`) so a ticket can never verify as a session token
 *    (src/lib/session.ts signs the bare body) and a session token can never
 *    verify as a ticket, even though both use the same server secret;
 *  - expiry lives inside the signed payload and is capped at 10 minutes;
 *    re-signing keeps the original `iat`/`exp`, so it never extends;
 *  - `sid` is a 128-bit random nonce. It keys the server-side challenge
 *    (code hash, attempts, resends) and salts the code hash;
 *  - the admin id is deliberately NOT in the cookie. The phone path must not
 *    reveal whether a number matched an operator, and a readable admin id in
 *    the operator's own cookie would do exactly that. Server side the id sits
 *    next to the code hash; in the cookie there is only `st.u`, an HMAC of
 *    (sid, admin id) that the server matches against the admin records. A
 *    decoy gets random bytes of the same length.
 *
 * DEMO MODE ONLY: `st` also carries the challenge itself (code hash, expiry,
 * attempts, resends, last send, and the demo code shown on screen). Vercel
 * can serve step 1 and step 2 from different serverless instances whose
 * memory isn't shared, and the demo has no database. The cookie is re-signed
 * after every attempt and resend. KNOWN LIMITATION: a replayed older cookie
 * can reset the attempt counter on an instance that hasn't seen the newer
 * state. That is acceptable only because demo mode shows the code on screen
 * anyway (there is no secret to brute-force). Production must not carry
 * state: it uses a Firestore `ChallengeStore` with atomic counters (see
 * ./otp.ts and ./mfa.ts).
 *
 * PURE apart from `node:crypto`: the secret and clock are passed in, so Node's
 * test runner can load this file directly (see ticket.test.ts).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const MFA_COOKIE = "tp_mfa";
export const MFA_TICKET_TTL_MS = 10 * 60 * 1000;
/** Tolerated clock skew for `iat` in the future. */
const SKEW_MS = 60 * 1000;
const MAX_TOKEN_LENGTH = 1536;
const DOMAIN = "fyt.mfa.v1.";

export type SignInMethod = "password" | "phone" | "google";
export type CodeChannel = "email" | "sms";

const METHODS: readonly SignInMethod[] = ["password", "phone", "google"];
const CHANNELS: readonly CodeChannel[] = ["email", "sms"];

/** Challenge state carried in the cookie (demo mode only). */
export interface CarriedState {
  /** hex HMAC-SHA256 of the current code. */
  h: string;
  /** Code expiry. */
  x: number;
  /** Last send. */
  s: number;
  /** Wrong attempts so far. */
  a: number;
  /** Resends so far. */
  r: number;
  /** HMAC-bound admin reference (or a decoy). */
  u: string;
  /** The code, for the "Demo mode — no message was sent" panel. Demo only. */
  c?: string;
}

export interface MfaTicket {
  typ: "mfa";
  v: 1;
  /** Random nonce (base64url, 128 bits). Keys the server-side challenge. */
  sid: string;
  method: SignInMethod;
  ch: CodeChannel;
  /** Masked destination for display, e.g. `ow•••@demo.local`. */
  dst: string;
  iat: number;
  exp: number;
  st?: CarriedState;
}

export function newTicketNonce(): string {
  return randomBytes(16).toString("base64url");
}

function mac(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(DOMAIN + body).digest();
}

function encode(ticket: MfaTicket, secret: string): string {
  const body = Buffer.from(JSON.stringify(ticket), "utf8").toString("base64url");
  return `${body}.${mac(body, secret).toString("base64url")}`;
}

export function signMfaTicket(
  input: { sid: string; method: SignInMethod; ch: CodeChannel; dst: string; st?: CarriedState },
  secret: string,
  now: number,
  ttlMs = MFA_TICKET_TTL_MS,
): { token: string; ticket: MfaTicket } {
  const ticket: MfaTicket = {
    typ: "mfa",
    v: 1,
    sid: input.sid,
    method: input.method,
    ch: input.ch,
    dst: input.dst,
    iat: now,
    exp: now + Math.min(ttlMs, MFA_TICKET_TTL_MS),
  };
  if (input.st) ticket.st = input.st;
  return { token: encode(ticket, secret), ticket };
}

/** Same ticket (same sid, iat, exp) with new carried state. */
export function resignMfaTicket(ticket: MfaTicket, st: CarriedState | undefined, secret: string): { token: string; ticket: MfaTicket } {
  const next: MfaTicket = { typ: "mfa", v: 1, sid: ticket.sid, method: ticket.method, ch: ticket.ch, dst: ticket.dst, iat: ticket.iat, exp: ticket.exp };
  if (st) next.st = st;
  return { token: encode(next, secret), ticket: next };
}

const isInt = (n: unknown, min: number, max: number) => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
const isTime = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;

function validCarried(st: unknown): st is CarriedState {
  if (!st || typeof st !== "object") return false;
  const s = st as Record<string, unknown>;
  const keys = Object.keys(s);
  if (keys.some((k) => !["h", "x", "s", "a", "r", "u", "c"].includes(k))) return false;
  if (typeof s.h !== "string" || !/^[0-9a-f]{64}$/.test(s.h)) return false;
  if (!isTime(s.x) || !isTime(s.s)) return false;
  if (!isInt(s.a, 0, 50) || !isInt(s.r, 0, 50)) return false;
  if (typeof s.u !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(s.u)) return false;
  if (s.c !== undefined && (typeof s.c !== "string" || !/^\d{6}$/.test(s.c))) return false;
  return true;
}

/**
 * Returns the ticket if the signature is valid, the shape is exact and it has
 * not expired; otherwise null. Never throws.
 */
export function verifyMfaTicket(token: string | undefined | null, secret: string, now: number): MfaTicket | null {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
  const dot = token.indexOf(".");
  if (dot < 1 || dot !== token.lastIndexOf(".") || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(sigPart)) return null;

  const given = Buffer.from(sigPart, "base64url");
  const want = mac(body, secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  let t: Partial<MfaTicket>;
  try {
    t = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<MfaTicket>;
  } catch {
    return null;
  }
  if (!t || typeof t !== "object") return null;
  if (t.typ !== "mfa" || t.v !== 1) return null;
  if (typeof t.sid !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(t.sid)) return null;
  if (!METHODS.includes(t.method as SignInMethod) || !CHANNELS.includes(t.ch as CodeChannel)) return null;
  if (typeof t.dst !== "string" || t.dst.length > 128) return null;
  if (!isTime(t.iat) || !isTime(t.exp)) return null;
  if ((t.exp as number) - (t.iat as number) > MFA_TICKET_TTL_MS || (t.iat as number) > now + SKEW_MS || now > (t.exp as number)) return null;
  if (t.st !== undefined && !validCarried(t.st)) return null;
  return t as MfaTicket;
}

export function mfaCookieOptions(ticket: Pick<MfaTicket, "exp">, now: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    // Only the sign-in routes ever need it (/login, /login/verify and their
    // server actions, which post back to the same paths).
    path: "/login",
    maxAge: Math.max(1, Math.floor((ticket.exp - now) / 1000)),
  };
}

// ---------------------------------------------------------------------------
// Admin reference: binds (sid, admin id) without revealing either
// ---------------------------------------------------------------------------

export function adminRef(secret: string, sid: string, adminId: string): string {
  return createHmac("sha256", secret).update(`fyt.mfa.sub.v1|${sid}|${adminId}`).digest().subarray(0, 16).toString("base64url");
}

/** Same length and alphabet as a real reference; matches no admin. */
export function decoyAdminRef(): string {
  return randomBytes(16).toString("base64url");
}

/** Which of `adminIds` (if any) the reference was made for. Timing-safe per comparison. */
export function resolveAdminRef(secret: string, sid: string, ref: string, adminIds: readonly string[]): string | null {
  const given = Buffer.from(ref, "base64url");
  let found: string | null = null;
  for (const id of adminIds) {
    const want = Buffer.from(adminRef(secret, sid, id), "base64url");
    if (given.length === want.length && timingSafeEqual(given, want) && found === null) found = id;
  }
  return found;
}
