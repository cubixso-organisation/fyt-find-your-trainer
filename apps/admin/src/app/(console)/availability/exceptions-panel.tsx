"use client";

import * as React from "react";
import { Ban, CalendarPlus, MapPin, Plus, Trash2, Video } from "lucide-react";
import type { AvailabilityException } from "@/lib/data/types";
import { Button, EmptyState, Field, Input, Panel, PanelHeader, Select } from "@/components/ui/primitives";
import { Segmented, ToggleRow } from "@/components/ui/choice";
import { ConfirmDialog, Drawer } from "@/components/ui/overlays";
import { Pill } from "@/components/ui/status";
import { useServerAction } from "@/components/ui/use-action";
import { solarIcon } from "@/components/icons/solar";
import { addDays, istEpoch } from "@/lib/slots";
import { fmtDate, minutesToLabel } from "@/lib/utils";
import { addAvailabilityException, removeAvailabilityException } from "./actions";

type TargetType = AvailabilityException["targetType"];

interface Draft {
  date: string;
  kind: "blocked" | "extra";
  wholeDay: boolean;
  start: string;
  end: string;
  slotMinutes: 30 | 45 | 60 | 90;
  mode: "online" | "offline";
  capacity: number;
  reason: string;
}

function fromTime(v: string) {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + (m || 0);
}
const dayLabel = (date: string) => fmtDate(istEpoch(date, 12 * 60), { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function ExceptionsPanel({
  target,
  exceptions,
  today,
}: {
  target: { id: string; type: TargetType; name: string };
  exceptions: AvailabilityException[];
  today: string;
}) {
  const isCourse = target.type === "course";
  const blank = (): Draft => ({
    date: addDays(today, 1),
    kind: "blocked",
    wholeDay: true,
    start: "10:00",
    end: "13:00",
    slotMinutes: isCourse ? 60 : 45,
    mode: "online",
    capacity: isCourse ? 5 : 1,
    reason: "",
  });
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [removing, setRemoving] = React.useState<AvailabilityException | null>(null);
  const { pending, run } = useServerAction();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const upcoming = exceptions.filter((x) => x.date >= today).sort((a, b) => a.date.localeCompare(b.date) || (a.startMinute ?? -1) - (b.startMinute ?? -1));
  const past = exceptions.length - upcoming.length;

  const submit = async () => {
    if (!draft) return;
    const timed = draft.kind === "extra" || !draft.wholeDay;
    const r = await run("add", () =>
      addAvailabilityException({
        targetType: target.type,
        targetId: target.id,
        date: draft.date,
        kind: draft.kind,
        startMinute: timed ? fromTime(draft.start) : undefined,
        endMinute: timed ? fromTime(draft.end) : undefined,
        ...(draft.kind === "extra" ? { slotMinutes: draft.slotMinutes, mode: draft.mode, capacity: isCourse ? draft.capacity : 1 } : {}),
        reason: draft.reason,
      }),
    );
    if (r.ok) setDraft(null);
  };

  return (
    <Panel>
      <PanelHeader
        title="Date exceptions"
        description="Holidays, leave and one-off windows. They override the weekly windows on that date only."
        actions={
          <Button size="sm" onClick={() => setDraft(blank())}>
            <CalendarPlus className="size-4" strokeWidth={1.6} /> Add exception
          </Button>
        }
      />
      {upcoming.length === 0 ? (
        <EmptyState
          icon={solarIcon("calendar-mark-bold-duotone")}
          title="No upcoming exceptions"
          body="The weekly windows apply every week. Block a holiday or leave, or open an extra window for a one-off date."
          className="py-8"
        />
      ) : (
        <ul className="divide-y divide-line">
          {upcoming.map((x) => {
            const whole = x.kind === "blocked" && x.startMinute === undefined;
            return (
              <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3">
                <span className="num w-[132px] shrink-0 text-[13px] font-medium text-ink">{dayLabel(x.date)}</span>
                {x.kind === "blocked" ? (
                  <Pill tone="bad" icon={Ban}>{whole ? "Blocked all day" : "Blocked"}</Pill>
                ) : (
                  <Pill tone="info" icon={Plus}>Extra window</Pill>
                )}
                {!whole ? (
                  <span className="num text-[12.5px] text-ink-2">
                    {minutesToLabel(x.startMinute!)}–{minutesToLabel(x.endMinute!)}
                  </span>
                ) : null}
                {x.kind === "extra" ? (
                  <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-3">
                    {x.mode === "offline" ? <MapPin className="size-3" strokeWidth={1.75} aria-hidden /> : <Video className="size-3" strokeWidth={1.75} aria-hidden />}
                    <span className="num">{x.slotMinutes} min</span>
                    {isCourse ? <span className="num">· {x.capacity} seats</span> : null}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{x.reason ?? ""}</span>
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Remove exception on ${x.date}`} onClick={() => setRemoving(x)}>
                  <Trash2 className="size-4" strokeWidth={1.6} />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {past ? <p className="border-t border-line px-5 py-2 text-[12px] text-ink-3">{past} past exception{past === 1 ? "" : "s"} kept for the audit trail.</p> : null}

      <Drawer
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title="Add date exception"
        description={`${target.name} · times in IST`}
        footer={
          draft ? (
            <>
              <Button variant="ghost" onClick={() => setDraft(null)}>Discard</Button>
              <Button variant="primary" loading={pending === "add"} onClick={submit}>
                {draft.kind === "blocked" ? "Block this time" : "Add extra window"}
              </Button>
            </>
          ) : null
        }
      >
        {draft ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(ev) => {
              ev.preventDefault();
              void submit();
            }}
          >
            <Field label="Type" htmlFor="exc-kind">
              <Segmented
                label="Exception type"
                value={draft.kind}
                onChange={(v) => set("kind", v)}
                options={[
                  { value: "blocked", label: "Block time off" },
                  { value: "extra", label: "Add extra window" },
                ]}
              />
            </Field>
            <Field label="Date" htmlFor="exc-date" hint={dayLabel(draft.date)}>
              <Input id="exc-date" type="date" min={today} max={addDays(today, 365)} value={draft.date} onChange={(ev) => ev.target.value && set("date", ev.target.value)} className="num w-[180px]" />
            </Field>
            {draft.kind === "blocked" ? (
              <div className="rounded-[var(--radius-panel)] border border-line">
                <ToggleRow
                  label="Whole day"
                  body="Holiday or leave: no slots on this date."
                  checked={draft.wholeDay}
                  onChange={(v) => set("wholeDay", v)}
                />
              </div>
            ) : null}
            {draft.kind === "extra" || !draft.wholeDay ? (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="From" htmlFor="exc-start">
                  <Input id="exc-start" type="time" step={900} value={draft.start} onChange={(ev) => set("start", ev.target.value)} className="num w-[128px]" />
                </Field>
                <Field label="To" htmlFor="exc-end">
                  <Input id="exc-end" type="time" step={900} value={draft.end} onChange={(ev) => set("end", ev.target.value)} className="num w-[128px]" />
                </Field>
              </div>
            ) : null}
            {draft.kind === "extra" ? (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Slot length" htmlFor="exc-slot">
                  <Select id="exc-slot" value={draft.slotMinutes} onChange={(ev) => set("slotMinutes", Number(ev.target.value) as Draft["slotMinutes"])} className="w-[112px]">
                    {[30, 45, 60, 90].map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Mode" htmlFor="exc-mode">
                  <Select id="exc-mode" value={draft.mode} onChange={(ev) => set("mode", ev.target.value as Draft["mode"])} className="w-[128px]">
                    <option value="online">Online</option>
                    <option value="offline">In person</option>
                  </Select>
                </Field>
                {isCourse ? (
                  <Field label="Seats" htmlFor="exc-cap">
                    <Input id="exc-cap" type="number" min={1} max={50} value={draft.capacity} onChange={(ev) => set("capacity", Number(ev.target.value))} className="num w-20" />
                  </Field>
                ) : null}
              </div>
            ) : null}
            {draft.kind === "extra" || !draft.wholeDay ? (
              <p className="-mt-2 text-[12.5px] text-ink-3">
                {(() => {
                  const s = fromTime(draft.start);
                  const e = fromTime(draft.end);
                  if (e <= s) return "The end time must be after the start time.";
                  if (draft.kind === "blocked") return `Slots overlapping ${minutesToLabel(s)}–${minutesToLabel(e)} are hidden from learners.`;
                  const n = Math.floor((e - s) / draft.slotMinutes);
                  return n > 0 ? `${n} slot${n === 1 ? "" : "s"} of ${draft.slotMinutes} min from ${minutesToLabel(s)}.` : "Window too short for one slot.";
                })()}
              </p>
            ) : null}
            <Field label="Reason" htmlFor="exc-reason" optional hint="Shown to operators here and in the audit log, not to learners.">
              <Input id="exc-reason" value={draft.reason} maxLength={120} onChange={(ev) => set("reason", ev.target.value)} placeholder={draft.kind === "blocked" ? "Dussehra holiday" : "Weekend walk-in demo"} />
            </Field>
            <p className="text-[12.5px] text-ink-3">Blocking time never cancels existing bookings. If any fall inside, you&apos;ll be told how many so you can reschedule them.</p>
          </form>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this exception?"
        body={
          removing
            ? removing.kind === "extra"
              ? `The extra window on ${dayLabel(removing.date)} closes. Existing bookings in it stay as they are.`
              : `${dayLabel(removing.date)} goes back to the weekly windows and its slots become bookable again.`
            : null
        }
        confirmLabel="Remove exception"
        loading={pending === "remove"}
        onConfirm={async () => {
          if (!removing) return;
          await run("remove", () => removeAvailabilityException({ id: removing.id }));
          setRemoving(null);
        }}
      />
    </Panel>
  );
}
