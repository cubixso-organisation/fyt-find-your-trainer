"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { audit, db } from "@/lib/data/store";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { safeNext } from "@/lib/auth/identifiers";
import { checkCode, clearTicket, readTicket, resendCode } from "@/lib/auth/mfa";
import type { SignInMethod } from "@/lib/auth/ticket";

/**
 * Step 2 of operator sign-in: the 6-digit code. Everything is re-checked
 * here from the signed `tp_mfa` ticket; nothing from the form is trusted
 * except the code itself and `next` (passed through `safeNext`).
 */

export interface VerifyState {
  error?: string;
  kind?: "malformed" | "wrong" | "expired";
  attemptsLeft?: number;
  /** Bumps on every answer so the digit boxes reset. */
  n?: number;
}

export interface ResendState {
  message?: string;
  error?: string;
  n?: number;
}

const METHOD_DETAIL: Record<SignInMethod, string> = {
  password: "Email and password, then a code by email",
  phone: "Mobile number, then a code by SMS",
  google: "Google, then a code by email",
};

function backToLogin(notice: string, next: unknown): never {
  const dest = safeNext(next);
  redirect(`/login?notice=${notice}${dest === "/" ? "" : `&next=${encodeURIComponent(dest)}`}`);
}

export async function verifyCode(prev: VerifyState, form: FormData): Promise<VerifyState> {
  const n = (prev.n ?? 0) + 1;
  const next = form.get("next");
  const ticket = await readTicket();
  if (!ticket) backToLogin("expired", next);

  const result = await checkCode(ticket, String(form.get("code") ?? ""));
  if (!result.ok) {
    switch (result.reason) {
      case "malformed":
        return { n, kind: "malformed", error: "Enter all 6 digits of the code." };
      case "wrong": {
        const left = result.attemptsLeft;
        return { n, kind: "wrong", attemptsLeft: left, error: `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.` };
      }
      case "expired":
        return { n, kind: "expired", error: "This code has expired. Send a new one." };
      case "locked":
        if (result.adminId) {
          const admin = db().admins.find((a) => a.id === result.adminId);
          if (admin) audit(admin, "auth.code_locked", "Console", { detail: "Sign-in stopped after 5 incorrect codes", severity: "notice" });
        }
        await clearTicket(ticket);
        return backToLogin("locked", next);
      case "missing":
        await clearTicket(ticket);
        return backToLogin("expired", next);
    }
  }

  // The code is right. Re-check the account now, not as it was at step 1.
  const admin = db().admins.find((a) => a.id === result.adminId);
  await clearTicket(ticket);
  if (!admin || admin.status !== "active") return backToLogin("unavailable", next);

  admin.lastLoginAt = Date.now();
  audit(admin, "auth.login", "Console", { detail: METHOD_DETAIL[ticket.method] });
  const token = await signSession({ sub: admin.id, email: admin.email, role: admin.role, perms: admin.permissions, ver: admin.tokenVersion });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  redirect(safeNext(next));
}

export async function resendVerificationCode(prev: ResendState, form: FormData): Promise<ResendState> {
  const n = (prev.n ?? 0) + 1;
  const ticket = await readTicket();
  if (!ticket) backToLogin("expired", form.get("next"));

  const r = await resendCode(ticket);
  if (r.ok) return { n, message: ticket.ch === "sms" ? "New code sent. The previous one no longer works." : "New code sent to your email. The previous one no longer works." };
  switch (r.reason) {
    case "cooldown": {
      const secs = Math.max(1, Math.ceil((r.retryAt - Date.now()) / 1000));
      return { n, error: `You can ask for a new code in ${secs} second${secs === 1 ? "" : "s"}.` };
    }
    case "limit":
      return { n, error: "No more resends for this sign-in. Start again to get a new code." };
    case "unavailable":
      return { n, error: r.message };
    case "missing":
      await clearTicket(ticket);
      return backToLogin("expired", form.get("next"));
  }
}

/** "Use a different method": end this ticket and go back to step 1. */
export async function restartSignIn(form: FormData) {
  await clearTicket(await readTicket());
  const dest = safeNext(form.get("next"));
  redirect(dest === "/" ? "/login" : `/login?next=${encodeURIComponent(dest)}`);
}
