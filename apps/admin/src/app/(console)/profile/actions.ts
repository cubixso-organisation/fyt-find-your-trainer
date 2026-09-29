"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { audit, verifyPassword } from "@/lib/data/store";
import { hashPassword } from "@/lib/data/seed";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import type { ActionResult } from "../bookings/actions";

const PASSWORD_RULE = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128)
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), "Mix upper and lower case letters with a number.");

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(60),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?[0-9 ]{10,16})?$/, "Use a 10-digit Indian number, optionally with +91.")
    .optional(),
});

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Your session ended. Sign in again." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  v.admin.name = parsed.data.name;
  v.admin.phone = parsed.data.phone || undefined;
  audit(v.admin, "profile.update");
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}

async function reissue(admin: { id: string; email: string; role: import("@/lib/rbac").Role; permissions: string[]; tokenVersion: number }) {
  const token = await signSession({ sub: admin.id, email: admin.email, role: admin.role, perms: admin.permissions, ver: admin.tokenVersion });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function changePassword(input: { current: string; next: string }): Promise<ActionResult> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Your session ended. Sign in again." };
  if (!verifyPassword(input.current, v.admin.passwordHash)) return { ok: false, error: "Your current password is incorrect." };
  const parsed = PASSWORD_RULE.safeParse(input.next);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (input.current === input.next) return { ok: false, error: "Choose a password you haven't used here." };
  v.admin.passwordHash = hashPassword(input.next);
  v.admin.tokenVersion += 1; // other devices are signed out
  await reissue(v.admin);
  audit(v.admin, "team.revoke_sessions", `${v.admin.name} (password change)`, { severity: "notice" });
  return { ok: true, message: "Password changed. Other devices were signed out." };
}

export async function signOutOtherDevices(): Promise<ActionResult> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Your session ended. Sign in again." };
  v.admin.tokenVersion += 1;
  await reissue(v.admin);
  audit(v.admin, "team.revoke_sessions", `${v.admin.name} (own devices)`, { severity: "notice" });
  return { ok: true, message: "Signed out on every other device." };
}
