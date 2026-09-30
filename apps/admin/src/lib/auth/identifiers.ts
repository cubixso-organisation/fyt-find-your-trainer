/**
 * Sign-in identifiers: Indian mobile numbers, masked destinations and the
 * post-sign-in redirect rule.
 *
 * PURE: no imports, no clock, no I/O, so Node's test runner can load it
 * directly (see identifiers.test.ts).
 */

/**
 * Normalises an Indian mobile number to E.164 (`+91XXXXXXXXXX`), or returns
 * null. Accepts the ways operators actually type it:
 *   9000247318 · 09000247318 · 919000247318 · +91 90002 47318 · 0091-90002-47318
 * Indian mobile numbers are 10 digits starting 6-9. Other country codes are
 * rejected: the console only has Indian operators.
 */
export function normalizeIndianPhone(input: string): string | null {
  if (typeof input !== "string" || input.length > 32) return null;
  const compact = input.trim().replace(/[\s().-]/g, "");
  let national: string | null = null;
  if (/^\+91\d{10}$/.test(compact)) national = compact.slice(3);
  else if (/^0091\d{10}$/.test(compact)) national = compact.slice(4);
  else if (/^91\d{10}$/.test(compact)) national = compact.slice(2);
  else if (/^0\d{10}$/.test(compact)) national = compact.slice(1);
  else if (/^\d{10}$/.test(compact)) national = compact;
  if (!national || !/^[6-9]\d{9}$/.test(national)) return null;
  return `+91${national}`;
}

/** `+919000247318` -> `+91 90002 47318` (display only). */
export function formatIndianPhone(e164: string): string {
  const n = e164.replace(/^\+91/, "");
  return /^\d{10}$/.test(n) ? `+91 ${n.slice(0, 5)} ${n.slice(5)}` : e164;
}

const DOT = "•";

/** `+919000247318` -> `+91 ••••• •7318`. Only the last four digits survive. */
export function maskPhone(e164: string): string {
  const n = e164.replace(/^\+91/, "");
  const last4 = n.slice(-4).padStart(4, DOT);
  return `+91 ${DOT.repeat(5)} ${DOT}${last4}`;
}

/** `owner@demo.local` -> `ow•••@demo.local`. The domain stays readable. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return DOT.repeat(3);
  const local = email.slice(0, at);
  const keep = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, keep)}${DOT.repeat(3)}${email.slice(at)}`;
}

/**
 * Where to send an operator after sign-in. Same rule as before (a local path,
 * never protocol-relative), hardened against the backslash trick: browsers
 * read `/\evil.com` as `//evil.com`. Anything doubtful falls back to `/`.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  for (let i = 0; i < next.length; i++) {
    const c = next.charCodeAt(i);
    if (c === 0x5c /* \ */ || c < 0x20 || c === 0x7f) return "/";
  }
  return next;
}
