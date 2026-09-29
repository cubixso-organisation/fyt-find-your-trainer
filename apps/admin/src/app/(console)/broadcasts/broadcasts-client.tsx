"use client";

import * as React from "react";
import { CalendarClock, Send } from "lucide-react";
import type { Broadcast } from "@/lib/data/types";
import { Button, EmptyState, Field, Input, Panel, PanelHeader, Textarea } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/overlays";
import { Pill } from "@/components/ui/status";
import { useServerAction } from "@/components/ui/use-action";
import { cn, fmtDateTime, fmtNumber, relTime } from "@/lib/utils";
import { cancelScheduledBroadcast, createBroadcast } from "../audience-actions";
import { solarIcon } from "@/components/icons/solar";

type Audience = "all" | "student" | "corporate";

export function BroadcastsClient({
  history,
  reach,
  platformName,
  now,
}: {
  history: Array<Broadcast & { createdByName: string }>;
  reach: Record<Audience, number>;
  platformName: string;
  now: number;
}) {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [audience, setAudience] = React.useState<Audience>("all");
  const [when, setWhen] = React.useState<"now" | "later">("now");
  const [at, setAt] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const { pending, run } = useServerAction();

  const scheduledFor = at ? Date.parse(at + ":00Z") - 5.5 * 3_600_000 : undefined;
  const valid = title.trim().length >= 4 && body.trim().length >= 10 && (when === "now" || !!scheduledFor);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Panel>
        <PanelHeader title="New broadcast" />
        <div className="grid grid-cols-1 gap-6 px-5 py-5 md:grid-cols-[minmax(0,1fr)_240px]">
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <Field label="Audience" htmlFor="aud" hint={<>Reaches <span className="num">{fmtNumber(reach[audience])}</span> learners with notifications on</>}>
              <Segmented
                label="Audience"
                value={audience}
                onChange={setAudience}
                options={[{ value: "all", label: "Everyone" }, { value: "student", label: "Students" }, { value: "corporate", label: "Corporate" }]}
              />
            </Field>
            <Field label="Title" htmlFor="btitle" hint={`${title.length}/50`}>
              <Input id="btitle" value={title} maxLength={50} onChange={(e) => setTitle(e.target.value)} placeholder="New AWS DevOps batch" />
            </Field>
            <Field label="Message" htmlFor="bbody" hint={`${body.length}/180`}>
              <Textarea id="bbody" value={body} maxLength={180} rows={3} onChange={(e) => setBody(e.target.value)} placeholder="Free demo sessions this Saturday. Book a slot in the app." />
            </Field>
            <Field label="Send" htmlFor="when">
              <div className="flex flex-wrap items-center gap-3">
                <Segmented label="Send time" value={when} onChange={setWhen} options={[{ value: "now", label: "Now" }, { value: "later", label: "Schedule" }]} />
                {when === "later" ? <Input type="datetime-local" aria-label="Send at (IST)" value={at} onChange={(e) => setAt(e.target.value)} className="w-auto" /> : null}
              </div>
            </Field>
            <div className="pt-1">
              <Button variant="primary" disabled={!valid} onClick={() => setConfirm(true)}>
                {when === "now" ? <Send className="size-4" strokeWidth={1.75} /> : <CalendarClock className="size-4" strokeWidth={1.75} />}
                {when === "now" ? "Send broadcast" : "Schedule broadcast"}
              </Button>
            </div>
          </form>

          <div aria-label="Notification preview" className="hidden md:block">
            <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">Lock screen preview</p>
            <div className="rounded-[22px] bg-[oklch(0.3_0.02_70)] p-3">
              <p className="num mb-3 text-center text-[26px] font-light text-[oklch(0.96_0.01_85)]">9:41</p>
              <div className="rounded-[14px] bg-[oklch(0.96_0.008_85/0.92)] p-2.5 shadow-sm">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="grid size-4 place-items-center rounded-[4px] bg-ink">
                    <span className="h-[3px] w-2 rounded bg-accent" />
                  </span>
                  <span className="truncate text-[10.5px] uppercase tracking-wide text-ink-2">{platformName}</span>
                  <span className="ml-auto text-[10.5px] text-ink-3">now</span>
                </div>
                <p className="truncate text-[12.5px] font-semibold text-ink">{title || "Title"}</p>
                <p className="line-clamp-3 text-[12px] leading-snug text-ink-2">{body || "Your message appears here."}</p>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="History" description="Sent and scheduled broadcasts" />
        {history.length === 0 ? (
          <EmptyState icon={solarIcon("bell-bing-bold-duotone")} title="Nothing sent yet" body="Your first broadcast will show here with its reach." />
        ) : (
          <ul className="divide-y divide-line">
            {history.map((b) => (
              <li key={b.id} className="flex flex-col gap-1.5 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{b.title}</p>
                  {b.status === "sent" ? (
                    <Pill tone="ok">Sent</Pill>
                  ) : b.status === "scheduled" ? (
                    <Pill tone="info" icon={CalendarClock}>Scheduled</Pill>
                  ) : (
                    <Pill>Draft</Pill>
                  )}
                </div>
                <p className="line-clamp-2 text-[13px] text-ink-2">{b.body}</p>
                <p className={cn("flex flex-wrap items-center gap-x-2 text-[12px] text-ink-3")}>
                  <span className="capitalize">{b.audience === "all" ? "Everyone" : b.audience === "student" ? "Students" : "Corporate"}</span>
                  <span aria-hidden>·</span>
                  {b.status === "sent" && b.sentAt ? (
                    <span title={fmtDateTime(b.sentAt)}>{relTime(b.sentAt, now)}, reached <span className="num">{b.reach}</span></span>
                  ) : b.scheduledFor ? (
                    <span className="num">{fmtDateTime(b.scheduledFor)}</span>
                  ) : (
                    <span>Not scheduled</span>
                  )}
                  <span aria-hidden>·</span>
                  <span>{b.createdByName}</span>
                  {b.status === "scheduled" ? (
                    <button className="ml-auto font-medium text-ink underline decoration-line-strong underline-offset-4" onClick={() => run(b.id, () => cancelScheduledBroadcast(b.id))}>
                      Withdraw
                    </button>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="primary"
        title={when === "now" ? `Send to ${fmtNumber(reach[audience])} learners?` : "Schedule this broadcast?"}
        body={when === "now" ? "Push notifications can't be recalled once sent." : "You can withdraw it from History any time before it goes out."}
        confirmLabel={when === "now" ? "Send now" : "Schedule"}
        loading={pending === "send"}
        onConfirm={async () => {
          const r = await run("send", () => createBroadcast({ title, body, audience, when, scheduledFor }));
          setConfirm(false);
          if (r.ok) {
            setTitle("");
            setBody("");
            setAt("");
          }
        }}
      />
    </div>
  );
}
