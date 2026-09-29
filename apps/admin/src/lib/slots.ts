/**
 * Slot generator: turns weekly availability rules plus date exceptions into
 * the concrete slots a learner is offered.
 *
 * This module is PURE (no clock, no store, no I/O) and has only type imports,
 * so it runs unchanged in the console, in `node --test`, and in the Cloud
 * Function `getSlots`, which must mirror it exactly. Change the rules here and
 * in the Function together.
 *
 * Rules, in order of precedence:
 *  1. Time zone. Every date and minute is Asia/Kolkata (UTC+05:30, no DST).
 *     A date is a "YYYY-MM-DD" IST calendar day; minutes count from IST
 *     midnight. Epoch ms = UTC midnight of that date + minutes - 5h30m.
 *  2. Whole-day block. A `blocked` exception with no times closes the date
 *     completely: no weekly slots and no extra windows.
 *  3. Windows. The date's windows are the weekly rules for its weekday plus
 *     every `extra` exception on that date. Each window is cut into back-to-
 *     back slots of `slotMinutes` from its start; a trailing remainder shorter
 *     than one slot is dropped.
 *  4. Overlap. If an extra-window slot overlaps a slot already produced by a
 *     weekly rule, the weekly slot wins and the extra one is skipped.
 *  5. Partial block. A `blocked` exception with times removes every slot that
 *     overlaps [startMinute, endMinute).
 *  6. Seats. Every booking that is not `cancelled` and overlaps a slot holds
 *     one seat in it. remaining = max(0, capacity - booked).
 *  7. Lead time. A slot starting before `now + leadHours` is not offered.
 *  8. Offered = not blocked, remaining > 0 and outside the lead time.
 *     Output is sorted by start time, then by mode.
 */
import type { Booking, Mode } from "./data/types";

export const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const MIN_MS = 60_000;

export interface SlotRule {
  weekday: number; // 0 = Sunday, IST
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  mode: Mode;
  capacity: number;
}

export interface SlotException {
  id?: string;
  date: string; // YYYY-MM-DD, IST
  kind: "blocked" | "extra";
  startMinute?: number;
  endMinute?: number;
  slotMinutes?: number;
  mode?: Mode;
  capacity?: number;
  reason?: string;
}

export type SlotBooking = Pick<Booking, "start" | "end" | "status">;

export interface SlotQuery {
  rules: readonly SlotRule[];
  exceptions: readonly SlotException[];
  /** Bookings for this one listing. */
  bookings: readonly SlotBooking[];
  /** From PlatformSettings.bookingLeadHours. */
  leadHours: number;
  /** Epoch ms. Passed in, never read from the clock, so output is deterministic. */
  now: number;
  /** First IST date, inclusive. */
  from: string;
  /** Last IST date, inclusive. */
  to: string;
}

export type SlotState = "open" | "full" | "too_soon";

export interface Slot {
  date: string;
  start: number;
  end: number;
  startMinute: number;
  endMinute: number;
  mode: Mode;
  capacity: number;
  booked: number;
  remaining: number;
  source: "weekly" | "extra";
  exceptionId?: string;
  state: SlotState;
}

export interface DayPlan {
  date: string;
  weekday: number;
  /** Whole-day block, if any. */
  blocked: { reason?: string; exceptionId?: string } | null;
  /** Partial blocks that removed at least one slot, or apply to the day. */
  partialBlocks: Array<{ startMinute: number; endMinute: number; reason?: string; exceptionId?: string }>;
  /** Every slot that survives blocking, with its state. Offered slots have state "open". */
  slots: Slot[];
}

/* ---------------- IST date helpers ---------------- */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** UTC-midnight epoch of a YYYY-MM-DD string; throws on an invalid date. */
function utcMidnight(date: string): number {
  const m = DATE_RE.exec(date);
  if (!m) throw new RangeError(`Invalid date "${date}", expected YYYY-MM-DD`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d)
    throw new RangeError(`Invalid date "${date}"`);
  return t;
}

export function isValidDateKey(date: string): boolean {
  try {
    utcMidnight(date);
    return true;
  } catch {
    return false;
  }
}

/** IST calendar date ("YYYY-MM-DD") that contains epoch `ms`. */
export function istDateKey(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  return new Date(utcMidnight(date) + n * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday. The weekday of an IST date equals the UTC weekday of the same Y-M-D. */
export function weekdayOf(date: string): number {
  return new Date(utcMidnight(date)).getUTCDay();
}

/** Epoch ms of `minute` past IST midnight on `date`. */
export function istEpoch(date: string, minute: number): number {
  return utcMidnight(date) + minute * MIN_MS - IST_OFFSET_MS;
}

/* ---------------- generator ---------------- */

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

function cut(
  date: string,
  w: { startMinute: number; endMinute: number; slotMinutes: number; mode: Mode; capacity: number },
  source: Slot["source"],
  exceptionId?: string,
): Omit<Slot, "booked" | "remaining" | "state">[] {
  const out: Omit<Slot, "booked" | "remaining" | "state">[] = [];
  if (!(w.slotMinutes > 0) || !(w.capacity > 0)) return out;
  for (let s = w.startMinute; s + w.slotMinutes <= w.endMinute; s += w.slotMinutes) {
    out.push({
      date,
      start: istEpoch(date, s),
      end: istEpoch(date, s + w.slotMinutes),
      startMinute: s,
      endMinute: s + w.slotMinutes,
      mode: w.mode,
      capacity: w.capacity,
      source,
      exceptionId,
    });
  }
  return out;
}

/** Day-by-day plan for the preview: blocked days, and every slot with its state. */
export function planDays(q: SlotQuery): DayPlan[] {
  const first = utcMidnight(q.from);
  const last = utcMidnight(q.to);
  const cutoff = q.now + q.leadHours * 3_600_000;
  const live = q.bookings.filter((b) => b.status !== "cancelled");
  const days: DayPlan[] = [];

  for (let t = first; t <= last; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    const weekday = new Date(t).getUTCDay();
    const exc = q.exceptions.filter((e) => e.date === date);
    const whole = exc.find((e) => e.kind === "blocked" && (e.startMinute === undefined || e.endMinute === undefined));
    if (whole) {
      days.push({ date, weekday, blocked: { reason: whole.reason, exceptionId: whole.id }, partialBlocks: [], slots: [] });
      continue;
    }

    const weekly = q.rules
      .filter((r) => r.weekday === weekday)
      .slice()
      .sort((a, b) => a.startMinute - b.startMinute)
      .flatMap((r) => cut(date, r, "weekly"));
    const extras = exc
      .filter((e) => e.kind === "extra" && e.startMinute !== undefined && e.endMinute !== undefined)
      .slice()
      .sort((a, b) => a.startMinute! - b.startMinute!)
      .flatMap((e) =>
        cut(
          date,
          {
            startMinute: e.startMinute!,
            endMinute: e.endMinute!,
            slotMinutes: e.slotMinutes ?? 60,
            mode: e.mode ?? "online",
            capacity: e.capacity ?? 1,
          },
          "extra",
          e.id,
        ),
      );
    const candidates = [...weekly];
    for (const x of extras) if (!candidates.some((c) => overlaps(c.start, c.end, x.start, x.end))) candidates.push(x);

    const partialBlocks = exc
      .filter((e) => e.kind === "blocked" && e.startMinute !== undefined && e.endMinute !== undefined)
      .map((e) => ({ startMinute: e.startMinute!, endMinute: e.endMinute!, reason: e.reason, exceptionId: e.id }))
      .sort((a, b) => a.startMinute - b.startMinute);

    const slots: Slot[] = candidates
      .filter((c) => !partialBlocks.some((p) => overlaps(c.startMinute, c.endMinute, p.startMinute, p.endMinute)))
      .map((c) => {
        const booked = live.filter((b) => overlaps(b.start, b.end, c.start, c.end)).length;
        const remaining = Math.max(0, c.capacity - booked);
        const state: SlotState = c.start < cutoff ? "too_soon" : remaining === 0 ? "full" : "open";
        return { ...c, booked, remaining, state };
      })
      .sort((a, b) => a.start - b.start || a.mode.localeCompare(b.mode));

    days.push({ date, weekday, blocked: null, partialBlocks, slots });
  }
  return days;
}

/** The bookable slots a learner is offered in [from, to]. Mirrors Cloud Function `getSlots`. */
export function generateSlots(q: SlotQuery): Slot[] {
  return planDays(q).flatMap((d) => d.slots.filter((s) => s.state === "open"));
}
