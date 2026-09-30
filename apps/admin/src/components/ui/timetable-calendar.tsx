"use client";

/**
 * TimetableCalendar: a month header and a horizontally scrolling row of days.
 *
 * Layout and interaction adapted from "GlassCalendar" on 21st.dev (month
 * header with an animated month name and prev/next, a scrollable row of day
 * buttons with the weekday initial above each date, the selected day
 * highlighted, a dot for today, a divider and a footer). Restyled for the FYT
 * console: no glassmorphism, gradients or dark-only styling; paper/ink
 * surfaces with marigold used only for the today dot and the focus ring.
 * Rebuilt on date-fns + motion/react; keyboard support added.
 *
 * Accessibility:
 *  - the days are a labelled group of toggle buttons: `aria-pressed` on the
 *    selected day, `aria-current="date"` on today;
 *  - one tab stop (roving tabindex). Arrow Left/Right move a day, Home/End
 *    jump to the month's first/last day, Page Up/Down move a month. The
 *    selection follows focus;
 *  - reduced motion: MotionConfig drops the month-name slide to a fade.
 *
 * Dates are plain local calendar days (`new Date(y, m, d)`). Pass `today`
 * from the server so server and client render the same markup.
 */
import * as React from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from "date-fns";
import { cn } from "@/lib/utils";

export interface TimetableCalendarProps {
  value: Date;
  onValueChange: (day: Date) => void;
  /** Today's calendar day (from the server, to keep hydration stable). */
  today: Date;
  /** Optional per-day count, read into each day's accessible name. */
  countFor?: (day: Date) => number;
  /** Noun for `countFor`, e.g. "session". */
  countNoun?: string;
  /** Rendered under the divider. */
  footer?: React.ReactNode;
  label?: string;
  className?: string;
}

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

export function TimetableCalendar({
  value,
  onValueChange,
  today,
  countFor,
  countNoun = "item",
  footer,
  label = "Choose a day",
  className,
}: TimetableCalendarProps) {
  const [view, setView] = React.useState(() => startOfMonth(value));
  const [dir, setDir] = React.useState(1);
  const rowRef = React.useRef<HTMLDivElement>(null);

  const days = React.useMemo(() => eachDayOfInterval({ start: view, end: endOfMonth(view) }), [view]);
  const tabStop = isSameMonth(value, view) ? value : view;

  const scrollToDay = React.useCallback((d: Date, focus: boolean, smooth: boolean) => {
    const row = rowRef.current;
    const el = row?.querySelector<HTMLButtonElement>(`[data-day="${dayKey(d)}"]`);
    if (!row || !el) return;
    const left = el.offsetLeft - row.clientWidth / 2 + el.clientWidth / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: smooth ? "smooth" : "auto" });
    if (focus) el.focus({ preventScroll: true });
  }, []);

  // Centre the selected day when the row first renders or the month changes.
  // DOM-only (no state), so it's safe in an effect.
  React.useEffect(() => {
    scrollToDay(isSameMonth(value, view) ? value : view, false, false);
    // Only on month change; day moves scroll themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const reduce = React.useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );

  const goMonth = (delta: number) => {
    setDir(delta);
    setView((v) => startOfMonth(addMonths(v, delta)));
  };

  const select = (d: Date, focus: boolean) => {
    if (!isSameMonth(d, view)) {
      setDir(d.getTime() > view.getTime() ? 1 : -1);
      setView(startOfMonth(d));
    }
    onValueChange(d);
    requestAnimationFrame(() => scrollToDay(d, focus, !reduce));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, d: Date) => {
    let next: Date | null = null;
    if (e.key === "ArrowRight") next = addDays(d, 1);
    else if (e.key === "ArrowLeft") next = addDays(d, -1);
    else if (e.key === "Home") next = startOfMonth(d);
    else if (e.key === "End") next = endOfMonth(d);
    else if (e.key === "PageDown") next = addMonths(d, 1);
    else if (e.key === "PageUp") next = addMonths(d, -1);
    if (!next) return;
    e.preventDefault();
    select(next, true);
  };

  const monthLabel = format(view, "MMMM yyyy");

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("rounded-[var(--radius-overlay)] border border-line bg-surface", className)}>
        {/* Month header */}
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5">
          <div className="relative h-6 min-w-0 flex-1 overflow-hidden" aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.p
                key={monthLabel}
                custom={dir}
                initial={{ opacity: 0, y: dir * 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: dir * -12 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                className="font-display truncate text-[16px] font-semibold leading-6 tracking-tight text-ink"
              >
                {format(view, "MMMM")} <span className="font-normal text-ink-2">{format(view, "yyyy")}</span>
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              aria-label="Previous month"
              className="grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-2 transition-colors duration-150 hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => goMonth(1)}
              aria-label="Next month"
              className="grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-2 transition-colors duration-150 hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>

        {/* Day row */}
        <div
          ref={rowRef}
          role="group"
          aria-label={`${label}, ${monthLabel}`}
          className="flex snap-x gap-1 overflow-x-auto px-3 pb-3 pt-1 [mask-image:linear-gradient(90deg,transparent,#000_16px,#000_calc(100%-16px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {days.map((d) => {
            const selected = isSameDay(d, value);
            const isToday = isSameDay(d, today);
            const n = countFor?.(d);
            const name =
              format(d, "EEEE d MMMM yyyy") +
              (isToday ? ", today" : "") +
              (n === undefined ? "" : `, ${n === 0 ? "no" : n} ${countNoun}${n === 1 ? "" : "s"}`);
            return (
              <button
                key={dayKey(d)}
                type="button"
                data-day={dayKey(d)}
                tabIndex={isSameDay(d, tabStop) ? 0 : -1}
                aria-pressed={selected}
                aria-current={isToday ? "date" : undefined}
                aria-label={name}
                onClick={() => select(d, false)}
                onKeyDown={(e) => onKeyDown(e, d)}
                className={cn(
                  "relative flex h-[58px] w-10 shrink-0 snap-center flex-col items-center justify-center gap-1 rounded-[var(--radius-panel)] transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  selected ? "bg-ink text-paper" : "text-ink hover:bg-sunken",
                )}
              >
                <span aria-hidden className={cn("text-[12px] leading-none", selected ? "text-paper/70" : "text-ink-3")}>
                  {format(d, "EEEEE")}
                </span>
                <span aria-hidden className="num text-[15px] font-medium leading-none">
                  {format(d, "d")}
                </span>
                <span
                  aria-hidden
                  className={cn("size-1 rounded-full", isToday ? "bg-accent" : "bg-transparent")}
                />
              </button>
            );
          })}
        </div>

        {footer ? <div className="border-t border-line">{footer}</div> : null}
      </div>
    </MotionConfig>
  );
}

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
