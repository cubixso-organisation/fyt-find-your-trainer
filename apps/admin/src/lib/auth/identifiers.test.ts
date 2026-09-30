/**
 * Phone normalisation, masking and the post-sign-in redirect rule.
 * Node's built-in runner with native type stripping (`npm test`).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./identifiers");
const { normalizeIndianPhone, formatIndianPhone, maskPhone, maskEmail, safeNext }: Mod = await import(
  new URL("./identifiers.ts", import.meta.url).href
);

describe("normalizeIndianPhone", () => {
  it("accepts the common ways an Indian mobile is typed", () => {
    for (const input of [
      "9000247318",
      "09000247318",
      "919000247318",
      "+919000247318",
      "+91 90002 47318",
      "+91-90002-47318",
      "(+91) 90002 47318",
      "0091 90002 47318",
      "  90002 47318  ",
      "900.024.7318",
    ]) {
      assert.equal(normalizeIndianPhone(input), "+919000247318", input);
    }
  });

  it("rejects numbers that are not Indian mobiles", () => {
    for (const input of [
      "",
      "12345",
      "5000247318", // mobiles start 6-9
      "+1 415 555 0100",
      "+44 7700 900123",
      "+92 300 1234567",
      "90002473189", // 11 digits
      "+91 90002 4731",
      "9000abc318",
      "++919000247318",
      "9".repeat(40),
    ]) {
      assert.equal(normalizeIndianPhone(input), null, input);
    }
  });

  it("matches seeded numbers stored with spaces", () => {
    assert.equal(normalizeIndianPhone("+91 98480 31764"), normalizeIndianPhone("9848031764"));
  });
});

describe("masking", () => {
  it("masks a phone down to its last four digits", () => {
    assert.equal(maskPhone("+919000247318"), "+91 ••••• •7318");
    assert.ok(!maskPhone("+919000247318").includes("90002"));
  });

  it("masks the local part of an email and keeps the domain", () => {
    assert.equal(maskEmail("owner@demo.local"), "ow•••@demo.local");
    assert.equal(maskEmail("ab@x.in"), "a•••@x.in");
    assert.equal(maskEmail("not-an-email"), "•••");
  });

  it("formats E.164 for display", () => {
    assert.equal(formatIndianPhone("+919000247318"), "+91 90002 47318");
  });
});

describe("safeNext", () => {
  it("keeps local paths", () => {
    assert.equal(safeNext("/bookings"), "/bookings");
    assert.equal(safeNext("/bookings?view=week#today"), "/bookings?view=week#today");
  });

  it("falls back to / for anything that could leave the site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "", "/\tx", "/a\nb", undefined, null, 42]) {
      assert.equal(safeNext(bad), "/", String(bad));
    }
  });
});
