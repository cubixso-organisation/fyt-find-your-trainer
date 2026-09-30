/**
 * FYT operator console: sign in, step 1 of 2.
 *
 * Layout: ./auth-shell.tsx (after the "Auth Page" component by efferd on
 * 21st.dev). Step 1 never creates a session; it earns a 6-digit code checked
 * on /login/verify. No social proof anywhere: the left panel shows fictional
 * demo sessions, badged "Demo".
 */
import type { Metadata } from "next";
import { Timer, UserPlus, AlertCircle } from "lucide-react";
import { DATA_SOURCE } from "@/lib/data/store";
import { safeNext } from "@/lib/auth/identifiers";
import { googleOAuthStatus } from "@/lib/auth/oauth-google";
import { AuthShell } from "./auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  expired: "That sign-in expired before the code was entered. Start again.",
  locked: "Too many incorrect codes, so that sign-in was stopped. Start again.",
  unavailable: "This account can't sign in right now. Ask a super admin to check it.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const { next, notice } = await searchParams;
  const dest = safeNext(next);
  const message = notice && Object.hasOwn(NOTICES, notice) ? NOTICES[notice] : undefined;

  return (
    <AuthShell>
      <header>
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2">Step 1 of 2</p>
        <h1 className="font-display mt-2 text-[26px] font-semibold leading-[1.15] tracking-tight text-ink">Sign in to FYT Console</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
          For the FYT operations team. Step 2 is a 6{"\u2011"}digit code we send you.
        </p>
      </header>

      {message ? (
        <p role="status" className="mt-5 flex items-start gap-2.5 rounded-[var(--radius-panel)] bg-sunken px-3.5 py-3 text-[13px] leading-snug text-ink ring-1 ring-inset ring-line">
          <AlertCircle className="mt-px size-4 shrink-0 text-ink-2" strokeWidth={1.75} aria-hidden />
          {message}
        </p>
      ) : null}

      <LoginForm next={dest === "/" ? undefined : dest} demo={DATA_SOURCE === "demo"} google={googleOAuthStatus()} />

      <ul className="mt-6 space-y-2 border-t border-line pt-4 text-[12.5px] leading-snug text-ink-2">
        <li className="flex items-start gap-2.5">
          <UserPlus className="mt-px size-3.5 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
          Operator accounts are by invitation. If you need access, ask a super admin.
        </li>
        <li className="flex items-start gap-2.5">
          <Timer className="mt-px size-3.5 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
          Sessions end after 35 minutes without activity.
        </li>
      </ul>
    </AuthShell>
  );
}
