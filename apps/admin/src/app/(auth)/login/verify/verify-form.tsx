"use client";

/**
 * Step 2 form: the 6-digit code, resend with a visible countdown, and a way
 * back to step 1. Layout follows the "OTPVerification" component on 21st.dev
 * ("Enter verification code" heading with the destination, per-digit boxes,
 * a verify button with a loading state and a resend link), restyled for FYT
 * and wired to real server actions (./actions.ts).
 *
 * Time: countdowns read the clock through `useSyncExternalStore` (a 1 s
 * subscription), never during render, and start from the server's `now` so
 * server and client markup agree.
 */
import * as React from "react";
import { useActionState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, ArrowLeft, Check, Clock3, Mail, MessageSquareText, RotateCw, ShieldCheck } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { OtpInput, type OtpInputHandle } from "@/components/ui/otp-input";
import type { ChallengeView } from "@/lib/auth/otp";
import type { CodeChannel, SignInMethod } from "@/lib/auth/ticket";
import { resendVerificationCode, restartSignIn, verifyCode, type ResendState, type VerifyState } from "./actions";
import { useDocumentTheme } from "../use-document-theme";
import { usePrefersReducedMotion } from "../use-reduced-motion";

// ---- clock ---------------------------------------------------------------

function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 1000);
  return () => window.clearInterval(id);
}
const readClock = () => Math.floor(Date.now() / 1000) * 1000;

function useNow(serverNow: number) {
  return React.useSyncExternalStore(subscribeClock, readClock, () => serverNow);
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const timeOfDay = (ms: number) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(ms);

// ---- redirects -------------------------------------------------------------

/** "NEXT_REDIRECT;replace;/bookings;307;" -> "/bookings" */
function redirectTarget(e: unknown): string | null {
  const digest = (e as { digest?: unknown } | null)?.digest;
  if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) return null;
  return digest.split(";")[2] ?? "";
}

type Verified = { verified?: boolean };
async function submitVerify(prev: VerifyState & Verified, form: FormData): Promise<VerifyState & Verified> {
  try {
    return await verifyCode(prev, form);
  } catch (e) {
    const to = redirectTarget(e);
    if (to === null) throw e;
    // Success goes into the console; a trip back to /login is not success.
    return to.startsWith("/login") ? { n: prev.n } : { n: prev.n, verified: true };
  }
}

async function submitResend(prev: ResendState, form: FormData): Promise<ResendState> {
  try {
    return await resendVerificationCode(prev, form);
  } catch (e) {
    if (redirectTarget(e) === null) throw e;
    return prev;
  }
}

// ---------------------------------------------------------------------------

export interface VerifyFormProps {
  destination: string;
  method: SignInMethod;
  channel: CodeChannel;
  view: ChallengeView | null;
  demo: boolean;
  demoCode: string | null;
  serverNow: number;
  /** A resend has happened on this ticket. */
  resent: boolean;
  maxAttempts: number;
  next?: string;
}

export function VerifyForm({ destination, method, channel, view, demo, demoCode, serverNow, resent, maxAttempts, next }: VerifyFormProps) {
  const [state, action, pending] = useActionState(submitVerify, {});
  const [resendState, resendAction, resending] = useActionState(submitResend, {});
  const now = useNow(serverNow);
  const reduce = usePrefersReducedMotion();
  const theme = useDocumentTheme();
  const formRef = React.useRef<HTMLFormElement>(null);
  const otpRef = React.useRef<OtpInputHandle>(null);

  const verified = !!state.verified;
  const busy = pending || verified;
  const ended = !view;

  const attemptsLeft = state.kind === "wrong" && state.attemptsLeft !== undefined ? Math.min(state.attemptsLeft, view?.attemptsLeft ?? 0) : view?.attemptsLeft ?? 0;
  const expired = !!view && now > view.expiresAt;
  const resendIn = view ? view.resendAt - now : 0;
  const canResend = !!view && view.resendsLeft > 0 && resendIn <= 0;

  const orbTheme = theme === "dark" ? "light" : "dark";
  const orbColor = theme === "dark" ? "#8a5410" : "#f3b340";
  const Channel = channel === "sms" ? MessageSquareText : Mail;

  const error = state.error && !pending ? state.error : expired && !state.error ? "This code has expired. Send a new one." : undefined;

  return (
    <div>
      <header>
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2">Step 2 of 2</p>
        <div className="mt-3 grid size-11 place-items-center rounded-[10px] bg-sunken text-ink ring-1 ring-inset ring-line">
          <Channel className="size-5" strokeWidth={1.75} aria-hidden />
        </div>
        <h1 className="font-display mt-3 text-[26px] font-semibold leading-[1.15] tracking-tight text-ink">Enter verification code</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
          {method === "phone" ? (
            <>
              If that number belongs to an operator, we&apos;ve sent a 6-digit code to <span className="num whitespace-nowrap text-ink">{destination}</span>.
            </>
          ) : (
            <>
              We sent a 6-digit code to <span className="num whitespace-nowrap text-ink">{destination}</span>.
            </>
          )}
        </p>
      </header>

      {demo && !ended ? (
        <div className="mt-5 rounded-[var(--radius-panel)] border border-dashed border-line-strong bg-sunken/70 px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12.5px] font-medium text-ink">Demo mode — no message was sent</p>
            <span className="rounded-full border border-dashed border-line-strong px-2 py-px text-[11px] font-medium uppercase tracking-[0.12em] text-ink-2">
              Demo
            </span>
          </div>
          {demoCode ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[13px] text-ink-2">
                Your code is{" "}
                <span className="num text-[16px] font-semibold tracking-[0.18em] text-ink" data-testid="demo-code">
                  {demoCode}
                </span>
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => otpRef.current?.fill(demoCode)}
                className="rounded-[var(--radius-control)] border border-line bg-surface px-2.5 py-1 text-[12.5px] font-medium text-ink transition-colors hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              >
                Fill in
              </button>
            </div>
          ) : (
            <p className="mt-1.5 text-[13px] leading-snug text-ink-2">
              No code to show. In demo mode a code appears here only when the number belongs to an operator.
            </p>
          )}
        </div>
      ) : null}

      {ended ? (
        <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-[var(--radius-panel)] bg-bad-soft px-3.5 py-3 text-[13px] leading-snug text-on-bad-soft ring-1 ring-inset ring-bad/25">
          <AlertCircle className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>This sign-in has ended. Start again to get a new code.</span>
        </div>
      ) : (
        <form ref={formRef} action={action} className="mt-6" noValidate>
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <OtpInput
            key={state.n ?? 0}
            ref={otpRef}
            name="code"
            autoFocus
            disabled={busy}
            invalid={!!state.error && !pending && state.kind !== "expired"}
            aria-describedby={error ? "code-error" : "code-help"}
            onComplete={() => {
              if (!busy) formRef.current?.requestSubmit();
            }}
          />

          <div className="mt-3 min-h-[20px]">
            <AnimatePresence mode="wait" initial={false}>
              {error ? (
                <motion.p
                  key={`${state.n}-${error}`}
                  id="code-error"
                  role="alert"
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.18 }}
                  className="flex items-start gap-1.5 text-[13px] text-bad"
                >
                  <AlertCircle className="mt-[2px] size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  <span>{error}</span>
                </motion.p>
              ) : (
                <motion.p
                  key="help"
                  id="code-help"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.18 }}
                  className="flex items-center gap-1.5 text-[13px] text-ink-2"
                >
                  <Clock3 className="size-3.5 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
                  <span>
                    Code expires in <span className="num text-ink">{mmss(view.expiresAt - now)}</span>
                    {attemptsLeft < maxAttempts ? (
                      <>
                        {" · "}
                        {attemptsLeft} attempt{attemptsLeft === 1 ? "" : "s"} left
                      </>
                    ) : null}
                  </span>
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <button
            type="submit"
            disabled={busy}
            aria-busy={pending || undefined}
            className={
              "group relative isolate mt-4 flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-[8px] border border-ink bg-ink px-5 " +
              "text-[14.5px] font-medium text-paper shadow-[inset_0_1px_0_oklch(1_0_0/0.14),0_1px_2px_oklch(var(--shadow-ink)/0.1),0_8px_20px_-8px_oklch(var(--shadow-ink)/0.45)] " +
              "transition-transform duration-150 ease-[var(--ease-out-quart)] active:scale-[0.985] disabled:cursor-default disabled:active:scale-100 " +
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
            }
          >
            <AnimatePresence mode="wait" initial={false}>
              {verified ? (
                <motion.span key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.2 }} className="flex items-center gap-2">
                  <span className="grid size-5 place-items-center rounded-full bg-accent text-accent-ink">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                  </span>
                  Verified. Opening the console
                </motion.span>
              ) : pending ? (
                <motion.span key="pending" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: reduce ? 0 : 0.16 }} className="flex items-center gap-2.5">
                  <ThinkingOrb state="solving" size={20} theme={orbTheme} color={orbColor} paused={reduce} aria-hidden />
                  Checking the code
                </motion.span>
              ) : (
                <motion.span key="idle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: reduce ? 0 : 0.16 }} className="flex items-center gap-2">
                  <ShieldCheck className="size-4" strokeWidth={1.75} aria-hidden />
                  Verify and sign in
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <p className="sr-only" aria-live="polite">
            {verified ? "Verified. Opening the console." : pending ? "Checking the code." : ""}
          </p>
        </form>
      )}

      {/* Resend + restart */}
      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
        {!ended ? (
          <form action={resendAction} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px]">
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <span className="text-ink-2">
              {resent ? (
                <>
                  New code sent at <span className="num text-ink">{timeOfDay(view.sentAt)}</span>.
                </>
              ) : (
                <>Didn&apos;t get it?</>
              )}
            </span>
            {view.resendsLeft === 0 ? (
              <span className="text-ink-2">No resends left</span>
            ) : canResend ? (
              <button
                type="submit"
                disabled={resending || busy}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-1.5 py-0.5 font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              >
                <RotateCw className={"size-3.5 " + (resending && !reduce ? "animate-spin" : "")} strokeWidth={1.75} aria-hidden />
                {resending ? "Sending" : "Resend code"}
                <span className="text-ink-2">({view.resendsLeft} left)</span>
              </button>
            ) : (
              <span className="text-ink-2" aria-live="off">
                Resend in <span className="num text-ink">{mmss(resendIn)}</span>
              </span>
            )}
            {resendState.error ? (
              <p role="alert" className="flex w-full items-start gap-1.5 text-[13px] text-bad">
                <AlertCircle className="mt-[2px] size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                {resendState.error}
              </p>
            ) : null}
          </form>
        ) : null}

        <form action={restartSignIn}>
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <button
            type="submit"
            className={
              ended
                ? "flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-ink bg-ink text-[14.5px] font-medium text-paper focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
                : "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-1.5 py-0.5 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            }
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden />
            {ended ? "Start again" : "Use a different method"}
          </button>
        </form>
      </div>
    </div>
  );
}
