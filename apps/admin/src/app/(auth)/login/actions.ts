"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, db, verifyPassword } from "@/lib/data/store";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

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
  admin.lastLoginAt = Date.now();
  audit(admin, "auth.login", "Console");

  const token = await signSession({ sub: admin.id, email: admin.email, role: admin.role, perms: admin.permissions, ver: admin.tokenVersion });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());

  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  redirect(dest);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
