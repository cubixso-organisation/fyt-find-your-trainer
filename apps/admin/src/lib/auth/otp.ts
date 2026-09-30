/**
 * One-time sign-in codes (step 2 of operator sign-in).
 *
 *  - Codes are 6 digits from `crypto.randomInt` (uniform, CSPRNG).
 *  - Only a keyed hash is stored: HMAC-SHA256(server secret, nonce | code),
 *    where the nonce is the pending-login ticket's `sid`. Comparison is
 *    timing-safe.
 *  - A code lives 5 minutes. The whole challenge never outlives its ticket.
 *  - 5 wrong codes per ticket, counted across resends. The 5th deletes the
 *    challenge: the operator has to start step 1 again.
 *  - Resend: 30 s cooldown, at most 3 per ticket. Each resend replaces the
 *    hash, so the previous code stops working immediately.
 *  - Decoys: when a phone number matches no operator, a challenge is still
 *    created with a random hash no code can match. The screens, counters and
 *    cookies behave identically, so the flow never confirms whether a number
 *    belongs to an operator.
 *
 * Where the state lives:
 *  - `ChallengeStore` (server side). `mutate` must be atomic per nonce: the
 *    in-memory store runs the callback synchronously; a Firestore store must
 *    use `runTransaction`, so two parallel guesses can't spend one attempt.
 *  - In demo mode ALSO a copy carried in the signed ticket cookie
 *    (`CarriedState`, see ./ticket.ts), because Vercel may serve step 1 and
 *    step 2 from different serverless instances whose memory isn't shared.
 *    `mergeChallenges` combines the two, keeping the higher attempt count.
 *
 * PURE apart from `node:crypto`: secret, clock and store are injected, so
 * Node's test runner can load this file directly (see otp.test.ts).
 */
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { CarriedState } from "./ticket";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
export const OTP_MAX_RESENDS = 3;

export type Channel = "email" | "sms";

export interface OtpChallenge {
  /** Ticket nonce (`sid`). */
  nonce: string;
  /** Admin the code signs in, or null for a decoy (unknown phone number). */
  adminId: string | null;
  channel: Channel;
  /** Full destination (email or E.164). Server side only; "" when rebuilt from a cookie. */
  destination: string;
  /** hex HMAC-SHA256 of the current code. */
  codeHash: string;
  createdAt: number;
  sentAt: number;
  expiresAt: number;
  /** The ticket's expiry. Nothing about this challenge survives it. */
  deadline: number;
  /** Wrong codes so far (across resends). */
  attempts: number;
  resends: number;
}

export interface ChallengeStore {
  get(nonce: string): Promise<OtpChallenge | undefined>;
  put(challenge: OtpChallenge): Promise<void>;
  delete(nonce: string): Promise<void>;
  /**
   * Atomically read-modify-write one challenge. `fn` receives a copy (or
   * undefined) and returns the next value (null deletes, undefined keeps the
   * current value) plus a result.
   */
  mutate<T>(
    nonce: string,
    fn: (current: OtpChallenge | undefined) => { next: OtpChallenge | null | undefined; result: T },
  ): Promise<T>;
}

/** In-memory store (per server instance). */
export class MemoryChallengeStore implements ChallengeStore {
  private map = new Map<string, OtpChallenge>();
  private readonly maxEntries: number;
  // No TS parameter properties: Node's type stripping can't run them.
  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;
  }

  async get(nonce: string) {
    const c = this.map.get(nonce);
    return c ? { ...c } : undefined;
  }

  async put(challenge: OtpChallenge) {
    this.sweep(challenge.createdAt);
    this.map.set(challenge.nonce, { ...challenge });
  }

  async delete(nonce: string) {
    this.map.delete(nonce);
  }

  async mutate<T>(
    nonce: string,
    fn: (current: OtpChallenge | undefined) => { next: OtpChallenge | null | undefined; result: T },
  ) {
    const cur = this.map.get(nonce);
    const { next, result } = fn(cur ? { ...cur } : undefined);
    if (next) {
      if (!cur) this.sweep(next.createdAt);
      this.map.set(nonce, { ...next });
    } else if (next === null) this.map.delete(nonce);
    return result;
  }

  get size() {
    return this.map.size;
  }

  /** Drops dead challenges, then the oldest ones if still over the cap. */
  private sweep(now: number) {
    if (this.map.size < this.maxEntries / 2) return;
    for (const [k, c] of this.map) if (c.deadline <= now) this.map.delete(k);
    while (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
}

export interface OtpDeps {
  store: ChallengeStore;
  secret: string;
  now: () => number;
  /** Injectable for tests; defaults to a CSPRNG 6-digit code. */
  generateCode?: () => string;
}

export function generateCode(): string {
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

export function hashCode(code: string, nonce: string, secret: string): string {
  return createHmac("sha256", secret).update(`fyt.otp.v1|${nonce}|${code}`).digest("hex");
}

function codeMatches(code: string, c: OtpChallenge, secret: string): boolean {
  const got = Buffer.from(hashCode(code, c.nonce, secret), "hex");
  const want = Buffer.from(c.codeHash, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

const decoyHash = () => randomBytes(32).toString("hex");

export const isWellFormedCode = (code: unknown): code is string =>
  typeof code === "string" && new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);

/** What the verify screen may know about a challenge. Never the code or hash. */
export interface ChallengeView {
  channel: Channel;
  attemptsLeft: number;
  expiresAt: number;
  sentAt: number;
  resendsLeft: number;
  /** Earliest time a resend is accepted. */
  resendAt: number;
  deadline: number;
}

export function viewOf(c: OtpChallenge): ChallengeView {
  return {
    channel: c.channel,
    attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - c.attempts),
    expiresAt: c.expiresAt,
    sentAt: c.sentAt,
    resendsLeft: Math.max(0, OTP_MAX_RESENDS - c.resends),
    resendAt: c.sentAt + OTP_RESEND_COOLDOWN_MS,
    deadline: c.deadline,
  };
}

// ---------------------------------------------------------------------------
// Cookie-carried state (demo mode) and merging
// ---------------------------------------------------------------------------

/** Compact copy for the ticket cookie. `ref` is the HMAC-bound admin reference. */
export function toCarried(c: OtpChallenge, ref: string, demoCode?: string | null): CarriedState {
  const st: CarriedState = { h: c.codeHash, x: c.expiresAt, s: c.sentAt, a: c.attempts, r: c.resends, u: ref };
  if (demoCode) st.c = demoCode;
  return st;
}

/** Rebuilds a challenge from the cookie. `adminId` comes from resolving `st.u` server side. */
export function fromCarried(
  st: CarriedState,
  meta: { nonce: string; channel: Channel; createdAt: number; deadline: number; adminId: string | null },
): OtpChallenge {
  return {
    nonce: meta.nonce,
    adminId: meta.adminId,
    channel: meta.channel,
    destination: "",
    codeHash: st.h,
    createdAt: meta.createdAt,
    sentAt: st.s,
    expiresAt: Math.min(st.x, meta.deadline),
    deadline: meta.deadline,
    attempts: st.a,
    resends: st.r,
  };
}

/**
 * Combines this instance's copy with the cookie's. The one with more resends
 * holds the current code; attempts and resends never go down, so a replayed
 * older cookie can't reset the counter on an instance that has seen more.
 */
export function mergeChallenges(local?: OtpChallenge, carried?: OtpChallenge): OtpChallenge | undefined {
  if (!local) return carried;
  if (!carried) return local;
  const newer = carried.resends > local.resends ? carried : local;
  return {
    ...newer,
    adminId: local.adminId ?? carried.adminId,
    destination: local.destination || carried.destination,
    attempts: Math.max(local.attempts, carried.attempts),
    resends: Math.max(local.resends, carried.resends),
  };
}

// ---------------------------------------------------------------------------
// Transitions (pure) and store-backed operations
// ---------------------------------------------------------------------------

export function newChallenge(
  deps: Pick<OtpDeps, "secret" | "now" | "generateCode">,
  input: { nonce: string; adminId: string | null; channel: Channel; destination: string; deadline: number },
): { challenge: OtpChallenge; code: string | null } {
  const now = deps.now();
  const code = input.adminId ? (deps.generateCode ?? generateCode)() : null;
  return {
    code,
    challenge: {
      nonce: input.nonce,
      adminId: input.adminId,
      channel: input.channel,
      destination: input.destination,
      codeHash: code ? hashCode(code, input.nonce, deps.secret) : decoyHash(),
      createdAt: now,
      sentAt: now,
      expiresAt: Math.min(now + OTP_TTL_MS, input.deadline),
      deadline: input.deadline,
      attempts: 0,
      resends: 0,
    },
  };
}

/**
 * Starts a challenge for a ticket. Returns the plaintext code for delivery
 * (null for a decoy); only its hash is stored.
 */
export async function issueChallenge(
  deps: OtpDeps,
  input: { nonce: string; adminId: string | null; channel: Channel; destination: string; deadline: number },
): Promise<{ code: string | null; challenge: OtpChallenge; view: ChallengeView }> {
  const { challenge, code } = newChallenge(deps, input);
  await deps.store.put(challenge);
  return { code, challenge, view: viewOf(challenge) };
}

export type VerifyResult =
  | { ok: true; adminId: string; channel: Channel }
  /** Not 6 digits. No attempt is spent. */
  | { ok: false; reason: "malformed" }
  /** No live challenge: finished, locked out, or the ticket ran out. */
  | { ok: false; reason: "missing" }
  /** The code's 5 minutes are up. No attempt is spent; a resend may help. */
  | { ok: false; reason: "expired"; view: ChallengeView }
  | { ok: false; reason: "wrong"; attemptsLeft: number; view: ChallengeView }
  /** That was the last allowed wrong code. The challenge is gone. */
  | { ok: false; reason: "locked"; adminId: string | null };

/** `state`: the challenge after the step; null = gone; undefined = untouched. */
export interface Outcome<R> {
  result: R;
  state: OtpChallenge | null | undefined;
}

export function applyVerify(c: OtpChallenge | undefined, code: string, now: number, secret: string): Outcome<VerifyResult> {
  if (!c) return { state: null, result: { ok: false, reason: "missing" } };
  if (now > c.deadline) return { state: null, result: { ok: false, reason: "missing" } };
  if (c.attempts >= OTP_MAX_ATTEMPTS) return { state: null, result: { ok: false, reason: "locked", adminId: c.adminId } };
  if (now > c.expiresAt) return { state: c, result: { ok: false, reason: "expired", view: viewOf(c) } };
  // Hash and compare even for decoys, so both paths do the same work.
  const matches = codeMatches(code, c, secret);
  if (matches && c.adminId) {
    // Single use: the challenge is consumed on success.
    return { state: null, result: { ok: true, adminId: c.adminId, channel: c.channel } };
  }
  const attempts = c.attempts + 1;
  if (attempts >= OTP_MAX_ATTEMPTS) return { state: null, result: { ok: false, reason: "locked", adminId: c.adminId } };
  const next = { ...c, attempts };
  return { state: next, result: { ok: false, reason: "wrong", attemptsLeft: OTP_MAX_ATTEMPTS - attempts, view: viewOf(next) } };
}

export type ResendResult =
  | { ok: true; code: string | null; view: ChallengeView; destination: string; channel: Channel }
  | { ok: false; reason: "missing" }
  | { ok: false; reason: "cooldown"; retryAt: number; view: ChallengeView }
  | { ok: false; reason: "limit"; view: ChallengeView };

export function applyResend(
  c: OtpChallenge | undefined,
  now: number,
  deps: Pick<OtpDeps, "secret" | "generateCode">,
): Outcome<ResendResult> {
  if (!c || now > c.deadline || c.attempts >= OTP_MAX_ATTEMPTS) return { state: null, result: { ok: false, reason: "missing" } };
  if (c.resends >= OTP_MAX_RESENDS) return { state: c, result: { ok: false, reason: "limit", view: viewOf(c) } };
  if (now < c.sentAt + OTP_RESEND_COOLDOWN_MS) {
    return { state: c, result: { ok: false, reason: "cooldown", retryAt: c.sentAt + OTP_RESEND_COOLDOWN_MS, view: viewOf(c) } };
  }
  const code = c.adminId ? (deps.generateCode ?? generateCode)() : null;
  const next: OtpChallenge = {
    ...c,
    codeHash: code ? hashCode(code, c.nonce, deps.secret) : decoyHash(),
    sentAt: now,
    expiresAt: Math.min(now + OTP_TTL_MS, c.deadline),
    resends: c.resends + 1,
  };
  return { state: next, result: { ok: true, code, view: viewOf(next), destination: c.destination, channel: c.channel } };
}

/**
 * Checks a code against the store's copy merged with an optional cookie
 * copy, atomically per nonce. The merged result is written back to the
 * store (so an instance that only had the cookie adopts it).
 */
export async function verifyChallenge(
  deps: OtpDeps,
  nonce: string,
  code: unknown,
  carried?: OtpChallenge,
): Promise<Outcome<VerifyResult>> {
  if (!isWellFormedCode(code)) return { state: undefined, result: { ok: false, reason: "malformed" } };
  const now = deps.now();
  return deps.store.mutate(nonce, (cur) => {
    const out = applyVerify(mergeChallenges(cur, carried), code, now, deps.secret);
    return { next: out.state, result: out };
  });
}

export async function resendChallenge(deps: OtpDeps, nonce: string, carried?: OtpChallenge): Promise<Outcome<ResendResult>> {
  const now = deps.now();
  return deps.store.mutate(nonce, (cur) => {
    const out = applyResend(mergeChallenges(cur, carried), now, deps);
    return { next: out.state, result: out };
  });
}

export async function currentChallenge(deps: OtpDeps, nonce: string, carried?: OtpChallenge): Promise<OtpChallenge | null> {
  const c = mergeChallenges(await deps.store.get(nonce), carried);
  if (!c || deps.now() > c.deadline || c.attempts >= OTP_MAX_ATTEMPTS) return null;
  return c;
}

export async function describeChallenge(deps: OtpDeps, nonce: string, carried?: OtpChallenge): Promise<ChallengeView | null> {
  const c = await currentChallenge(deps, nonce, carried);
  return c ? viewOf(c) : null;
}

export async function discardChallenge(deps: OtpDeps, nonce: string): Promise<void> {
  await deps.store.delete(nonce);
}

/**
 * Sliding-window limit on how many codes a destination can be sent per hour
 * (5 tickets). Keyed by the destination whether or not it matches an
 * operator, so hitting the limit reveals nothing either.
 */
export class IssueThrottle {
  private hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;
  constructor(limit = 5, windowMs = 60 * 60 * 1000, maxKeys = 10000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
  }

  /** Records a hit if allowed. */
  take(key: string, now: number): { ok: true } | { ok: false; retryAt: number } {
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { ok: false, retryAt: recent[0] + this.windowMs };
    }
    recent.push(now);
    this.hits.delete(key);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest !== undefined) this.hits.delete(oldest);
    }
    return { ok: true };
  }
}
