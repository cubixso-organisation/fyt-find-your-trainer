/**
 * Pending-login ticket (`tp_mfa`): signing, tamper and expiry rejection, the
 * carried demo state and the HMAC-bound admin reference.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

type Mod = typeof import("./ticket");
const {
  signMfaTicket,
  resignMfaTicket,
  verifyMfaTicket,
  newTicketNonce,
  adminRef,
  decoyAdminRef,
  resolveAdminRef,
  MFA_TICKET_TTL_MS,
}: Mod = await import(new URL("./ticket.ts", import.meta.url).href);

const SECRET = "test-secret-0123456789-abcdefghijklmnop";
const NOW = 1_790_000_000_000;
const base = () => ({ sid: newTicketNonce(), method: "password" as const, ch: "email" as const, dst: "ow•••@demo.local" });
const st = (over: Record<string, unknown> = {}) => ({ h: "a".repeat(64), x: NOW + 300_000, s: NOW, a: 0, r: 0, u: decoyAdminRef(), ...over });

function reencode(token: string, mutate: (t: Record<string, unknown>) => void, secret?: string) {
  const [body] = token.split(".");
  const t = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  mutate(t);
  const nb = Buffer.from(JSON.stringify(t)).toString("base64url");
  const sig = secret ? createHmac("sha256", secret).update("fyt.mfa.v1." + nb).digest("base64url") : token.split(".")[1];
  return `${nb}.${sig}`;
}

describe("signMfaTicket / verifyMfaTicket", () => {
  it("round-trips a valid ticket", () => {
    const { token, ticket } = signMfaTicket(base(), SECRET, NOW);
    const back = verifyMfaTicket(token, SECRET, NOW + 1000);
    assert.deepEqual(back, ticket);
    assert.equal(ticket.exp - ticket.iat, MFA_TICKET_TTL_MS);
  });

  it("never carries the admin id", () => {
    const { token } = signMfaTicket({ ...base(), st: st({ u: adminRef(SECRET, "x".repeat(22), "adm_owner") }) }, SECRET, NOW);
    assert.ok(!Buffer.from(token.split(".")[0], "base64url").toString("utf8").includes("adm_"));
  });

  it("rejects a tampered body (e.g. lowered attempt count)", () => {
    const { token } = signMfaTicket({ ...base(), st: st({ a: 4 }) }, SECRET, NOW);
    const forged = reencode(token, (t) => ((t.st as { a: number }).a = 0));
    assert.equal(verifyMfaTicket(forged, SECRET, NOW), null);
  });

  it("rejects a tampered signature, a wrong secret and junk", () => {
    const { token } = signMfaTicket(base(), SECRET, NOW);
    const [body, sig] = token.split(".");
    const flipped = sig[0] === "A" ? "B" + sig.slice(1) : "A" + sig.slice(1);
    assert.equal(verifyMfaTicket(`${body}.${flipped}`, SECRET, NOW), null);
    assert.equal(verifyMfaTicket(token, SECRET + "x", NOW), null);
    for (const junk of ["", ".", "abc", "a.b.c", `${body}.`, `.${sig}`, undefined, null]) {
      assert.equal(verifyMfaTicket(junk as string, SECRET, NOW), null);
    }
  });

  it("rejects an expired ticket", () => {
    const { token } = signMfaTicket(base(), SECRET, NOW);
    assert.ok(verifyMfaTicket(token, SECRET, NOW + MFA_TICKET_TTL_MS));
    assert.equal(verifyMfaTicket(token, SECRET, NOW + MFA_TICKET_TTL_MS + 1), null);
  });

  it("caps the lifetime at 10 minutes even if asked for more", () => {
    const { ticket } = signMfaTicket(base(), SECRET, NOW, 60 * 60 * 1000);
    assert.equal(ticket.exp - ticket.iat, MFA_TICKET_TTL_MS);
    // A correctly signed ticket claiming a longer life is still refused.
    const { token } = signMfaTicket(base(), SECRET, NOW);
    const long = reencode(token, (t) => (t.exp = (t.iat as number) + MFA_TICKET_TTL_MS + 1), SECRET);
    assert.equal(verifyMfaTicket(long, SECRET, NOW), null);
  });

  it("is not interchangeable with a session token", () => {
    // session.ts signs the bare body; a ticket body signed that way must fail.
    const { token } = signMfaTicket(base(), SECRET, NOW);
    const body = token.split(".")[0];
    const sessionStyle = `${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
    assert.equal(verifyMfaTicket(sessionStyle, SECRET, NOW), null);
  });

  it("rejects wrong type, bad nonce and unknown fields in the carried state", () => {
    const { token } = signMfaTicket({ ...base(), st: st() }, SECRET, NOW);
    assert.equal(verifyMfaTicket(reencode(token, (t) => (t.typ = "session"), SECRET), SECRET, NOW), null);
    assert.equal(verifyMfaTicket(reencode(token, (t) => (t.sid = "short"), SECRET), SECRET, NOW), null);
    assert.equal(verifyMfaTicket(reencode(token, (t) => (t.method = "magic"), SECRET), SECRET, NOW), null);
    assert.equal(verifyMfaTicket(reencode(token, (t) => ((t.st as Record<string, unknown>).admin = "adm_owner"), SECRET), SECRET, NOW), null);
    assert.equal(verifyMfaTicket(reencode(token, (t) => ((t.st as Record<string, unknown>).a = -1), SECRET), SECRET, NOW), null);
    assert.equal(verifyMfaTicket(reencode(token, (t) => ((t.st as Record<string, unknown>).c = "12345"), SECRET), SECRET, NOW), null);
  });
});

describe("resignMfaTicket", () => {
  it("updates the carried state but never the lifetime", () => {
    const { ticket } = signMfaTicket({ ...base(), st: st() }, SECRET, NOW);
    const { token, ticket: next } = resignMfaTicket(ticket, st({ a: 2 }), SECRET);
    const back = verifyMfaTicket(token, SECRET, NOW + 5000);
    assert.ok(back);
    assert.equal(back.st?.a, 2);
    assert.equal(next.iat, ticket.iat);
    assert.equal(next.exp, ticket.exp);
    assert.equal(next.sid, ticket.sid);
  });
});

describe("admin reference", () => {
  const ids = ["adm_owner", "adm_super", "adm_ops", "adm_content"];

  it("resolves only the admin it was made for, only for its own nonce", () => {
    const sid = newTicketNonce();
    const ref = adminRef(SECRET, sid, "adm_ops");
    assert.equal(ref.length, 22);
    assert.equal(resolveAdminRef(SECRET, sid, ref, ids), "adm_ops");
    assert.equal(resolveAdminRef(SECRET, newTicketNonce(), ref, ids), null);
    assert.equal(resolveAdminRef(SECRET + "x", sid, ref, ids), null);
    assert.equal(resolveAdminRef(SECRET, sid, ref, ["adm_owner"]), null);
  });

  it("gives decoys the same shape and no match", () => {
    const sid = newTicketNonce();
    const decoy = decoyAdminRef();
    assert.equal(decoy.length, adminRef(SECRET, sid, "adm_ops").length);
    assert.equal(resolveAdminRef(SECRET, sid, decoy, ids), null);
  });
});
