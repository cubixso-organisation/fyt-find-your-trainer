/**
 * Signed admin session token (HMAC-SHA256, Web Crypto) carried in an
 * httpOnly cookie. Pattern borrowed from the NutriGreenz console:
 *  - expiry lives INSIDE the signed payload, so an idle session is rejected
 *    server-side even if the browser keeps the cookie;
 *  - the token carries a per-admin `tokenVersion`, bumped on disable,
 *    role change or "sign out everywhere", which invalidates old tokens;
 *  - the cookie has no maxAge (session cookie); the idle window slides on
 *    activity via the proxy.
 * Role and permissions are NOT trusted from the token for authorization of
 * mutations; server actions re-read the admin record. The token's role is
 * only used by the proxy for fast route gating.
 */
import type { Role } from "./rbac";

export const SESSION_COOKIE = "tp_admin";
export const SESSION_IDLE_SECONDS = 35 * 60;

export interface SessionClaims {
  sub: string; // admin id
  email: string;
  role: Role;
  perms: string[];
  ver: number; // tokenVersion
  iat: number; // ms
  exp: number; // ms
}

const enc = new TextEncoder();

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET must be set (32+ chars) in production");
  }
  return "dev-only-insecure-secret-change-me-please-000";
}

let keyPromise: Promise<CryptoKey> | null = null;
function key(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
  return keyPromise;
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function signSession(claims: Omit<SessionClaims, "iat" | "exp">, now = Date.now()): Promise<string> {
  const full: SessionClaims = { ...claims, iat: now, exp: now + SESSION_IDLE_SECONDS * 1000 };
  const body = b64url(enc.encode(JSON.stringify(full)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64url(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionClaims;
    if (!Number.isFinite(claims.exp) || Date.now() > claims.exp) return null;
    return claims;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}
