"use client";

/**
 * Step 1 of sign-in, in the "Auth Page" column order (see ./auth-shell.tsx):
 * social button, "or" separator, then the methods.
 *
 *  - Google: shown but disabled, with the reason, until an OAuth client
 *    exists (src/lib/auth/oauth-google.ts). Never faked.
 *  - Email: work email + password -> `login` (./actions.ts). A correct
 *    password earns a 6-digit code by email, not a session.
 *  - Phone: Indian mobile -> `startPhoneLogin`. Same answer for every
 *    well-formed number; only operators' numbers get a real code.
 *
 * Both server actions end in a redirect to /login/verify. That redirect
 * reaches the client as a NEXT_REDIRECT rejection while the router is already
 * navigating, so `withRedirect` flags success for a short "Code sent" moment
 * and lets the router carry on. Any other error is rethrown.
 *
 * Kept from the previous form: inline validation, show / hide password, the
 * Caps Lock warning, a shake on error (not under reduced motion), ThinkingOrb
 * while pending, and demo quick-fill cards that fill (never submit) a form.
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
  Mail,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  UserCog,
} from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { Field, Input } from "@/components/ui/primitives";
import { normalizeIndianPhone } from "@/lib/auth/identifiers";
import { login, startPhoneLogin, type LoginState, type PhoneState } from "./actions";
import { useDocumentTheme } from "./use-document-theme";
import { usePrefersReducedMotion } from "./use-reduced-motion";

type Method = "email" | "phone";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailMessage = (v: string) => (v.trim() === "" ? "Enter your work email." : EMAIL_RE.test(v.trim()) ? undefined : "Enter a valid work email.");
const phoneMessage = (v: string) =>
  v.trim() === "" ? "Enter your mobile number." : normalizeIndianPhone(v) ? undefined : "Enter a 10-digit Indian mobile number.";

const DEMO_PASSWORD = "Operator@2026";
const DEMO_ROLES = [
  { key: "owner", label: "Owner", email: "owner@demo.local", phone: "+91 94405 62918", icon: Crown, sees: "Everything, including ownership transfer." },
  { key: "super", label: "Super admin", email: "super@demo.local", phone: "+91 98480 31764", icon: ShieldCheck, sees: "Team, roles, audit log and settings." },
  { key: "admin", label: "Admin", email: "admin@demo.local", phone: "+91 90002 47318", icon: UserCog, sees: "Bookings, availability and the catalogue." },
] as const;

function isRedirect(e: unknown) {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

type Sent = { sent?: boolean };
function withRedirect<S>(fn: (prev: S, form: FormData) => Promise<S>) {
  return async (prev: S & Sent, form: FormData): Promise<S & Sent> => {
    try {
      return (await fn(prev, form)) as S & Sent;
    } catch (e) {
      if (isRedirect(e)) return { ...prev, sent: true };
      throw e;
    }
  };
}
const submitLogin = withRedirect<LoginState>(login);
const submitPhone = withRedirect<PhoneState>(startPhoneLogin);

export interface GoogleStatus {
  enabled: boolean;
  reason: string;
}

export function LoginForm({ next, demo, google }: { next?: string; demo?: boolean; google: GoogleStatus }) {
  const [method, setMethod] = useState<Method>("email");
  const tabs = React.useRef<Record<Method, HTMLButtonElement | null>>({ email: null, phone: null });
  const reduce = usePrefersReducedMotion();

  const onTabKey = (e: React.KeyboardEvent) => {
    const order: Method[] = ["email", "phone"];
    const i = order.indexOf(method);
    let to: Method | null = null;
    if (e.key === "ArrowRight") to = order[(i + 1) % order.length];
    else if (e.key === "ArrowLeft") to = order[(i + order.length - 1) % order.length];
    else if (e.key === "Home") to = order[0];
    else if (e.key === "End") to = order[order.length - 1];
    if (!to) return;
    e.preventDefault();
    setMethod(to);
    tabs.current[to]?.focus();
  };

  return (
    <div className="mt-6">
      {/* Social: Google only, disabled until the OAuth client exists */}
      <button
        type="button"
        disabled={!google.enabled}
        aria-describedby="google-status"
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[8px] border border-line bg-surface text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-sunken disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-surface"
      >
        <GoogleGlyph className="size-4" />
        Continue with Google
      </button>
      <p id="google-status" className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-ink-2">
        <AlertCircle className="mt-px size-3.5 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
        {google.reason}
      </p>

      <div className="my-5 flex items-center gap-3" role="separator" aria-label="or">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-3">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* Method tabs */}
      <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 rounded-[10px] bg-sunken p-1 ring-1 ring-inset ring-line">
        {(
          [
            { key: "email", label: "Email", icon: Mail },
            { key: "phone", label: "Phone", icon: Smartphone },
          ] as const
        ).map(({ key, label, icon: Icon }) => {
          const on = method === key;
          return (
            <button
              key={key}
              ref={(el) => {
                tabs.current[key] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={on}
              aria-controls={`panel-${key}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setMethod(key)}
              onKeyDown={onTabKey}
              className={
                "relative flex h-9 items-center justify-center gap-2 rounded-[7px] text-[13.5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
                (on ? "text-ink" : "text-ink-2 hover:text-ink")
              }
            >
              {on ? (
                <motion.span
                  layoutId="login-method"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }}
                  className="absolute inset-0 rounded-[7px] bg-surface shadow-[0_1px_2px_oklch(var(--shadow-ink)/0.1)] ring-1 ring-inset ring-line"
                />
              ) : null}
              <Icon className="relative size-4" strokeWidth={1.75} aria-hidden />
              <span className="relative">{label}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="panel-email" aria-labelledby="tab-email" hidden={method !== "email"}>
        <EmailForm next={next} demo={demo} />
      </div>
      <div role="tabpanel" id="panel-phone" aria-labelledby="tab-phone" hidden={method !== "phone"}>
        <PhoneForm next={next} demo={demo} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function useShake() {
  const reduce = usePrefersReducedMotion();
  const [scope, animate] = useAnimate<HTMLFormElement>();
  const shake = React.useCallback(() => {
    if (reduce || !scope.current) return;
    animate(scope.current, { x: [0, -9, 8, -6, 4, -2, 0] }, { duration: 0.42, ease: "easeOut" });
  }, [animate, reduce, scope]);
  return { scope, shake };
}

function ErrorBanner({ message }: { message?: string }) {
  const reduce = usePrefersReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          key={message}
          role="alert"
          initial={{ opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: reduce ? 0 : 0.24, ease: [0.25, 1, 0.5, 1] }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-2.5 rounded-[var(--radius-panel)] bg-bad-soft px-3.5 py-3 text-[13px] leading-snug text-on-bad-soft ring-1 ring-inset ring-bad/25">
            <AlertCircle className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden />
            <span>{message}</span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SubmitButton({
  pending,
  sent,
  idle,
  busyLabel,
  buttonRef,
}: {
  pending: boolean;
  sent: boolean;
  idle: string;
  busyLabel: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  const reduce = usePrefersReducedMotion();
  const theme = useDocumentTheme();
  // The orb sits on the ink button: dark in light mode, light in dark mode.
  const orbTheme = theme === "dark" ? "light" : "dark";
  const orbColor = theme === "dark" ? "#8a5410" : "#f3b340";
  return (
    <>
      <button
        ref={buttonRef}
        type="submit"
        disabled={pending || sent}
        aria-busy={pending || undefined}
        className={
          "group relative isolate flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-[8px] border border-ink bg-ink px-5 " +
          "text-[14.5px] font-medium text-paper shadow-[inset_0_1px_0_oklch(1_0_0/0.14),0_1px_2px_oklch(var(--shadow-ink)/0.1),0_8px_20px_-8px_oklch(var(--shadow-ink)/0.45)] " +
          "transition-[transform,box-shadow] duration-150 ease-[var(--ease-out-quart)] active:scale-[0.985] disabled:cursor-default disabled:active:scale-100 " +
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {sent ? (
            <motion.span
              key="sent"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              className="flex items-center gap-2"
            >
              <span className="grid size-5 place-items-center rounded-full bg-accent text-accent-ink">
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
              </span>
              Code sent. Opening verification
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
              {busyLabel}
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
              {idle}
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
        {sent ? "Code sent. Opening verification." : pending ? `${busyLabel}.` : ""}
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------

function EmailForm({ next, demo }: { next?: string; demo?: boolean }) {
  const [state, action, pending] = useActionState(submitLogin, {} as LoginState & Sent);
  const { scope, shake } = useShake();
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const submitRef = React.useRef<HTMLButtonElement>(null);

  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [emailErr, setEmailErr] = useState<string>();
  const [passwordErr, setPasswordErr] = useState<string>();
  const [emailOk, setEmailOk] = useState(false);
  const [picked, setPicked] = useState<string>();
  const reduce = usePrefersReducedMotion();

  // Shake when the server answers with an error (animation only, no state).
  React.useEffect(() => {
    if (state.error || state.fieldErrors) shake();
  }, [state, shake]);

  const shownEmailErr = emailErr ?? state.fieldErrors?.email;
  const shownPasswordErr = passwordErr ?? state.fieldErrors?.password;
  const sent = !!state.sent;
  const busy = pending || sent;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const eErr = emailMessage(emailRef.current?.value ?? "");
    const pErr = passwordRef.current?.value ? undefined : "Enter your password.";
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

  return (
    <>
      <motion.form ref={scope} action={action} onSubmit={onSubmit} className="mt-4 flex flex-col gap-3.5" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <ErrorBanner message={state.error && !pending ? state.error : undefined} />

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
              className="h-11 rounded-[8px] pl-10 pr-10 text-[15px] focus-visible:ring-4 focus-visible:ring-accent/20"
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
              aria-describedby={[shownPasswordErr ? "password-error" : "", caps ? "caps-warning" : ""].filter(Boolean).join(" ") || undefined}
              className="h-11 rounded-[8px] pl-10 pr-12 text-[15px] focus-visible:ring-4 focus-visible:ring-accent/20"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
              disabled={busy}
              className="absolute inset-y-0 right-1.5 my-auto grid size-9 place-items-center rounded-[var(--radius-control)] text-ink-3 transition-colors duration-150 hover:bg-sunken hover:text-ink"
            >
              {show ? <EyeOff className="size-[18px]" strokeWidth={1.5} aria-hidden /> : <Eye className="size-[18px]" strokeWidth={1.5} aria-hidden />}
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

        <div className="mt-1">
          <SubmitButton pending={pending} sent={sent} idle="Continue with email" busyLabel="Checking your password" buttonRef={submitRef} />
        </div>
      </motion.form>

      {demo ? (
        <DemoCards
          title="Demo accounts"
          hint={
            <>
              password <span className="num text-ink">{DEMO_PASSWORD}</span>
            </>
          }
          detail={(r) => r.email}
          picked={picked}
          disabled={busy}
          onPick={fill}
        />
      ) : null}
    </>
  );
}

function PhoneForm({ next, demo }: { next?: string; demo?: boolean }) {
  const [state, action, pending] = useActionState(submitPhone, {} as PhoneState & Sent);
  const { scope, shake } = useShake();
  const phoneRef = React.useRef<HTMLInputElement>(null);
  const submitRef = React.useRef<HTMLButtonElement>(null);
  const [err, setErr] = useState<string>();
  const [picked, setPicked] = useState<string>();

  React.useEffect(() => {
    if (state.error || state.fieldError) shake();
  }, [state, shake]);

  const shownErr = err ?? state.fieldError;
  const sent = !!state.sent;
  const busy = pending || sent;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const m = phoneMessage(phoneRef.current?.value ?? "");
    setErr(m);
    if (m) {
      e.preventDefault();
      phoneRef.current?.focus();
      shake();
    }
  };

  const fill = (role: (typeof DEMO_ROLES)[number]) => {
    if (phoneRef.current) phoneRef.current.value = role.phone;
    setErr(undefined);
    setPicked(role.key);
    submitRef.current?.focus();
  };

  return (
    <>
      <motion.form ref={scope} action={action} onSubmit={onSubmit} className="mt-4 flex flex-col gap-3.5" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <ErrorBanner message={state.error && !pending ? state.error : undefined} />

        <Field
          label="Mobile number"
          htmlFor="phone"
          error={shownErr}
          hint="Indian mobile. If it's on an operator account, we'll text a 6-digit code."
        >
          <div className="group relative">
            <Smartphone
              aria-hidden
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-ink-3 transition-colors duration-150 group-focus-within:text-ink"
            />
            <Input
              ref={phoneRef}
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              spellCheck={false}
              maxLength={32}
              disabled={busy}
              defaultValue={state.phone}
              placeholder="+91 90002 47318"
              onBlur={(e) => {
                const v = e.currentTarget.value;
                if (v) setErr(phoneMessage(v));
              }}
              onChange={(e) => {
                if (err && !phoneMessage(e.currentTarget.value)) setErr(undefined);
                setPicked(undefined);
              }}
              aria-invalid={!!shownErr}
              aria-describedby={shownErr ? "phone-error" : undefined}
              className="num h-11 rounded-[8px] pl-10 text-[15px] focus-visible:ring-4 focus-visible:ring-accent/20"
            />
          </div>
        </Field>

        <div className="mt-1">
          <SubmitButton pending={pending} sent={sent} idle="Text me a code" busyLabel="Sending a code" buttonRef={submitRef} />
        </div>
      </motion.form>

      {demo ? (
        <DemoCards title="Demo numbers" hint="fills the form" detail={(r) => r.phone} picked={picked} disabled={busy} onPick={fill} />
      ) : null}
    </>
  );
}

function DemoCards({
  title,
  hint,
  detail,
  picked,
  disabled,
  onPick,
}: {
  title: string;
  hint: React.ReactNode;
  detail: (r: (typeof DEMO_ROLES)[number]) => string;
  picked?: string;
  disabled?: boolean;
  onPick: (r: (typeof DEMO_ROLES)[number]) => void;
}) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className="mt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-[12.5px] font-medium text-ink">
          {title}
        </h2>
        <p className="text-[12px] text-ink-2">{hint}</p>
      </div>
      <ul className="mt-2 grid grid-cols-3 gap-2">
        {DEMO_ROLES.map((role) => {
          const Icon = role.icon;
          const on = picked === role.key;
          return (
            <li key={role.key} className="min-w-0">
              <button
                type="button"
                onClick={() => onPick(role)}
                disabled={disabled}
                aria-pressed={on}
                title={role.sees}
                className={
                  "flex w-full min-w-0 flex-col items-start gap-1 rounded-[var(--radius-panel)] border px-2.5 py-2 text-left " +
                  "transition-[border-color,background-color,box-shadow] duration-150 ease-[var(--ease-out-quart)] disabled:opacity-60 " +
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
                  (on
                    ? "border-accent bg-accent-soft/50 shadow-[0_0_0_3px_color-mix(in_oklch,var(--accent)_22%,transparent)]"
                    : "border-line bg-surface/70 hover:border-line-strong hover:bg-surface")
                }
              >
                <span className="flex w-full items-center gap-1.5">
                  <Icon className={"size-3.5 shrink-0 " + (on ? "text-ink" : "text-ink-2")} strokeWidth={1.75} aria-hidden />
                  <span className="truncate text-[12.5px] font-medium text-ink">{role.label}</span>
                  {on ? <Check className="ml-auto size-3.5 shrink-0 text-ink" strokeWidth={2.5} aria-hidden /> : null}
                </span>
                <span className="block w-full truncate text-[12px] tabular-nums text-ink-2">{detail(role)}</span>
                <span className="sr-only">{role.sees}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Monochrome "G" (brand glyph in currentColor, to stay in the ink palette). */
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M21.35 11.1h-9.17v2.98h5.3c-.23 1.4-1.6 4.1-5.3 4.1-3.19 0-5.8-2.64-5.8-5.9s2.61-5.9 5.8-5.9c1.82 0 3.04.78 3.73 1.44l2.54-2.45C16.84 3.9 14.72 3 12.18 3 7.1 3 3 7.1 3 12.28s4.1 9.28 9.18 9.28c5.3 0 8.8-3.72 8.8-8.97 0-.6-.06-1.06-.13-1.5Z" />
    </svg>
  );
}
