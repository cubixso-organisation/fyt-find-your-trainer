"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheck2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  List,
  MapPin,
  RefreshCw,
  Video,
} from "lucide-react";
import type { BookingRow } from "@/lib/data/queries";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button, Field, Input } from "@/components/ui/primitives";
import { BookingStatusPill, BOOKING_STATUS } from "@/components/ui/status";
import { ConfirmDialog, Drawer } from "@/components/ui/overlays";
import { cn, fmtDate, fmtDateTime, fmtTime, istDayStart, relTime, WEEKDAYS } from "@/lib/utils";
import { cancelBooking, confirmBooking, markOutcome, rescheduleBooking, retryMeetLink, type ActionResult } from "./actions";
import { solarIcon } from "@/components/icons/solar";

type View = "attention" | "upcoming" | "past" | "all" | "calendar";

const TARGET_LABEL: Record<string, string> = { course: "Course demo", trainer: "Trainer 1-on-1", mentor: "Mentorship", consultant: "Consultation" };

export function BookingsClient({ rows, now, initialView }: { rows: BookingRow[]; now: number; initialView: View }) {
  const [view, setView] = React.useState<View>(initialView);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = rows.find((r) => r.id === openId) ?? null;

  const sets: Record<Exclude<View, "calendar">, BookingRow[]> = React.useMemo(
    () => ({
      attention: rows.filter((r) => r.start > now - 30 * 60_000 && (r.status === "requested" || r.status === "meet_failed")),
      upcoming: rows.filter((r) => r.start >= now && r.status !== "cancelled"),
      past: rows.filter((r) => r.start < now).sort((a, b) => b.start - a.start),
      all: [...rows].sort((a, b) => b.createdAt - a.createdAt),
    }),
    [rows, now],
  );

  const columns: Column<BookingRow>[] = [
    {
      key: "when",
      header: "When (IST)",
      sortValue: (r) => r.start,
      cell: (r) => (
        <div className="whitespace-nowrap">
          <p className="num text-[13px] text-ink">{fmtDate(r.start, { weekday: "short", day: "numeric", month: "short" })}</p>
          <p className="num text-[12px] text-ink-3">{fmtTime(r.start)}</p>
        </div>
      ),
    },
    {
      key: "learner",
      header: "Learner",
      sortValue: (r) => r.learnerName,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.learnerName}</p>
          <p className="text-[12px] text-ink-3">{r.learnerSegment === "corporate" ? "Corporate" : "Student"}</p>
        </div>
      ),
    },
    {
      key: "with",
      header: "Booked for",
      sortValue: (r) => r.targetName,
      cell: (r) => (
        <div className="min-w-0 max-w-[280px]">
          <p className="truncate">{r.targetName}</p>
          <p className="text-[12px] text-ink-3">{TARGET_LABEL[r.targetType]}</p>
        </div>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      hideBelow: "md",
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          {r.mode === "online" ? <Video className="size-3.5" strokeWidth={1.75} /> : <MapPin className="size-3.5" strokeWidth={1.75} />}
          {r.mode === "online" ? "Online" : "In person"}
        </span>
      ),
    },
    { key: "status", header: "Status", sortValue: (r) => r.status, cell: (r) => <BookingStatusPill status={r.status} /> },
    { key: "ref", header: "Ref", hideBelow: "lg", cell: (r) => <span className="num text-[12.5px] text-ink-2">{r.ref}</span> },
  ];

  const tabs: Array<[View, string, number | null]> = [
    ["attention", "Needs action", sets.attention.length],
    ["upcoming", "Upcoming", sets.upcoming.length],
    ["past", "Past", null],
    ["all", "All", null],
    ["calendar", "Calendar", null],
  ];

  return (
    <>
      <div role="tablist" aria-label="Booking views" className="mb-4 flex flex-wrap items-center gap-1 border-b border-line">
        {tabs.map(([k, label, count]) => (
          <button
            key={k}
            role="tab"
            aria-selected={view === k}
            onClick={() => setView(k)}
            className={cn(
              "relative -mb-px inline-flex h-10 items-center gap-2 border-b-2 px-3 text-[13.5px] transition-colors",
              view === k ? "border-ink font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {k === "calendar" ? <CalendarDays className="size-4" strokeWidth={1.6} /> : k === "all" ? <List className="size-4" strokeWidth={1.6} /> : null}
            {label}
            {count ? (
              <span className={cn("num rounded-[4px] px-1.5 text-[11px] leading-5", k === "attention" ? "bg-accent text-accent-ink font-semibold" : "bg-sunken text-ink-2")}>
                {count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {view === "calendar" ? (
        <WeekCalendar rows={rows} now={now} onOpen={setOpenId} />
      ) : (
        <DataTable
          key={view}
          caption="Bookings"
          rows={sets[view]}
          columns={columns}
          rowKey={(r) => r.id}
          onRowClick={(r) => setOpenId(r.id)}
          initialSort={view === "past" || view === "all" ? undefined : { key: "when", dir: "asc" }}
          search={(r) => `${r.ref} ${r.learnerName} ${r.learnerPhone} ${r.targetName}`}
          searchPlaceholder="Search ref, learner, phone, listing"
          filters={[
            {
              key: "type",
              label: "Type",
              options: Object.entries(TARGET_LABEL).map(([value, label]) => ({ value, label })),
              test: (r, v) => r.targetType === v,
            },
            {
              key: "status",
              label: "Status",
              options: Object.entries(BOOKING_STATUS).map(([value, s]) => ({ value, label: s.label })),
              test: (r, v) => r.status === v,
            },
            {
              key: "mode",
              label: "Mode",
              options: [
                { value: "online", label: "Online" },
                { value: "offline", label: "In person" },
              ],
              test: (r, v) => r.mode === v,
            },
          ]}
          empty={
            view === "attention"
              ? { icon: solarIcon("checklist-minimalistic-bold-duotone"), title: "Nothing needs action", body: "New requests and failed Meet links from the app land here first." }
              : { icon: solarIcon("inbox-line-bold-duotone"), title: "No bookings here yet", body: "Bookings made in the mobile app appear here within seconds." }
          }
        />
      )}

      <BookingDrawer booking={open} now={now} onClose={() => setOpenId(null)} />
    </>
  );
}

function useAction() {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<ActionResult>) => {
    setPending(key);
    const r = await fn();
    setPending(null);
    if (r.ok) {
      toast.success(r.message ?? "Saved");
      router.refresh();
    } else toast.error(r.error);
    return r.ok;
  };
  return { pending, run };
}

function toLocalInput(ms: number) {
  // datetime-local in IST
  const d = new Date(ms + 5.5 * 3_600_000);
  return d.toISOString().slice(0, 16);
}
function fromLocalInput(v: string) {
  return Date.parse(v + ":00Z") - 5.5 * 3_600_000;
}

function BookingDrawer({ booking: b, now, onClose }: { booking: BookingRow | null; now: number; onClose: () => void }) {
  const { pending, run } = useAction();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [when, setWhen] = React.useState(b ? toLocalInput(b.start) : "");
  const [shownKey, setShownKey] = React.useState(b ? `${b.id}:${b.start}` : "");
  const key = b ? `${b.id}:${b.start}` : "";
  if (key !== shownKey) {
    setShownKey(key);
    if (b) setWhen(toLocalInput(b.start));
  }

  const upcoming = b ? b.start > now : false;
  const canCancel = b && ["requested", "confirmed", "meet_failed"].includes(b.status);

  return (
    <Drawer
      open={!!b}
      onOpenChange={(o) => !o && onClose()}
      title={b ? <span className="flex items-center gap-2">Booking <span className="num text-ink-2">{b.ref}</span></span> : ""}
      description={b ? `${TARGET_LABEL[b.targetType]} · created ${relTime(b.createdAt, now)}` : undefined}
      footer={
        b ? (
          <>
            {canCancel ? (
              <Button variant="ghost" className="mr-auto text-bad hover:text-bad" onClick={() => setCancelOpen(true)}>
                Cancel booking
              </Button>
            ) : null}
            {b.status === "requested" ? (
              <Button variant="primary" loading={pending === "confirm"} onClick={() => run("confirm", () => confirmBooking(b.id))}>
                <CalendarCheck2 className="size-4" strokeWidth={1.75} /> Confirm
              </Button>
            ) : null}
            {b.status === "meet_failed" ? (
              <Button variant="primary" loading={pending === "retry"} onClick={() => run("retry", () => retryMeetLink(b.id))}>
                <RefreshCw className="size-4" strokeWidth={1.75} /> Retry Meet link
              </Button>
            ) : null}
            {b.status === "confirmed" && !upcoming ? (
              <>
                <Button loading={pending === "no_show"} onClick={() => run("no_show", () => markOutcome({ id: b.id, outcome: "no_show" }))}>
                  No-show
                </Button>
                <Button variant="primary" loading={pending === "completed"} onClick={() => run("completed", () => markOutcome({ id: b.id, outcome: "completed" }))}>
                  Mark attended
                </Button>
              </>
            ) : null}
          </>
        ) : null
      }
    >
      {b ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <BookingStatusPill status={b.status} />
            {b.status === "meet_failed" ? <span className="text-[13px] text-bad">The learner has no link yet.</span> : null}
          </div>

          <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 text-[13.5px]">
            <dt className="text-ink-2">When</dt>
            <dd className="num text-ink">
              {fmtDateTime(b.start)} <span className="text-ink-3">({relTime(b.start, now)})</span>
            </dd>
            <dt className="text-ink-2">Learner</dt>
            <dd className="text-ink">
              {b.learnerName}
              <span className="num block text-[12.5px] text-ink-3">{b.learnerPhone}</span>
            </dd>
            <dt className="text-ink-2">Booked for</dt>
            <dd className="text-ink">{b.targetName}</dd>
            <dt className="text-ink-2">Mode</dt>
            <dd className="text-ink">{b.mode === "online" ? "Online (Google Meet)" : "In person"}</dd>
            {b.mode === "online" ? (
              <>
                <dt className="text-ink-2">Meet link</dt>
                <dd>
                  {b.meetLink ? (
                    <span className="flex items-center gap-2">
                      <a href={b.meetLink} target="_blank" rel="noreferrer" className="num truncate text-[13px] text-ink underline decoration-line-strong underline-offset-4">
                        {b.meetLink.replace("https://", "")}
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Copy Meet link"
                        onClick={() => {
                          void navigator.clipboard.writeText(b.meetLink!);
                          toast.success("Meet link copied");
                        }}
                      >
                        <Copy className="size-3.5" strokeWidth={1.75} />
                      </Button>
                    </span>
                  ) : (
                    <span className="text-ink-3">{b.status === "requested" ? "Created on confirmation" : "Not created"}</span>
                  )}
                </dd>
              </>
            ) : (
              <>
                <dt className="text-ink-2">Address</dt>
                <dd className="text-ink">{b.offlineAddress}</dd>
              </>
            )}
            {b.cancelledReason ? (
              <>
                <dt className="text-ink-2">Cancel reason</dt>
                <dd className="text-ink">{b.cancelledReason}</dd>
              </>
            ) : null}
          </dl>

          {upcoming && ["requested", "confirmed", "meet_failed"].includes(b.status) ? (
            <section className="rounded-[var(--radius-panel)] border border-line p-4">
              <h3 className="text-[13.5px] font-semibold text-ink">Reschedule</h3>
              <p className="mt-0.5 text-[12.5px] text-ink-2">Both the learner and the provider get the new time by push and email.</p>
              <div className="mt-3 flex items-end gap-2">
                <Field label="New time (IST)" htmlFor="resched" className="flex-1">
                  <Input id="resched" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                </Field>
                <Button
                  loading={pending === "resched"}
                  disabled={!when || when === toLocalInput(b.start)}
                  onClick={() => run("resched", () => rescheduleBooking({ id: b.id, start: fromLocalInput(when) }))}
                >
                  Move booking
                </Button>
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">Timeline</h3>
            <ol className="mt-2 space-y-2 text-[13px] text-ink-2">
              <li className="flex gap-2"><span className="num w-36 shrink-0 text-ink-3">{fmtDateTime(b.createdAt)}</span> Requested in the app</li>
              {b.updatedAt !== b.createdAt ? (
                <li className="flex gap-2"><span className="num w-36 shrink-0 text-ink-3">{fmtDateTime(b.updatedAt)}</span> Last changed by an operator</li>
              ) : null}
            </ol>
          </section>
        </div>
      ) : null}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={(o) => {
          setCancelOpen(o);
          if (!o) setReason("");
        }}
        title={`Cancel ${b?.ref ?? ""}?`}
        body={
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Reason shown to the learner
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Trainer unavailable at this time"
              className="h-9 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm font-normal focus-visible:border-accent focus-visible:outline-none"
            />
          </label>
        }
        confirmLabel="Cancel booking"
        loading={pending === "cancel"}
        onConfirm={async () => {
          if (!b) return;
          const ok = await run("cancel", () => cancelBooking({ id: b.id, reason }));
          if (ok) {
            setCancelOpen(false);
            setReason("");
          }
        }}
      />
    </Drawer>
  );
}

function WeekCalendar({ rows, now, onOpen }: { rows: BookingRow[]; now: number; onOpen: (id: string) => void }) {
  const DAY = 86_400_000;
  const todayStart = istDayStart(now);
  const [weekStart, setWeekStart] = React.useState(() => {
    const dow = new Date(todayStart + 5.5 * 3_600_000).getUTCDay();
    return todayStart - ((dow + 6) % 7) * DAY; // Monday
  });
  const HOURS = Array.from({ length: 11 }, (_, i) => 9 + i); // 9am-7pm
  const ROW_H = 52;
  const days = Array.from({ length: 7 }, (_, i) => weekStart + i * DAY);
  const inWeek = rows.filter((r) => r.start >= weekStart && r.start < weekStart + 7 * DAY && r.status !== "cancelled");

  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => setWeekStart((w) => w - 7 * DAY)}>
          <ChevronLeft className="size-4" strokeWidth={1.75} />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => setWeekStart((w) => w + 7 * DAY)}>
          <ChevronRight className="size-4" strokeWidth={1.75} />
        </Button>
        <p className="text-[14px] font-medium text-ink">
          {fmtDate(days[0], { day: "numeric", month: "short" })} – {fmtDate(days[6], { day: "numeric", month: "short", year: "numeric" })}
        </p>
        <Button
          size="sm"
          className="ml-2"
          onClick={() => {
            const dow = new Date(todayStart + 5.5 * 3_600_000).getUTCDay();
            setWeekStart(todayStart - ((dow + 6) % 7) * DAY);
          }}
        >
          This week
        </Button>
        <div className="ml-auto hidden items-center gap-3 text-[12px] text-ink-2 md:flex">
          <Legend className="bg-ok-soft border-ok/40" label="Confirmed" />
          <Legend className="bg-warn-soft border-warn/40" label="Requested" />
          <Legend className="bg-bad-soft border-bad/40" label="Link failed" />
          <Legend className="bg-sunken border-line-strong" label="Done / no-show" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[880px]" style={{ gridTemplateColumns: "56px repeat(7, minmax(0,1fr))" }}>
          <div className="border-b border-line" />
          {days.map((d) => {
            const isToday = d === todayStart;
            const dow = new Date(d + 5.5 * 3_600_000).getUTCDay();
            return (
              <div key={d} className="border-b border-l border-line px-2 py-2 text-center">
                <p className="text-[11.5px] uppercase tracking-[0.06em] text-ink-3">{WEEKDAYS[dow]}</p>
                <p className={cn("num mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-[13px]", isToday ? "bg-ink font-semibold text-paper" : "text-ink")}>
                  {fmtDate(d, { day: "numeric" })}
                </p>
              </div>
            );
          })}
          <div className="relative">
            {HOURS.map((h) => (
              <div key={h} className="num h-[52px] pr-2 pt-1 text-right text-[11px] text-ink-3">
                {h > 12 ? h - 12 : h}
                {h >= 12 ? "pm" : "am"}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const items = inWeek.filter((r) => r.start >= d && r.start < d + DAY);
            return (
              <div key={d} className="relative border-l border-line" style={{ height: HOURS.length * ROW_H }}>
                {HOURS.map((h, i) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: i * ROW_H }} />
                ))}
                {d === todayStart && now >= d + 9 * 3_600_000 && now < d + 20 * 3_600_000 ? (
                  <div className="absolute inset-x-0 z-[1] h-px bg-bad" style={{ top: ((now - d) / 3_600_000 - 9) * ROW_H }}>
                    <span className="absolute -left-1 -top-1 size-2 rounded-full bg-bad" />
                  </div>
                ) : null}
                {items.map((r, idx) => {
                  const startH = (r.start - d) / 3_600_000;
                  const top = (startH - 9) * ROW_H;
                  const h = Math.max(26, ((r.end - r.start) / 3_600_000) * ROW_H - 4);
                  if (top < 0 || top > HOURS.length * ROW_H) return null;
                  const overlap = items.filter((o) => o.start < r.end && r.start < o.end);
                  const lane = overlap.indexOf(r);
                  const width = 100 / overlap.length;
                  const tone =
                    r.status === "confirmed"
                      ? "bg-ok-soft border-ok/40"
                      : r.status === "requested"
                        ? "bg-warn-soft border-warn/40"
                        : r.status === "meet_failed"
                          ? "bg-bad-soft border-bad/40"
                          : "bg-sunken border-line-strong opacity-80";
                  return (
                    <button
                      key={r.id}
                      onClick={() => onOpen(r.id)}
                      className={cn("absolute overflow-hidden rounded-[6px] border px-1.5 py-1 text-left transition-transform hover:z-[2] hover:-translate-y-px", tone)}
                      style={{ top: top + 2, height: h, left: `calc(${lane * width}% + 3px)`, width: `calc(${width}% - 6px)`, zIndex: idx }}
                      title={`${r.targetName} · ${r.learnerName} · ${fmtTime(r.start)}`}
                    >
                      <p className="num truncate text-[10.5px] text-ink-2">{fmtTime(r.start)}</p>
                      <p className="truncate text-[11.5px] font-medium leading-tight text-ink">{r.targetName}</p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {inWeek.length === 0 ? (
        <p className="border-t border-line px-4 py-3 text-[13px] text-ink-2">No bookings this week.</p>
      ) : null}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-3 rounded-[3px] border", className)} />
      {label}
    </span>
  );
}

