"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, db, verifyPassword } from "@/lib/data/store";
import { hashPassword } from "@/lib/data/seed";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

export interface AcceptState {
  error?: string;
}

const pw = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128)
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), "Mix upper and lower case letters with a number.");

/** Finds the pending invite a token belongs to (tokens are stored hashed). */
export async function findInvite(token: string) {
  if (!token || token.length < 16) return null;
  const invite = db().admins.find((a) => a.status === "invited" && verifyPassword(token, a.passwordHash));
  if (!invite) return null;
  return { name: invite.name, email: invite.email, role: invite.role };
}

export async function acceptInvite(_: AcceptState, form: FormData): Promise<AcceptState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const repeat = String(form.get("repeat") ?? "");
  const invite = db().admins.find((a) => a.status === "invited" && token.length >= 16 && verifyPassword(token, a.passwordHash));
  if (!invite) return { error: "This invite link is invalid or was withdrawn. Ask for a new one." };
  const parsed = pw.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (password !== repeat) return { error: "Passwords don't match." };
  invite.passwordHash = hashPassword(password);
  invite.status = "active";
  invite.lastLoginAt = Date.now();
  invite.tokenVersion += 1;
  audit(invite, "auth.login", "Console", { detail: "Accepted invite" });
  const token2 = await signSession({ sub: invite.id, email: invite.email, role: invite.role, perms: invite.permissions, ver: invite.tokenVersion });
  (await cookies()).set(SESSION_COOKIE, token2, sessionCookieOptions());
  redirect("/");
}
