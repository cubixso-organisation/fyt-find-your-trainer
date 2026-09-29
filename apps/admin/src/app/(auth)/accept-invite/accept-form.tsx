"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { acceptInvite, type AcceptState } from "./actions";

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptInvite, {});
  return (
    <form action={action} className="mt-7 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      {state.error ? (
        <div role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-bad-soft px-3 py-2.5 text-[13px] text-bad">
          <AlertCircle className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden />
          {state.error}
        </div>
      ) : null}
      <Field label="New password" htmlFor="password" hint="12+ characters, upper and lower case, and a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" className="h-11" required />
      </Field>
      <Field label="Repeat password" htmlFor="repeat">
        <Input id="repeat" name="repeat" type="password" autoComplete="new-password" className="h-11" required />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending} className="mt-1 w-full justify-center">
        Set password and continue
      </Button>
    </form>
  );
}
