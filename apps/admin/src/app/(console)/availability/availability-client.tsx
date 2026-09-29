"use client";

import * as React from "react";
import { Copy, Plus, Search, Trash2 } from "lucide-react";
import type { AvailabilityException, AvailabilityRule } from "@/lib/data/types";
import type { SlotBooking } from "@/lib/slots";
import { Button, EmptyState, Input, Panel, PanelHeader, Select } from "@/components/ui/primitives";
import { useServerAction } from "@/components/ui/use-action";
import { cn, minutesToLabel } from "@/lib/utils";
import { saveAvailability } from "./actions";
import { solarIcon } from "@/components/icons/solar";
import { ExceptionsPanel } from "./exceptions-panel";
import { SlotPreview } from "./slot-preview";

type Target = { id: string; type: "course" | "trainer" | "mentor" | "consultant"; name: string; published: boolean };
type Draft = Omit<AvailabilityRule, "id" | "targetId" | "targetType">;

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAME = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TYPE_LABEL = { course: "Course", trainer: "Trainer", mentor: "Mentor", consultant: "Consultant" };

function toTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function fromTime(v: string) {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function AvailabilityClient({
  targets,
  rules,
  exceptions,
  bookings,
  leadHours,
  now,
  today,
  initialTarget,
}: {
  targets: Target[];
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  bookings: Array<SlotBooking & { targetId: string }>;
  leadHours: number;
  now: number;
  today: string;
  initialTarget?: string;
}) {
  const [targetId, setTargetId] = React.useState(initialTarget);
  const [q, setQ] = React.useState("");
  const target = targets.find((t) => t.id === targetId);
  const original = React.useMemo<Draft[]>(
    () =>
      rules
        .filter((r) => r.targetId === targetId)
        .map(({ weekday, startMinute, endMinute, slotMinutes, mode, capacity }) => ({ weekday, startMinute, endMinute, slotMinutes, mode, capacity })),
    [rules, targetId],
  );
  const [draft, setDraft] = React.useState<Draft[]>(original);
  const [base, setBase] = React.useState(original);
  if (base !== original) {
    setBase(original);
    setDraft(original);
  }
  const { pending, run } = useServerAction();
  const targetExceptions = React.useMemo(() => exceptions.filter((x) => x.targetId === targetId), [exceptions, targetId]);
  const targetBookings = React.useMemo(() => bookings.filter((b) => b.targetId === targetId), [bookings, targetId]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);

  const slotsPerWeek = draft.reduce((n, r) => n + Math.max(0, Math.floor((r.endMinute - r.startMinute) / r.slotMinutes)) * r.capacity, 0);
  const counts = new Map<string, number>();
  for (const r of rules) counts.set(r.targetId, (counts.get(r.targetId) ?? 0) + 1);
  const shown = targets.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));

  const update = (i: number, patch: Partial<Draft>) => setDraft((d) => d.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addFor = (weekday: number) =>
    setDraft((d) => [
      ...d,
      { weekday, startMinute: 10 * 60, endMinute: 13 * 60, slotMinutes: target?.type === "course" ? 60 : 45, mode: "online", capacity: target?.type === "course" ? 5 : 1 },
    ]);
  const copyToWeekdays = (from: number) =>
    setDraft((d) => {
      const src = d.filter((r) => r.weekday === from);
      const others = d.filter((r) => r.weekday === from || ![1, 2, 3, 4, 5].includes(r.weekday));
      return [...others, ...[1, 2, 3, 4, 5].filter((w) => w !== from).flatMap((w) => src.map((r) => ({ ...r, weekday: w })))];
    });

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <Panel className="h-fit xl:sticky xl:top-20">
        <div className="border-b border-line p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.5} aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a trainer or course" className="pl-9" aria-label="Find a trainer or course" />
          </div>
        </div>
        <ul className="max-h-[40vh] overflow-y-auto p-1.5 xl:max-h-[60vh]" role="listbox" aria-label="Listings">
          {shown.map((t) => (
            <li key={t.id}>
              <button
                role="option"
                aria-selected={t.id === targetId}
                onClick={() => {
                  if (dirty && !confirm("Discard unsaved changes?")) return;
                  setTargetId(t.id);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[6px] px-2.5 py-2 text-left transition-colors",
                  t.id === targetId ? "bg-sunken" : "hover:bg-sunken/60",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{t.name}</span>
                  <span className="text-[11.5px] text-ink-3">
                    {TYPE_LABEL[t.type]}
                    {!t.published ? " · hidden" : ""}
                  </span>
                </span>
                {counts.get(t.id) ? (
                  <span className="num text-[11.5px] text-ink-3">{counts.get(t.id)}</span>
                ) : (
                  <span className="text-[11.5px] text-warn">none</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      {!target ? (
        <Panel>
          <EmptyState icon={solarIcon("clock-circle-bold-duotone")} title="Pick a listing" body="Choose a trainer, mentor, consultant or course to edit its weekly windows." />
        </Panel>
      ) : (
        <div className="flex min-w-0 flex-col gap-6">
        <Panel>
          <PanelHeader
            title={target.name}
            description={
              <span>
                {TYPE_LABEL[target.type]} · <span className="num">{slotsPerWeek}</span> bookable {target.type === "course" ? "seats" : "slots"} per week · times in IST
              </span>
            }
            actions={
              <>
                <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => setDraft(original)}>Discard</Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!dirty}
                  loading={pending === "save"}
                  onClick={() => run("save", () => saveAvailability({ targetType: target.type, targetId: target.id, rules: draft.map((r) => ({ ...r, slotMinutes: r.slotMinutes as 30 | 45 | 60 | 90 })) }))}
                >
                  Save availability
                </Button>
              </>
            }
          />
          <ul className="divide-y divide-line">
            {DAYS.map((wd) => {
              const list = draft.map((r, i) => ({ r, i })).filter(({ r }) => r.weekday === wd);
              return (
                <li key={wd} className="grid grid-cols-1 gap-3 px-5 py-3.5 sm:grid-cols-[72px_minmax(0,1fr)]">
                  <div className="flex items-center justify-between sm:block">
                    <p className="text-[13.5px] font-medium text-ink">{DAY_NAME[wd]}</p>
                    {list.length && [1, 2, 3, 4, 5].includes(wd) ? (
                      <button onClick={() => copyToWeekdays(wd)} className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-ink-3 hover:text-ink" title="Copy these windows to Mon–Fri">
                        <Copy className="size-3" strokeWidth={1.75} /> Mon–Fri
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    {list.length === 0 ? <p className="py-1.5 text-[13px] text-ink-3">Unavailable</p> : null}
                    {list.map(({ r, i }) => {
                      const slots = Math.floor((r.endMinute - r.startMinute) / r.slotMinutes);
                      return (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                          <Input type="time" step={900} aria-label="From" value={toTime(r.startMinute)} onChange={(e) => update(i, { startMinute: fromTime(e.target.value) })} className="num w-[118px]" />
                          <span className="text-ink-3">to</span>
                          <Input type="time" step={900} aria-label="To" value={toTime(r.endMinute)} onChange={(e) => update(i, { endMinute: fromTime(e.target.value) })} className="num w-[118px]" />
                          <Select aria-label="Slot length" value={r.slotMinutes} onChange={(e) => update(i, { slotMinutes: Number(e.target.value) as Draft["slotMinutes"] })} className="w-[104px]">
                            {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
                          </Select>
                          <Select aria-label="Mode" value={r.mode} onChange={(e) => update(i, { mode: e.target.value as Draft["mode"] })} className="w-[118px]">
                            <option value="online">Online</option>
                            <option value="offline">In person</option>
                          </Select>
                          {target.type === "course" ? (
                            <label className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
                              Seats
                              <Input type="number" min={1} max={50} value={r.capacity} onChange={(e) => update(i, { capacity: Number(e.target.value) })} className="num w-16" />
                            </label>
                          ) : null}
                          <span className={cn("num text-[12px]", slots > 0 ? "text-ink-3" : "text-bad")}>
                            {slots > 0 ? `${slots} slot${slots === 1 ? "" : "s"}, ${minutesToLabel(r.startMinute)}–${minutesToLabel(r.endMinute)}` : "window too short"}
                          </span>
                          <Button variant="ghost" size="icon" className="ml-auto size-8" aria-label="Remove window" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}>
                            <Trash2 className="size-4" strokeWidth={1.6} />
                          </Button>
                        </div>
                      );
                    })}
                    <button onClick={() => addFor(wd)} className="inline-flex w-fit items-center gap-1 text-[12.5px] font-medium text-ink-2 hover:text-ink">
                      <Plus className="size-3.5" strokeWidth={1.75} /> Add window
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
        <ExceptionsPanel key={target.id} target={target} exceptions={targetExceptions} today={today} />
        <SlotPreview
          rules={draft}
          exceptions={targetExceptions}
          bookings={targetBookings}
          leadHours={leadHours}
          now={now}
          today={today}
          isCourse={target.type === "course"}
          unsaved={dirty}
        />
        </div>
      )}
    </div>
  );
}
