"use client";

/**
 * Day / Week / Month booking calendar.
 *
 * View structure after "Event Manager" by vaib215 on 21st.dev
 * (https://21st.dev/@vaib215/components/event-manager): one toolbar with
 * prev / today / next, a period title and a view switch, over month, week and
 * day renderings of the same event set. The source code was NOT retrieved
 * (the daily 21st.dev retrieval quota was exhausted), so this is an original
 * implementation of that structure; the source's licence was not verified and
 * no code from it is included. Drag-and-drop, colour-coded categories and
 * tags from the source are deliberately left out: bookings are moved through
 * the drawer, where the learner and provider get notified.
 *
 * Restyled to the console design system: paper/ink neutrals, status by
 * soft fill + inset ring + icon (never colour alone), ink for "today",
 * transform-only motion.
 */

import * as React from "react";
import { ChevronLeft, ChevronRight, MapPin, Video } from "lucide-react";
import type { BookingRow } from "@/lib/data/queries";
import type { BookingStatus } from "@/lib/data/types";
import { Button, EmptyState } from "@/components/ui/primitives";
import { BookingStatusPill, BOOKING_STATUS } from "@/components/ui/status";
import { Segmented } from "@/components/ui/choice";
import { useLocalStorage } from "@/components/ui/use-local-storage";
import { solarIcon } from "@/components/icons/solar";
import { cn, fmtDate, fmtTime, istDayStart, WEEKDAYS } from "@/lib/utils";

type Mode = "day" | "week" | "month";
const MODES = ["day", "week", "month"] as const;

const HOUR = 3_600_000;
const DAY = 86_400_000;
const IST = 5.5 * HOUR;

/** Soft fill + inset ring per status. Always rendered next to the status icon. */
const TONE: Record<BookingStatus, string> = {
  confirmed: "bg-ok-soft ring-ok/35",
  requested: "bg-warn-soft ring-warn/35",
  meet_failed: "bg-bad-soft ring-bad/35",
  completed: "bg-sunken ring-line-strong",
  no_show: "bg-sunken ring-line-strong",
  cancelled: "bg-sunken ring-line-strong",
};
const ICON_TONE: Record<BookingStatus, string> = {
  confirmed: "text-on-ok-soft",
  requested: "text-on-warn-soft",
  meet_failed: "text-on-bad-soft",
  completed: "text-ink-3",
  no_show: "text-ink-3",
  cancelled: "text-ink-3",
};
/** Order of the month-cell status mix: what needs action first. */
const MIX_ORDER: BookingStatus[] = ["meet_failed", "requested", "confirmed", "completed", "no_show"];

function parts(ms: number) {
  const d = new Date(ms + IST);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), dow: d.getUTCDay() };
}
function mondayOf(dayStart: number) {
  return dayStart - ((parts(dayStart).dow + 6) % 7) * DAY;
}
function monthStart(y: number, m: number) {
  return Date.UTC(y, m, 1) - IST;
}

export function BookingCalendar({ rows, now, onOpen }: { rows: BookingRow[]; now: number; onOpen: (id: string) => void }) {
  const todayStart = istDayStart(now);
  const [mode, setMode] = useLocalStorage<Mode>("tp-bookings-calendar", "week", MODES);
  const [anchor, setAnchor] = React.useState(todayStart);

  // Cancelled bookings free the slot, so the calendar leaves them out.
  const live = React.useMemo(() => rows.filter((r) => r.status !== "cancelled").sort((a, b) => a.start - b.start), [rows]);

  const { y, m } = parts(anchor);
  const weekStart = mondayOf(anchor);

  const step = (dir: 1 | -1) => {
    if (mode === "day") setAnchor((a) => a + dir * DAY);
    else if (mode === "week") setAnchor((a) => a + dir * 7 * DAY);
    else setAnchor(monthStart(y, m + dir));
  };
  const drillDay = (d: number) => {
    setAnchor(d);
    setMode("day");
  };

  const title =
    mode === "day"
      ? fmtDate(anchor, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : mode === "week"
        ? `${fmtDate(weekStart, { day: "numeric", month: "short" })} – ${fmtDate(weekStart + 6 * DAY, { day: "numeric", month: "short", year: "numeric" })}`
        : fmtDate(anchor, { month: "long", year: "numeric" });
  const unit = mode === "day" ? "day" : mode === "week" ? "week" : "month";
  const showingToday =
    mode === "day" ? anchor === todayStart : mode === "week" ? weekStart === mondayOf(todayStart) : parts(todayStart).y === y && parts(todayStart).m === m;

  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" aria-label={`Previous ${unit}`} onClick={() => step(-1)}>
            <ChevronLeft className="size-4" strokeWidth={1.75} />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Next ${unit}`} onClick={() => step(1)}>
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
        <h2 className="min-w-0 text-[15px] font-semibold tracking-tight text-ink" aria-live="polite">
          {title}
        </h2>
        <Button size="sm" className="ml-1" disabled={showingToday} onClick={() => setAnchor(todayStart)}>
          Today
        </Button>
        <div className="ml-auto">
          <Segmented<Mode>
            label="Calendar range"
            value={mode}
            onChange={setMode}
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
        </div>
      </div>

      {mode === "month" ? (
        <MonthGrid rows={live} y={y} m={m} todayStart={todayStart} onOpen={onOpen} onDay={drillDay} />
      ) : mode === "week" ? (
        <TimeGrid
          days={Array.from({ length: 7 }, (_, i) => weekStart + i * DAY)}
          rows={live}
          now={now}
          todayStart={todayStart}
          onOpen={onOpen}
          onDay={drillDay}
        />
      ) : (
        <DayView day={anchor} rows={live} now={now} todayStart={todayStart} onOpen={onOpen} />
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-2.5 text-[12px] text-ink-2">
        {MIX_ORDER.map((s) => (
          <Legend key={s} status={s} />
        ))}
        <span className="ml-auto text-ink-3">Cancelled bookings are hidden. Times in IST.</span>
      </div>
    </div>
  );
}

function StatusIcon({ status, className }: { status: BookingStatus; className?: string }) {
  const Icon = BOOKING_STATUS[status].icon;
  return <Icon className={cn("size-3 shrink-0", ICON_TONE[status], className)} strokeWidth={2.25} aria-hidden />;
}

function Legend({ status }: { status: BookingStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("grid size-4 place-items-center rounded-[4px] ring-1 ring-inset", TONE[status])}>
        <StatusIcon status={status} />
      </span>
      {BOOKING_STATUS[status].label}
    </span>
  );
}

const blockMotion =
  "transition-[transform,box-shadow] duration-150 ease-[var(--ease-out-quart)] hover:z-[3] hover:-translate-y-px " +
  "focus-visible:z-[3] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

/** Visible hour range: 9am–8pm, widened to fit any booking outside it. */
function hourRange(items: BookingRow[], days: number[]) {
  let lo = 9;
  let hi = 20;
  for (const r of items) {
    const d = days.find((x) => r.start >= x && r.start < x + DAY);
    if (d === undefined) continue;
    lo = Math.min(lo, Math.floor((r.start - d) / HOUR));
    hi = Math.max(hi, Math.min(24, Math.ceil((r.end - d) / HOUR)));
  }
  return Array.from({ length: hi - lo }, (_, i) => lo + i);
}

/**
 * Side-by-side lanes for overlapping bookings. Bookings that overlap each
 * other (directly or through a chain) form a cluster; each takes the first
 * free column, and every booking in a cluster shares its column count, so
 * blocks line up instead of staggering.
 */
function layoutLanes(items: BookingRow[], minMs: number) {
  const out = new Map<string, { lane: number; lanes: number }>();
  let cluster: Array<{ r: BookingRow; lane: number }> = [];
  let colEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const c of cluster) out.set(c.r.id, { lane: c.lane, lanes: colEnds.length });
    cluster = [];
    colEnds = [];
  };
  for (const r of [...items].sort((a, b) => a.start - b.start || b.end - a.end)) {
    // A short booking is drawn taller than its duration, so lay out by what is drawn.
    const end = Math.max(r.end, r.start + minMs);
    if (r.start >= clusterEnd) flush();
    let lane = colEnds.findIndex((e) => e <= r.start);
    if (lane < 0) lane = colEnds.push(end) - 1;
    else colEnds[lane] = end;
    cluster.push({ r, lane });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return out;
}

function hourLabel(h: number) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${h >= 12 ? "pm" : "am"}`;
}

function TimeGrid({
  days,
  rows,
  now,
  todayStart,
  onOpen,
  onDay,
  rowH = 52,
  detailed = false,
}: {
  days: number[];
  rows: BookingRow[];
  now: number;
  todayStart: number;
  onOpen: (id: string) => void;
  onDay?: (d: number) => void;
  rowH?: number;
  detailed?: boolean;
}) {
  const inRange = rows.filter((r) => r.start >= days[0] && r.start < days[days.length - 1] + DAY);
  const HOURS = hourRange(inRange, days);
  const first = HOURS[0];
  const height = HOURS.length * rowH;

  return (
    <div className="overflow-x-auto">
      <div
        className={cn("grid", days.length > 1 && "min-w-[880px]")}
        style={{
          gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))`,
        }}
      >
        {days.length > 1 ? (
          <>
            <div className="border-b border-line" />
            {days.map((d) => {
              const isToday = d === todayStart;
              const count = inRange.filter((r) => r.start >= d && r.start < d + DAY).length;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDay?.(d)}
                  aria-label={`${fmtDate(d, { weekday: "long", day: "numeric", month: "long" })}, ${count} ${count === 1 ? "booking" : "bookings"}. Open day`}
                  className="group border-b border-l border-line px-2 py-2 text-center transition-colors duration-150 ease-[var(--ease-out-quart)] hover:bg-sunken/60 focus-visible:outline-offset-[-2px]"
                >
                  <span className="block text-[11.5px] uppercase tracking-[0.06em] text-ink-3">{WEEKDAYS[parts(d).dow]}</span>
                  <span
                    className={cn(
                      "num mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-[13px]",
                      isToday ? "bg-ink font-semibold text-paper" : "text-ink group-hover:bg-surface",
                    )}
                  >
                    {fmtDate(d, { day: "numeric" })}
                  </span>
                </button>
              );
            })}
          </>
        ) : null}
        <div className="relative" aria-hidden>
          {HOURS.map((h) => (
            <div key={h} className="num pr-2 pt-1 text-right text-[11px] text-ink-3" style={{ height: rowH }}>
              {hourLabel(h)}
            </div>
          ))}
        </div>
        {days.map((d) => {
          const items = inRange.filter((r) => r.start >= d && r.start < d + DAY);
          const nowTop = ((now - d) / HOUR - first) * rowH;
          const minH = detailed ? 44 : 30;
          const lanes = layoutLanes(items, ((minH + 4) / rowH) * HOUR);
          return (
            <div key={d} className="relative border-l border-line" style={{ height }}>
              {HOURS.map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: i * rowH }} />
              ))}
              {d === todayStart && nowTop >= 0 && nowTop <= height ? (
                <div className="absolute inset-x-0 z-[2] h-px bg-bad" style={{ top: nowTop }} aria-hidden>
                  <span className="absolute -left-1 -top-1 size-2 rounded-full bg-bad" />
                </div>
              ) : null}
              {items.map((r, idx) => {
                const top = ((r.start - d) / HOUR - first) * rowH;
                const h = Math.max(minH, ((r.end - r.start) / HOUR) * rowH - 4);
                const { lane, lanes: count } = lanes.get(r.id) ?? {
                  lane: 0,
                  lanes: 1,
                };
                const width = 100 / count;
                const label = `${BOOKING_STATUS[r.status].label}: ${r.targetName} with ${r.learnerName}, ${fmtTime(r.start)}–${fmtTime(r.end)}`;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onOpen(r.id)}
                    aria-label={label}
                    title={label}
                    className={cn(
                      "absolute overflow-hidden rounded-[6px] px-1.5 py-1 text-left ring-1 ring-inset",
                      TONE[r.status],
                      blockMotion,
                      (r.status === "completed" || r.status === "no_show") && "opacity-85",
                    )}
                    style={{
                      top: top + 2,
                      height: h,
                      left: `calc(${lane * width}% + 3px)`,
                      width: `calc(${width}% - 6px)`,
                      zIndex: idx + 1,
                    }}
                  >
                    <span className="flex items-center gap-1">
                      <StatusIcon status={r.status} />
                      <span className="num truncate text-[10.5px] text-ink-2">
                        {fmtTime(r.start)}
                        {detailed ? ` – ${fmtTime(r.end)}` : ""}
                      </span>
                    </span>
                    <span className={cn("block truncate font-medium leading-tight text-ink", detailed ? "mt-0.5 text-[13px]" : "text-[11.5px]")}>
                      {r.targetName}
                    </span>
                    {detailed && h >= 62 ? (
                      <span className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-ink-2">
                        {r.learnerName}
                        <span className="text-ink-3">·</span>
                        {r.mode === "online" ? (
                          <Video className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
                        ) : (
                          <MapPin className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
                        )}
                        {r.mode === "online" ? "Online" : "In person"}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ day, rows, now, todayStart, onOpen }: { day: number; rows: BookingRow[]; now: number; todayStart: number; onOpen: (id: string) => void }) {
  const items = rows.filter((r) => r.start >= day && r.start < day + DAY);
  const needs = items.filter((r) => r.status === "requested" || r.status === "meet_failed").length;
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
      <TimeGrid days={[day]} rows={rows} now={now} todayStart={todayStart} onOpen={onOpen} rowH={72} detailed />
      {/* On wide screens the timeline sets the row height and the list scrolls inside it. */}
      <aside className="relative border-t border-line lg:border-l lg:border-t-0" aria-label="Bookings this day">
        <div className="flex flex-col lg:absolute lg:inset-0">
          <div className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-[13.5px] font-semibold text-ink">
              <span className="num">{items.length}</span> {items.length === 1 ? "booking" : "bookings"}
            </p>
            {needs ? (
              <p className="text-[12.5px] text-ink-2">
                <span className="num font-medium text-ink">{needs}</span> need action
              </p>
            ) : null}
          </div>
          {items.length ? (
            <ol className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
              {items.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(r.id)}
                    className="flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors duration-150 ease-[var(--ease-out-quart)] hover:bg-sunken/60 focus-visible:outline-offset-[-2px]"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="num text-[12.5px] text-ink-2">
                        {fmtTime(r.start)} – {fmtTime(r.end)}
                      </span>
                      <BookingStatusPill status={r.status} />
                    </span>
                    <span className="truncate text-[13.5px] font-medium text-ink">{r.targetName}</span>
                    <span className="truncate text-[12.5px] text-ink-2">
                      {r.learnerName} · {r.mode === "online" ? "Online" : "In person"} · <span className="num">{r.ref}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              icon={solarIcon("calendar-mark-bold-duotone")}
              title="No bookings this day"
              body="Demo, mentorship and consultation bookings made in the app show up here with their status."
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function MonthGrid({
  rows,
  y,
  m,
  todayStart,
  onOpen,
  onDay,
}: {
  rows: BookingRow[];
  y: number;
  m: number;
  todayStart: number;
  onOpen: (id: string) => void;
  onDay: (d: number) => void;
}) {
  const start = monthStart(y, m);
  const end = monthStart(y, m + 1);
  const gridStart = mondayOf(start);
  const weeks = Math.ceil((end - gridStart) / DAY / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => gridStart + i * DAY);
  const byDay = new Map<number, BookingRow[]>();
  for (const r of rows) {
    if (r.start < gridStart || r.start >= gridStart + weeks * 7 * DAY) continue;
    const d = istDayStart(r.start);
    byDay.set(d, [...(byDay.get(d) ?? []), r]);
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-line">
          {[1, 2, 3, 4, 5, 6, 0].map((dow, i) => (
            <p key={dow} className={cn("px-3 py-2 text-[11.5px] uppercase tracking-[0.06em] text-ink-3", i > 0 && "border-l border-line")}>
              {WEEKDAYS[dow]}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const items = byDay.get(d) ?? [];
            const inMonth = d >= start && d < end;
            const isToday = d === todayStart;
            const mix = MIX_ORDER.map((s) => [s, items.filter((r) => r.status === s).length] as const).filter(([, n]) => n > 0);
            const dayName = fmtDate(d, {
              weekday: "long",
              day: "numeric",
              month: "long",
            });
            return (
              <div
                key={d}
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest("button")) onDay(d);
                }}
                className={cn(
                  "group flex min-h-[128px] cursor-pointer flex-col gap-1.5 p-2 transition-colors duration-150 ease-[var(--ease-out-quart)] hover:bg-sunken/50",
                  i % 7 > 0 && "border-l border-line",
                  i >= 7 && "border-t border-line",
                  !inMonth && "bg-sunken/40",
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => onDay(d)}
                    aria-label={`${dayName}, ${items.length ? `${items.length} ${items.length === 1 ? "booking" : "bookings"}` : "no bookings"}. Open day`}
                    className={cn(
                      "num grid size-7 place-items-center rounded-full text-[13px] transition-colors duration-150 ease-[var(--ease-out-quart)]",
                      isToday ? "bg-ink font-semibold text-paper" : inMonth ? "text-ink hover:bg-surface" : "text-ink-3 hover:bg-surface",
                    )}
                  >
                    {fmtDate(d, { day: "numeric" })}
                  </button>
                  {items.length ? (
                    <span className={cn("num text-[12px]", inMonth ? "text-ink-2" : "text-ink-3")} aria-hidden>
                      <span className="font-semibold text-ink">{items.length}</span> {items.length === 1 ? "booking" : "bookings"}
                    </span>
                  ) : null}
                </div>

                {mix.length ? (
                  <ul className="flex flex-wrap gap-1" aria-label="Status mix">
                    {mix.map(([s, n]) => (
                      <li
                        key={s}
                        title={`${n} ${BOOKING_STATUS[s].label.toLowerCase()}`}
                        className={cn(
                          "num inline-flex h-5 items-center gap-1 rounded-[4px] px-1.5 text-[11px] font-medium text-ink ring-1 ring-inset",
                          TONE[s],
                        )}
                      >
                        <StatusIcon status={s} />
                        {n}
                        <span className="sr-only"> {BOOKING_STATUS[s].label}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {items.length ? (
                  <ul className="flex flex-col gap-0.5">
                    {items.slice(0, 2).map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => onOpen(r.id)}
                          aria-label={`${BOOKING_STATUS[r.status].label}: ${r.targetName} with ${r.learnerName}, ${fmtTime(r.start)}`}
                          className="flex w-full items-center gap-1.5 rounded-[4px] px-1 py-0.5 text-left text-[11.5px] transition-colors duration-150 ease-[var(--ease-out-quart)] hover:bg-surface"
                        >
                          <span className="num shrink-0 text-ink-3">{fmtTime(r.start)}</span>
                          <span className="truncate text-ink-2">{r.targetName}</span>
                        </button>
                      </li>
                    ))}
                    {items.length > 2 ? (
                      <li>
                        <button
                          type="button"
                          onClick={() => onDay(d)}
                          className="rounded-[4px] px-1 py-0.5 text-[11.5px] font-medium text-ink-2 transition-colors duration-150 ease-[var(--ease-out-quart)] hover:bg-surface hover:text-ink"
                        >
                          +{items.length - 2} more
                        </button>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
