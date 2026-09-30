"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, verifyPassword } from "@/lib/data/store";
import { SESSION_COOKIE } from "@/lib/session";
import { normalizeIndianPhone, safeNext } from "@/lib/auth/identifiers";
import { findActiveAdminByPhone, startSignInChallenge, type StartResult } from "@/lib/auth/mfa";

/**
 * Step 1 of operator sign-in. Nothing here creates a session: a correct
 * password (or a phone number) only earns the short-lived `tp_mfa` ticket and
 * a 6-digit code, checked on /login/verify (./verify/actions.ts).
 */

export interface LoginState {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
  email?: string;
}

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid work email."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

// Simple per-email throttle: 5 failures locks the account for 15 minutes.
const g = globalThis as unknown as { __tpLoginFails?: Map<string, { count: number; until: number }> };
const fails = (g.__tpLoginFails ??= new Map());
const LOCK_MS = 15 * 60 * 1000;

function verifyUrl(next: unknown) {
  const dest = safeNext(next);
  return dest === "/" ? "/login/verify" : `/login/verify?next=${encodeURIComponent(dest)}`;
}

function startError(r: Exclude<StartResult, { ok: true }>, subject: "account" | "number") {
  if (r.reason === "throttled") {
    const mins = Math.max(1, Math.ceil((r.retryAt - Date.now()) / 60000));
    return `Too many codes requested for this ${subject}. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
  }
  return r.message;
}

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    next: form.get("next") ?? undefined,
  });
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return { fieldErrors: { email: f.email?.[0], password: f.password?.[0] }, email: String(form.get("email") ?? "") };
  }
  const { email, password, next } = parsed.data;

  const rec = fails.get(email);
  if (rec && rec.until > Date.now()) {
    const mins = Math.ceil((rec.until - Date.now()) / 60000);
    return { error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`, email };
  }

  const admin = db().admins.find((a) => a.email === email);
  const ok = !!admin && verifyPassword(password, admin.passwordHash);
  if (!ok || !admin) {
    const count = (rec && rec.until <= Date.now() ? 0 : rec?.count ?? 0) + 1;
    fails.set(email, { count, until: count >= 5 ? Date.now() + LOCK_MS : 0 });
    return { error: "That email and password don't match an operator account.", email };
  }
  if (admin.status === "disabled") return { error: "This account is disabled. Ask a super admin to restore access.", email };
  if (admin.status === "invited") return { error: "This invite hasn't been accepted yet. Use the link in your invite email.", email };

  fails.delete(email);

  // Password is right: step 2 is a code sent to the account's email.
  const started = await startSignInChallenge({ adminId: admin.id, method: "password", channel: "email", destination: admin.email });
  if (!started.ok) return { error: startError(started, "account"), email };
  redirect(verifyUrl(next));
}

export interface PhoneState {
  error?: string;
  fieldError?: string;
  phone?: string;
}

/**
 * Phone sign-in. Answers the same way whether or not the number belongs to an
 * operator: every well-formed number gets a ticket and the verify screen says
 * "If that number belongs to an operator, we've sent a code". Only a match
 * gets a real code; anything else gets a decoy challenge that can't pass.
 */
export async function startPhoneLogin(_: PhoneState, form: FormData): Promise<PhoneState> {
  const raw = String(form.get("phone") ?? "").slice(0, 32);
  if (!raw.trim()) return { fieldError: "Enter your mobile number.", phone: raw };
  const e164 = normalizeIndianPhone(raw);
  if (!e164) return { fieldError: "Enter a 10-digit Indian mobile number.", phone: raw };

  const admin = findActiveAdminByPhone(e164);
  const started = await startSignInChallenge({ adminId: admin?.id ?? null, method: "phone", channel: "sms", destination: e164 });
  if (!started.ok) return { error: startError(started, "number"), phone: raw };
  redirect(verifyUrl(form.get("next")));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
