/**
 * FYT operator console: sign in, step 2 of 2 (the 6-digit code).
 *
 * Reachable only with a valid `tp_mfa` ticket from step 1; anything else goes
 * back to /login. Shares the step 1 shell so the two steps read as one page.
 */
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DATA_SOURCE } from "@/lib/data/store";
import { safeNext } from "@/lib/auth/identifiers";
import { readTicket, verifyScreenState } from "@/lib/auth/mfa";
import { MFA_COOKIE } from "@/lib/auth/ticket";
import { OTP_MAX_ATTEMPTS, OTP_MAX_RESENDS } from "@/lib/auth/otp";
import { AuthShell } from "../auth-shell";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Enter verification code" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  const nextQuery = dest === "/" ? "" : `next=${encodeURIComponent(dest)}`;

  const ticket = await readTicket();
  if (!ticket) {
    // Had a ticket that has since expired -> say so; never had one -> plain step 1.
    const had = (await cookies()).has(MFA_COOKIE);
    const query = [had ? "notice=expired" : "", nextQuery].filter(Boolean).join("&");
    redirect(query ? `/login?${query}` : "/login");
  }

  const s = await verifyScreenState(ticket);

  return (
    <AuthShell>
      <VerifyForm
        key={s.view ? `${s.view.sentAt}` : "ended"}
        destination={ticket.dst}
        method={ticket.method}
        channel={ticket.ch}
        view={s.view}
        demo={DATA_SOURCE === "demo"}
        demoCode={s.demoCode}
        serverNow={s.now}
        resent={!!s.view && s.view.resendsLeft < OTP_MAX_RESENDS}
        maxAttempts={OTP_MAX_ATTEMPTS}
        next={dest === "/" ? undefined : dest}
      />
    </AuthShell>
  );
}
