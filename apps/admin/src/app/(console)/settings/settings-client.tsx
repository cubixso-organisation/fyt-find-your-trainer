"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Plus, X } from "lucide-react";
import { Button, Field, Input, Panel, PanelHeader } from "@/components/ui/primitives";
import { useServerAction } from "@/components/ui/use-action";
import { cn } from "@/lib/utils";
import { saveSettings } from "./actions";

type S = {
  platformName: string;
  supportEmail: string;
  bookingLeadHours: number;
  cancellationWindowHours: number;
  reminderMinutes: number[];
  meetProvider: "google_workspace" | "oauth_account";
};

export function SettingsClient({ initial, maintenance, isOwner }: { initial: S; maintenance: boolean; isOwner: boolean }) {
  const [s, setS] = React.useState<S>(initial);
  const { pending, run } = useServerAction();
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const set = <K extends keyof S>(k: K, v: S[K]) => setS((c) => ({ ...c, [k]: v }));

  return (
    <div className="flex max-w-[860px] flex-col gap-6 pb-20">
      {maintenance ? (
        <div role="status" className="flex items-start gap-3 rounded-[var(--radius-panel)] bg-warn-soft px-4 py-3 text-[13px] text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={1.75} aria-hidden />
          <p>
            Maintenance mode is on: the app is not taking new bookings.{" "}
            {isOwner ? <Link href="/ownership" className="font-medium underline underline-offset-4">Turn it off in Ownership</Link> : "Only the owner can turn it off."}
          </p>
        </div>
      ) : null}

      <Panel>
        <PanelHeader title="General" />
        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Platform name" htmlFor="pname" hint="Shown in emails and push notifications.">
            <Input id="pname" value={s.platformName} onChange={(e) => set("platformName", e.target.value)} />
          </Field>
          <Field label="Support email" htmlFor="semail" hint="Learners reply here from booking emails.">
            <Input id="semail" type="email" value={s.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Booking rules" description="Applied by the booking Cloud Function, so the app can't bypass them." />
        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Minimum notice (hours)" htmlFor="lead" hint="Learners can't book a slot starting sooner than this.">
            <Input id="lead" type="number" min={0} max={168} value={s.bookingLeadHours} onChange={(e) => set("bookingLeadHours", Number(e.target.value))} className="num" />
          </Field>
          <Field label="Learner cancellation cutoff (hours)" htmlFor="cancel" hint="After this, only operators can cancel.">
            <Input id="cancel" type="number" min={0} max={72} value={s.cancellationWindowHours} onChange={(e) => set("cancellationWindowHours", Number(e.target.value))} className="num" />
          </Field>
          <Field label="Reminder pushes (minutes before)" htmlFor="rem" className="sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              {s.reminderMinutes.map((m, i) => (
                <span key={i} className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-control)] border border-line bg-surface pl-2 pr-1">
                  <input
                    aria-label={`Reminder ${i + 1} minutes`}
                    type="number"
                    min={5}
                    max={1440}
                    value={m}
                    onChange={(e) => set("reminderMinutes", s.reminderMinutes.map((x, j) => (j === i ? Number(e.target.value) : x)))}
                    className="num w-16 bg-transparent text-sm outline-none"
                  />
                  <span className="text-[12.5px] text-ink-3">min</span>
                  <button
                    type="button"
                    aria-label="Remove reminder"
                    disabled={s.reminderMinutes.length === 1}
                    onClick={() => set("reminderMinutes", s.reminderMinutes.filter((_, j) => j !== i))}
                    className="grid size-6 place-items-center rounded text-ink-3 hover:text-ink disabled:opacity-40"
                  >
                    <X className="size-3.5" strokeWidth={1.75} />
                  </button>
                </span>
              ))}
              {s.reminderMinutes.length < 3 ? (
                <Button size="sm" variant="ghost" onClick={() => set("reminderMinutes", [...s.reminderMinutes, 30])}>
                  <Plus className="size-3.5" strokeWidth={1.75} /> Add reminder
                </Button>
              ) : null}
            </div>
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Google Meet links" description="How the platform creates a Meet link for each online booking." />
        <div className="flex flex-col gap-3 px-5 py-5">
          {(
            [
              ["google_workspace", "Google Workspace (recommended)", "Links are created by a Workspace service account with domain-wide delegation. Most reliable; needs a Workspace subscription in the client's name."],
              ["oauth_account", "Dedicated Google account", "Links are created as one dedicated Google account using a stored OAuth token. No subscription, but the token must be renewed if the password changes."],
            ] as const
          ).map(([value, label, body]) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-[var(--radius-panel)] border px-4 py-3 transition-colors",
                s.meetProvider === value ? "border-ink bg-sunken/60" : "border-line hover:border-line-strong",
              )}
            >
              <input type="radio" name="meet" className="mt-1 accent-[var(--ink)]" checked={s.meetProvider === value} onChange={() => set("meetProvider", value)} />
              <span>
                <span className="block text-[13.5px] font-medium text-ink">{label}</span>
                <span className="block text-[12.5px] text-ink-2">{body}</span>
              </span>
            </label>
          ))}
        </div>
      </Panel>

      <div
        className={cn(
          "fixed bottom-5 left-1/2 z-30 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-[var(--radius-overlay)] border border-line bg-raised px-4 py-2.5 shadow-[var(--shadow-overlay)] transition-[opacity,transform] duration-200",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
        aria-hidden={!dirty}
      >
        <span className="whitespace-nowrap text-[13px] text-ink-2">Unsaved changes</span>
        <Button variant="ghost" size="sm" onClick={() => setS(initial)}>Discard</Button>
        <Button variant="primary" size="sm" loading={pending === "save"} onClick={() => run("save", () => saveSettings(s))}>Save settings</Button>
      </div>
    </div>
  );
}
