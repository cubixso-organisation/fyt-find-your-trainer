/**
 * Sign-in codes: single use, attempt limit, expiry, resend rules, decoys,
 * the send throttle, and the demo-mode path where the challenge travels in
 * the signed cookie between serverless instances.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

type Otp = typeof import("./otp");
type Ticket = typeof import("./ticket");
const otp: Otp = await import(new URL("./otp.ts", import.meta.url).href);
const tk: Ticket = await import(new URL("./ticket.ts", import.meta.url).href);
const {
  MemoryChallengeStore,
  IssueThrottle,
  issueChallenge,
  verifyChallenge,
  resendChallenge,
  describeChallenge,
  toCarried,
  fromCarried,
  mergeChallenges,
  hashCode,
  generateCode,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_MAX_RESENDS,
} = otp;

const SECRET = "test-secret-0123456789-abcdefghijklmnop";
const T0 = 1_790_000_000_000;
const DEADLINE = T0 + 10 * 60 * 1000;

function setup(codes: string[] = ["111111", "222222", "333333", "444444"]) {
  let now = T0;
  const queue = [...codes];
  const deps = {
    store: new MemoryChallengeStore(),
    secret: SECRET,
    now: () => now,
    generateCode: () => queue.shift() ?? "999999",
  };
  return { deps, tick: (ms: number) => (now += ms), at: () => now };
}

const NONCE = "n".repeat(22);
const start = (deps: Parameters<Otp["issueChallenge"]>[0], adminId: string | null = "adm_ops") =>
  issueChallenge(deps, { nonce: NONCE, adminId, channel: "email", destination: "admin@demo.local", deadline: DEADLINE });

describe("codes", () => {
  it("are 6 digits and stored only as a keyed hash", async () => {
    for (let i = 0; i < 200; i++) assert.match(generateCode(), /^\d{6}$/);
    const { deps } = setup();
    const { code } = await start(deps);
    const stored = await deps.store.get(NONCE);
    assert.equal(code, "111111");
    assert.ok(stored);
    assert.ok(!JSON.stringify(stored).includes("111111"));
    assert.equal(stored.codeHash, hashCode("111111", NONCE, SECRET));
    assert.notEqual(hashCode("111111", NONCE, SECRET), hashCode("111111", "m".repeat(22), SECRET));
  });

  it("a correct code succeeds exactly once", async () => {
    const { deps } = setup();
    await start(deps);
    const first = await verifyChallenge(deps, NONCE, "111111");
    assert.deepEqual(first.result, { ok: true, adminId: "adm_ops", channel: "email" });
    assert.equal(first.state, null);
    const again = await verifyChallenge(deps, NONCE, "111111");
    assert.equal(again.result.ok, false);
    assert.equal((again.result as { reason: string }).reason, "missing");
  });

  it("a wrong code spends one attempt and says how many are left", async () => {
    const { deps } = setup();
    await start(deps);
    const r = (await verifyChallenge(deps, NONCE, "000000")).result;
    assert.equal(r.ok, false);
    assert.equal((r as { reason: string }).reason, "wrong");
    assert.equal((r as { attemptsLeft: number }).attemptsLeft, OTP_MAX_ATTEMPTS - 1);
    assert.equal((await describeChallenge(deps, NONCE))?.attemptsLeft, OTP_MAX_ATTEMPTS - 1);
  });

  it("malformed input spends no attempt", async () => {
    const { deps } = setup();
    await start(deps);
    for (const bad of ["", "12345", "1234567", "12a456", null, 123456]) {
      assert.equal((await verifyChallenge(deps, NONCE, bad)).result.ok, false);
    }
    assert.equal((await describeChallenge(deps, NONCE))?.attemptsLeft, OTP_MAX_ATTEMPTS);
  });

  it("5 wrong codes kill the ticket, even the right code fails after", async () => {
    const { deps } = setup();
    await start(deps);
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) {
      const r = (await verifyChallenge(deps, NONCE, "000000")).result as { reason: string; attemptsLeft: number };
      assert.equal(r.reason, "wrong");
      assert.equal(r.attemptsLeft, OTP_MAX_ATTEMPTS - i);
    }
    const last = await verifyChallenge(deps, NONCE, "000000");
    assert.equal((last.result as { reason: string }).reason, "locked");
    assert.equal(last.state, null);
    assert.equal(await deps.store.get(NONCE), undefined);
    assert.equal((await verifyChallenge(deps, NONCE, "111111")).result.ok, false);
    assert.equal(await describeChallenge(deps, NONCE), null);
  });

  it("expire after 5 minutes without spending an attempt", async () => {
    const { deps, tick } = setup();
    await start(deps);
    tick(OTP_TTL_MS + 1);
    const r = (await verifyChallenge(deps, NONCE, "111111")).result as { ok: boolean; reason: string };
    assert.equal(r.ok, false);
    assert.equal(r.reason, "expired");
    assert.equal((await describeChallenge(deps, NONCE))?.attemptsLeft, OTP_MAX_ATTEMPTS);
  });

  it("nothing survives the ticket deadline", async () => {
    const { deps, tick } = setup();
    await start(deps);
    tick(DEADLINE - T0 + 1);
    assert.equal((await verifyChallenge(deps, NONCE, "111111")).result.ok, false);
    assert.equal(await describeChallenge(deps, NONCE), null);
  });

  it("decoys never pass but count attempts the same way", async () => {
    const { deps } = setup();
    const { code } = await start(deps, null);
    assert.equal(code, null);
    for (const guess of ["111111", "000000", "999999"]) {
      const r = (await verifyChallenge(deps, NONCE, guess)).result;
      assert.equal(r.ok, false);
      assert.equal((r as { reason: string }).reason, "wrong");
    }
    assert.equal((await describeChallenge(deps, NONCE))?.attemptsLeft, OTP_MAX_ATTEMPTS - 3);
  });
});

describe("resend", () => {
  it("waits 30 seconds, then issues a fresh code and kills the old one", async () => {
    const { deps, tick } = setup();
    await start(deps);
    const early = (await resendChallenge(deps, NONCE)).result as { ok: boolean; reason: string; retryAt: number };
    assert.equal(early.ok, false);
    assert.equal(early.reason, "cooldown");
    assert.equal(early.retryAt, T0 + OTP_RESEND_COOLDOWN_MS);

    tick(OTP_RESEND_COOLDOWN_MS);
    const ok = (await resendChallenge(deps, NONCE)).result as { ok: boolean; code: string };
    assert.equal(ok.ok, true);
    assert.equal(ok.code, "222222");

    const old = (await verifyChallenge(deps, NONCE, "111111")).result as { ok: boolean; reason: string };
    assert.equal(old.ok, false);
    assert.equal(old.reason, "wrong");
    assert.equal((await verifyChallenge(deps, NONCE, "222222")).result.ok, true);
  });

  it("keeps the attempt count and stops after 3 resends", async () => {
    const { deps, tick } = setup();
    await start(deps);
    await verifyChallenge(deps, NONCE, "000000");
    for (let i = 0; i < OTP_MAX_RESENDS; i++) {
      tick(OTP_RESEND_COOLDOWN_MS);
      assert.equal((await resendChallenge(deps, NONCE)).result.ok, true);
    }
    tick(OTP_RESEND_COOLDOWN_MS);
    const r = (await resendChallenge(deps, NONCE)).result as { ok: boolean; reason: string };
    assert.equal(r.ok, false);
    assert.equal(r.reason, "limit");
    const view = await describeChallenge(deps, NONCE);
    assert.equal(view?.attemptsLeft, OTP_MAX_ATTEMPTS - 1);
    assert.equal(view?.resendsLeft, 0);
  });

  it("gives a resent code a fresh 5 minutes, capped at the ticket deadline", async () => {
    const { deps, tick, at } = setup();
    await start(deps);
    tick(OTP_TTL_MS + 1);
    const r = (await resendChallenge(deps, NONCE)).result as { ok: boolean; view: { expiresAt: number } };
    assert.equal(r.ok, true);
    assert.equal(r.view.expiresAt, Math.min(at() + OTP_TTL_MS, DEADLINE));
    assert.equal((await verifyChallenge(deps, NONCE, "222222")).result.ok, true);
  });
});

describe("demo mode: challenge carried in the signed cookie", () => {
  // Each "instance" has its own memory, like separate Vercel functions.
  const instance = (clock: () => number, codes: string[] = []) => ({
    store: new MemoryChallengeStore(),
    secret: SECRET,
    now: clock,
    generateCode: () => codes.shift() ?? "999999",
  });

  function cookieFor(challenge: Parameters<Otp["toCarried"]>[0], adminId: string | null, code: string | null) {
    const ref = adminId ? tk.adminRef(SECRET, NONCE_B, adminId) : tk.decoyAdminRef();
    return tk.signMfaTicket(
      { sid: NONCE_B, method: "password", ch: "email", dst: "ad•••@demo.local", st: toCarried(challenge, ref, code) },
      SECRET,
      T0,
    );
  }
  const NONCE_B = "b".repeat(22);
  const ADMINS = ["adm_owner", "adm_super", "adm_ops"];

  /** What mfa.ts does on each request: verify cookie -> rebuild -> resolve admin. */
  function readCookie(token: string, now: number) {
    const ticket = tk.verifyMfaTicket(token, SECRET, now);
    assert.ok(ticket?.st, "cookie verifies");
    const adminId = tk.resolveAdminRef(SECRET, ticket.sid, ticket.st.u, ADMINS);
    return { ticket, carried: fromCarried(ticket.st, { nonce: ticket.sid, channel: ticket.ch, createdAt: ticket.iat, deadline: ticket.exp, adminId }) };
  }

  it("step 1 on instance A, step 2 on instance B succeeds", async () => {
    let now = T0;
    const A = instance(() => now, ["123456"]);
    const B = instance(() => now);
    const { challenge, code } = await issueChallenge(A, { nonce: NONCE_B, adminId: "adm_ops", channel: "email", destination: "admin@demo.local", deadline: T0 + 600_000 });
    const { token } = cookieFor(challenge, "adm_ops", code);
    now += 5000;
    const { carried } = readCookie(token, now);
    assert.equal(await B.store.get(NONCE_B), undefined, "B never saw step 1");
    const out = await verifyChallenge(B, NONCE_B, "123456", carried);
    assert.deepEqual(out.result, { ok: true, adminId: "adm_ops", channel: "email" });
  });

  it("wrong attempts carry across instances through the re-signed cookie", async () => {
    let now = T0;
    const A = instance(() => now, ["123456"]);
    const { challenge, code } = await issueChallenge(A, { nonce: NONCE_B, adminId: "adm_ops", channel: "email", destination: "admin@demo.local", deadline: T0 + 600_000 });
    let { token } = cookieFor(challenge, "adm_ops", code);
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) {
      now += 1000;
      const X = instance(() => now); // a fresh instance every time
      const { ticket, carried } = readCookie(token, now);
      const out = await verifyChallenge(X, NONCE_B, "000000", carried);
      assert.equal((out.result as { attemptsLeft: number }).attemptsLeft, OTP_MAX_ATTEMPTS - i);
      assert.ok(out.state);
      token = tk.resignMfaTicket(ticket, toCarried(out.state, ticket.st!.u, ticket.st!.c), SECRET).token;
    }
    now += 1000;
    const { carried } = readCookie(token, now);
    const last = await verifyChallenge(instance(() => now), NONCE_B, "000000", carried);
    assert.equal((last.result as { reason: string }).reason, "locked");
    assert.equal(last.state, null, "the cookie is cleared");
  });

  it("an instance that has seen more attempts ignores a replayed older cookie", async () => {
    const now = T0;
    const A = instance(() => now, ["123456"]);
    const { challenge, code } = await issueChallenge(A, { nonce: NONCE_B, adminId: "adm_ops", channel: "email", destination: "admin@demo.local", deadline: T0 + 600_000 });
    const { token: original } = cookieFor(challenge, "adm_ops", code);
    await verifyChallenge(A, NONCE_B, "000000", readCookie(original, now).carried);
    await verifyChallenge(A, NONCE_B, "000000", readCookie(original, now).carried);
    const out = await verifyChallenge(A, NONCE_B, "000000", readCookie(original, now).carried);
    assert.equal((out.result as { attemptsLeft: number }).attemptsLeft, OTP_MAX_ATTEMPTS - 3);
  });

  it("a resend on one instance invalidates the old code on another", async () => {
    let now = T0;
    const A = instance(() => now, ["123456"]);
    const { challenge, code } = await issueChallenge(A, { nonce: NONCE_B, adminId: "adm_ops", channel: "email", destination: "admin@demo.local", deadline: T0 + 600_000 });
    const { token } = cookieFor(challenge, "adm_ops", code);

    now += OTP_RESEND_COOLDOWN_MS;
    const B = instance(() => now, ["654321"]);
    const read = readCookie(token, now);
    const resent = await resendChallenge(B, NONCE_B, read.carried);
    assert.equal(resent.result.ok, true);
    assert.ok(resent.state);
    const newToken = tk.resignMfaTicket(read.ticket, toCarried(resent.state, read.ticket.st!.u, "654321"), SECRET).token;
    assert.equal(tk.verifyMfaTicket(newToken, SECRET, now)?.st?.c, "654321");

    const C = instance(() => now);
    const old = await verifyChallenge(C, NONCE_B, "123456", readCookie(newToken, now).carried);
    assert.equal((old.result as { reason: string }).reason, "wrong");
    const D = instance(() => now);
    assert.equal((await verifyChallenge(D, NONCE_B, "654321", readCookie(newToken, now).carried)).result.ok, true);
  });

  it("a decoy cookie resolves to no admin and never passes", async () => {
    const now = T0;
    const A = instance(() => now);
    const { challenge, code } = await issueChallenge(A, { nonce: NONCE_B, adminId: null, channel: "sms", destination: "+919999999999", deadline: T0 + 600_000 });
    assert.equal(code, null);
    const { token } = cookieFor(challenge, null, null);
    const { carried } = readCookie(token, now);
    assert.equal(carried.adminId, null);
    for (const guess of ["000000", "123456", "999999"]) {
      assert.equal((await verifyChallenge(instance(() => now), NONCE_B, guess, carried)).result.ok, false);
    }
  });

  it("mergeChallenges keeps the newer code and the higher counters", () => {
    const base = { nonce: NONCE_B, adminId: "adm_ops", channel: "email" as const, destination: "", codeHash: "a".repeat(64), createdAt: T0, sentAt: T0, expiresAt: T0 + OTP_TTL_MS, deadline: T0 + 600_000, attempts: 1, resends: 0 };
    const newer = { ...base, codeHash: "b".repeat(64), sentAt: T0 + 30_000, resends: 1, attempts: 0 };
    const m = mergeChallenges(base, newer);
    assert.equal(m?.codeHash, "b".repeat(64));
    assert.equal(m?.attempts, 1);
    assert.equal(m?.resends, 1);
    assert.equal(mergeChallenges(undefined, newer), newer);
    assert.equal(mergeChallenges(base, undefined), base);
  });
});

describe("IssueThrottle", () => {
  it("allows 5 codes per destination per hour, then says when to retry", () => {
    const t = new IssueThrottle(5, 60 * 60 * 1000);
    for (let i = 0; i < 5; i++) assert.equal(t.take("sms:+919000247318", T0 + i).ok, true);
    const blocked = t.take("sms:+919000247318", T0 + 10);
    assert.equal(blocked.ok, false);
    assert.equal((blocked as { retryAt: number }).retryAt, T0 + 60 * 60 * 1000);
    assert.equal(t.take("sms:+919848031764", T0 + 10).ok, true, "other numbers unaffected");
    assert.equal(t.take("sms:+919000247318", T0 + 60 * 60 * 1000 + 1).ok, true, "window slides");
  });
});
