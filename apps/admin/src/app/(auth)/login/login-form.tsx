"use client";

/**
 * Sign-in form. The server action (`login` in ./actions.ts) and its
 * `LoginState` contract are untouched: fields `email`, `password`, `next`;
 * errors come back as `error` / `fieldErrors`; success is a server redirect.
 *
 * Client-side polish layered on top:
 * - inline validation on blur and before submit (same messages as the schema)
 * - show / hide password and a Caps Lock warning (icon + text)
 * - a gentle shake on any error (skipped under reduced motion)
 * - ThinkingOrb in the submit button while the action runs
 * - a short "Signed in" moment: the action's redirect reaches the client as
 *   a NEXT_REDIRECT rejection while the router is already navigating, so the
 *   wrapper below catches exactly that, flags success and lets the router
 *   carry on. Any other error is rethrown.
 * - demo mode: role cards that fill the form (never submit it)
 */
import * as React from "react";
import { useActionState, useState } from "react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  AtSign,
  Check,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  TriangleAlert,
  UserCog,
} from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { Field, Input } from "@/components/ui/primitives";
import { login, type LoginState } from "./actions";
import { useDocumentTheme } from "./use-document-theme";
import { usePrefersReducedMotion } from "./use-reduced-motion";

type FormState = LoginState & { signedIn?: boolean };

/** Staggered entrance, reusing the console's 200ms `rise`. */
const rise = (delayMs: number) => ({ animationDelay: `${delayMs}ms`, animationFillMode: "both" as const });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailMessage = (v: string) => (v.trim() === "" ? "Enter your work email." : EMAIL_RE.test(v.trim()) ? undefined : "Enter a valid work email.");

const DEMO_PASSWORD = "Operator@2026";
const DEMO_ROLES = [
  { key: "owner", label: "Owner", email: "owner@demo.local", icon: Crown, sees: "Everything, including ownership transfer and force sign-out." },
  { key: "super", label: "Super admin", email: "super@demo.local", icon: ShieldCheck, sees: "Runs the team: invites, roles, audit log and platform settings." },
  { key: "admin", label: "Admin", email: "admin@demo.local", icon: UserCog, sees: "Day-to-day operations: bookings, availability and the catalogue." },
] as const;

function isRedirect(e: unknown) {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

async function submit(prev: FormState, form: FormData): Promise<FormState> {
  try {
    return await login(prev, form);
  } catch (e) {
    if (isRedirect(e)) return { email: String(form.get("email") ?? ""), signedIn: true };
    throw e;
  }
}

export function LoginForm({ next, demo }: { next?: string; demo?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submit, {});
  const reduce = usePrefersReducedMotion();
  const theme = useDocumentTheme();
  const [scope, animate] = useAnimate<HTMLFormElement>();

  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const submitRef = React.useRef<HTMLButtonElement>(null);

  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [emailErr, setEmailErr] = useState<string>();
  const [passwordErr, setPasswordErr] = useState<string>();
  const [emailOk, setEmailOk] = useState(false);
  const [picked, setPicked] = useState<string>();

  const shake = React.useCallback(() => {
    if (reduce || !scope.current) return;
    animate(scope.current, { x: [0, -9, 8, -6, 4, -2, 0] }, { duration: 0.42, ease: "easeOut" });
  }, [animate, reduce, scope]);

  // Shake when the server answers with an error (animation only, no state).
  React.useEffect(() => {
    if (state.error || state.fieldErrors) shake();
  }, [state, shake]);

  const shownEmailErr = emailErr ?? state.fieldErrors?.email;
  const shownPasswordErr = passwordErr ?? state.fieldErrors?.password;
  const done = !!state.signedIn;
  const busy = pending || done;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const email = emailRef.current?.value ?? "";
    const password = passwordRef.current?.value ?? "";
    const eErr = emailMessage(email);
    const pErr = password ? undefined : "Enter your password.";
    setEmailErr(eErr);
    setPasswordErr(pErr);
    if (eErr || pErr) {
      e.preventDefault();
      (eErr ? emailRef : passwordRef).current?.focus();
      shake();
    }
  };

  const onCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState("CapsLock"));

  const fill = (role: (typeof DEMO_ROLES)[number]) => {
    if (emailRef.current) emailRef.current.value = role.email;
    if (passwordRef.current) passwordRef.current.value = DEMO_PASSWORD;
    setEmailErr(undefined);
    setPasswordErr(undefined);
    setEmailOk(true);
    setPicked(role.key);
    submitRef.current?.focus();
  };

  // The orb sits on the ink button, which is dark in light mode and light in dark mode.
  const orbTheme = theme === "dark" ? "light" : "dark";
  const orbColor = theme === "dark" ? "#8a5410" : "#f3b340";

  return (
    <>
      <motion.form ref={scope} action={action} onSubmit={onSubmit} className="mt-7 flex flex-col gap-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <AnimatePresence initial={false}>
          {state.error && !pending ? (
            <motion.div
              key={state.error}
              role="alert"
              initial={{ opacity: 0, height: 0, y: -4 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: reduce ? 0 : 0.24, ease: [0.25, 1, 0.5, 1] }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-2.5 rounded-[var(--radius-panel)] bg-bad-soft px-3.5 py-3 text-[13px] leading-snug text-on-bad-soft ring-1 ring-inset ring-bad/25">
                <AlertCircle className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden />
                <span>{state.error}</span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="animate-rise" style={rise(60)}>
          <Field label="Work email" htmlFor="email" error={shownEmailErr}>
            <div className="group relative">
              <AtSign
                aria-hidden
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-ink-3 transition-colors duration-150 group-focus-within:text-ink"
              />
              <Input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                autoFocus
                spellCheck={false}
                disabled={busy}
                defaultValue={state.email}
                placeholder="you@institute.in"
                onBlur={(e) => {
                  const v = e.currentTarget.value;
                  if (v) setEmailErr(emailMessage(v));
                }}
                onChange={(e) => {
                  const ok = !emailMessage(e.currentTarget.value);
                  setEmailOk(ok);
                  if (emailErr && ok) setEmailErr(undefined);
                  setPicked(undefined);
                }}
                aria-invalid={!!shownEmailErr}
                aria-describedby={shownEmailErr ? "email-error" : undefined}
                className="h-12 rounded-[8px] pl-10 pr-10 text-[15px] focus-visible:ring-4 focus-visible:ring-accent/20"
              />
              <AnimatePresence>
                {emailOk && !shownEmailErr ? (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: reduce ? 0 : 0.18 }}
                    aria-hidden
                    className="absolute right-3 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-ok-soft text-on-ok-soft"
                  >
                    <Check className="size-3" strokeWidth={2.5} />
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </div>
          </Field>
        </div>

        <div className="animate-rise" style={rise(110)}>
          <Field label="Password" htmlFor="password" error={shownPasswordErr}>
            <div className="group relative">
              <KeyRound
                aria-hidden
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-ink-3 transition-colors duration-150 group-focus-within:text-ink"
              />
              <Input
                ref={passwordRef}
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                disabled={busy}
                onKeyDown={onCaps}
                onKeyUp={onCaps}
                onBlur={() => setCaps(false)}
                onChange={(e) => {
                  if (passwordErr && e.currentTarget.value) setPasswordErr(undefined);
                  setPicked(undefined);
                }}
                aria-invalid={!!shownPasswordErr}
                aria-describedby={
                  [shownPasswordErr ? "password-error" : "", caps ? "caps-warning" : ""].filter(Boolean).join(" ") || undefined
                }
                className="h-12 rounded-[8px] pl-10 pr-12 text-[15px] focus-visible:ring-4 focus-visible:ring-accent/20"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                aria-pressed={show}
                disabled={busy}
                className="absolute inset-y-0 right-1.5 my-auto grid size-9 place-items-center rounded-[var(--radius-control)] text-ink-3 transition-colors duration-150 hover:bg-sunken hover:text-ink"
              >
                {show ? (
                  <EyeOff className="size-[18px]" strokeWidth={1.5} aria-hidden />
                ) : (
                  <Eye className="size-[18px]" strokeWidth={1.5} aria-hidden />
                )}
              </button>
            </div>
            <AnimatePresence initial={false}>
              {caps ? (
                <motion.p
                  id="caps-warning"
                  role="status"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduce ? 0 : 0.18 }}
                  className="overflow-hidden"
                >
                  <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-[12px] font-medium text-on-warn-soft">
                    <TriangleAlert className="size-3.5" strokeWidth={2} aria-hidden />
                    Caps Lock is on
                  </span>
                </motion.p>
              ) : null}
            </AnimatePresence>
          </Field>
        </div>

        <div className="animate-rise mt-1.5" style={rise(160)}>
          <button
            ref={submitRef}
            type="submit"
            disabled={busy}
            aria-busy={pending || undefined}
            className={
              "group relative isolate flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-[8px] border border-ink bg-ink px-5 " +
              "text-[15px] font-medium text-paper shadow-[inset_0_1px_0_oklch(1_0_0/0.14),0_1px_2px_oklch(var(--shadow-ink)/0.1),0_8px_20px_-8px_oklch(var(--shadow-ink)/0.45)] " +
              "transition-[transform,box-shadow,background-color] duration-150 ease-[var(--ease-out-quart)] " +
              "hover:shadow-[inset_0_1px_0_oklch(1_0_0/0.14),0_1px_2px_oklch(var(--shadow-ink)/0.1),0_12px_28px_-10px_oklch(var(--shadow-ink)/0.55)] " +
              "active:scale-[0.985] disabled:cursor-default disabled:active:scale-100"
            }
          >
            {/* Marigold sheen that sweeps across on hover */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/2 -z-10 w-1/2 -skew-x-12 bg-[linear-gradient(90deg,transparent,color-mix(in_oklch,var(--accent)_28%,transparent),transparent)] opacity-0 transition-[transform,opacity] duration-700 ease-[var(--ease-out-quart)] group-hover:translate-x-[300%] group-hover:opacity-100 group-disabled:hidden"
            />
            <AnimatePresence mode="wait" initial={false}>
              {done ? (
                <motion.span
                  key="done"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduce ? 0 : 0.2 }}
                  className="flex items-center gap-2"
                >
                  <motion.span
                    initial={{ scale: reduce ? 1 : 0.4 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 18 }}
                    className="grid size-5 place-items-center rounded-full bg-accent text-accent-ink"
                  >
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                  </motion.span>
                  Signed in. Opening the console
                </motion.span>
              ) : pending ? (
                <motion.span
                  key="pending"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: reduce ? 0 : 0.16 }}
                  className="flex items-center gap-2.5"
                >
                  <ThinkingOrb state="connecting" size={20} theme={orbTheme} color={orbColor} paused={reduce} aria-hidden />
                  Signing in
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: reduce ? 0 : 0.16 }}
                  className="flex items-center gap-2"
                >
                  Sign in
                  <ArrowRight
                    className="size-4 transition-transform duration-150 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <p className="sr-only" aria-live="polite">
            {done ? "Signed in. Opening the console." : pending ? "Signing in." : ""}
          </p>
        </div>
      </motion.form>

      {demo ? (
        <section aria-labelledby="demo-heading" className="animate-rise mt-7" style={rise(230)}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="demo-heading" className="text-[12.5px] font-medium text-ink">
              Demo accounts
            </h2>
            <p className="text-[12px] text-ink-2">
              Fills the form · password <span className="num text-ink">{DEMO_PASSWORD}</span>
            </p>
          </div>
          <ul className="mt-2.5 flex flex-col gap-2">
            {DEMO_ROLES.map((role) => {
              const Icon = role.icon;
              const on = picked === role.key;
              return (
                <li key={role.key}>
                  <button
                    type="button"
                    onClick={() => fill(role)}
                    disabled={busy}
                    aria-pressed={on}
                    className={
                      "group flex w-full items-start gap-3 rounded-[var(--radius-panel)] border px-3 py-2.5 text-left " +
                      "transition-[border-color,background-color,box-shadow,transform] duration-150 ease-[var(--ease-out-quart)] active:scale-[0.99] disabled:opacity-60 " +
                      (on
                        ? "border-accent bg-accent-soft/50 shadow-[0_0_0_3px_color-mix(in_oklch,var(--accent)_22%,transparent)]"
                        : "border-line bg-surface/70 hover:border-line-strong hover:bg-surface")
                    }
                  >
                    <span
                      className={
                        "mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] transition-colors duration-150 " +
                        (on ? "bg-accent text-accent-ink" : "bg-sunken text-ink-2 ring-1 ring-inset ring-line group-hover:text-ink")
                      }
                    >
                      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[13px] font-medium text-ink">{role.label}</span>
                        <span className="num truncate text-[11.5px] text-ink-2">{role.email}</span>
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-ink-2">{role.sees}</span>
                    </span>
                    <span
                      aria-hidden
                      className={
                        "mt-1 grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150 " +
                        (on ? "border-accent bg-accent text-accent-ink" : "border-line-strong text-transparent")
                      }
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
