"use client";

import * as React from "react";
import { KeyRound, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import type { Role } from "@/lib/rbac";
import { Button, Field, Input, Panel, PanelHeader } from "@/components/ui/primitives";
import { RoleBadge } from "@/components/ui/status";
import { useServerAction } from "@/components/ui/use-action";
import { fmtDateTime } from "@/lib/utils";
import { changePassword, signOutOtherDevices, updateProfile } from "./actions";

export function ProfileClient({
  name: n0,
  email,
  phone: p0,
  role,
  lastLoginAt,
  modules,
}: {
  name: string;
  email: string;
  phone: string;
  role: Role;
  lastLoginAt?: number;
  modules: string[];
}) {
  const [name, setName] = React.useState(n0);
  const [phone, setPhone] = React.useState(p0);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirmNext, setConfirmNext] = React.useState("");
  const { pending, run } = useServerAction();
  const mismatch = confirmNext.length > 0 && next !== confirmNext;

  return (
    <div className="grid max-w-[1000px] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-6">
        <Panel>
          <PanelHeader title="Your details" />
          <form className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
            <Field label="Full name" htmlFor="pn">
              <Input id="pn" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label="Phone" htmlFor="pp" optional>
              <Input id="pp" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="num" autoComplete="tel" />
            </Field>
            <Field label="Work email" htmlFor="pe" hint="Ask a super admin to change your sign-in email." className="sm:col-span-2">
              <Input id="pe" value={email} disabled className="num" />
            </Field>
            <div className="sm:col-span-2">
              <Button
                variant="primary"
                disabled={name === n0 && phone === p0}
                loading={pending === "profile"}
                onClick={() => run("profile", () => updateProfile({ name, phone }))}
              >
                Save details
              </Button>
            </div>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="Password" description="At least 12 characters with upper and lower case letters and a number." />
          <form
            className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await run("pw", () => changePassword({ current, next }));
              if (r.ok) {
                setCurrent("");
                setNext("");
                setConfirmNext("");
              }
            }}
          >
            <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
            <Field label="Current password" htmlFor="cur" className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
              <Input id="cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field label="New password" htmlFor="new">
              <Input id="new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <Field label="Repeat new password" htmlFor="rep" error={mismatch ? "Passwords don't match." : undefined}>
              <Input id="rep" type="password" autoComplete="new-password" value={confirmNext} aria-invalid={mismatch} onChange={(e) => setConfirmNext(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" variant="primary" disabled={!current || !next || mismatch || next !== confirmNext} loading={pending === "pw"}>
                <KeyRound className="size-4" strokeWidth={1.75} /> Change password
              </Button>
            </div>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="Two-step verification" />
          <div className="flex items-start gap-3 px-5 py-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-sunken text-ink-2">
              <Smartphone className="size-4" strokeWidth={1.6} aria-hidden />
            </span>
            <div className="text-[13px]">
              <p className="font-medium text-ink">Authenticator app and Google sign-in are coming next</p>
              <p className="mt-0.5 text-ink-2">
                They switch on with Firebase Auth. Owners and super admins will be required to enrol; admins will be prompted.
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-6">
        <Panel>
          <PanelHeader title="Your access" />
          <div className="flex flex-col gap-3 px-5 py-4">
            <RoleBadge role={role} className="self-start" />
            <ul className="flex flex-wrap gap-1.5">
              {modules.map((m) => (
                <li key={m} className="rounded-[4px] bg-sunken px-1.5 py-0.5 text-[12px] text-ink-2">{m}</li>
              ))}
            </ul>
            {role === "admin" ? <p className="text-[12.5px] text-ink-3">Need another module? Ask a super admin.</p> : null}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Sessions" />
          <div className="flex flex-col gap-3 px-5 py-4 text-[13px]">
            <p className="flex items-center gap-2 text-ink-2">
              <ShieldCheck className="size-4 text-ok" strokeWidth={1.75} aria-hidden />
              {lastLoginAt ? <>This session started <span className="num text-ink">{fmtDateTime(lastLoginAt)}</span></> : "Signed in"}
            </p>
            <p className="text-ink-3">Sessions end after 35 minutes without activity.</p>
            <Button size="sm" className="self-start" loading={pending === "others"} onClick={() => run("others", signOutOtherDevices)}>
              <LogOut className="size-3.5" strokeWidth={1.75} /> Sign out other devices
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
