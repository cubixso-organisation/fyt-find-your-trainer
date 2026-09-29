"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { login, type LoginState } from "./actions";

/** Staggered entrance, reusing the console's 200ms `rise`. */
const rise = (delayMs: number) => ({ animationDelay: `${delayMs}ms`, animationFillMode: "both" as const });

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="mt-7 flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[var(--radius-panel)] bg-bad-soft px-3.5 py-3 text-[13px] leading-snug text-on-bad-soft ring-1 ring-inset ring-bad/20"
        >
          <AlertCircle className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="animate-rise" style={rise(60)}>
        <Field label="Work email" htmlFor="email" error={state.fieldErrors?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoFocus
            defaultValue={state.email}
            placeholder="you@institute.in"
            aria-invalid={!!state.fieldErrors?.email}
            aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
            className="h-11 px-3.5 text-[15px]"
          />
        </Field>
      </div>

      <div className="animate-rise" style={rise(110)}>
        <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              aria-invalid={!!state.fieldErrors?.password}
              aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
              className="h-11 pl-3.5 pr-12 text-[15px]"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
              className="absolute inset-y-0 right-1.5 my-auto grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-3 transition-colors duration-150 hover:bg-sunken hover:text-ink"
            >
              {show ? (
                <EyeOff className="size-[18px]" strokeWidth={1.5} aria-hidden />
              ) : (
                <Eye className="size-[18px]" strokeWidth={1.5} aria-hidden />
              )}
            </button>
          </div>
        </Field>
      </div>

      <div className="animate-rise mt-1" style={rise(160)}>
        <Button type="submit" variant="primary" size="lg" loading={pending} className="group w-full justify-center">
          {pending ? "Signing in" : "Sign in"}
          {pending ? null : (
            <ArrowRight
              className="size-4 transition-transform duration-150 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5"
              strokeWidth={1.75}
              aria-hidden
            />
          )}
        </Button>
      </div>
    </form>
  );
}
