import "server-only";
import { db } from "./store";
import type { Booking, BookingTarget } from "./types";
import { istDayStart } from "../utils";

const DAY = 86_400_000;

export function targetName(type: BookingTarget, id: string): string {
  const d = db();
  if (type === "course") return d.courses.find((c) => c.id === id)?.title ?? "Removed course";
  return d.providers.find((p) => p.id === id)?.name ?? "Removed provider";
}

export function learnerName(id: string): string {
  return db().learners.find((l) => l.id === id)?.name ?? "Removed learner";
}

export interface BookingRow extends Booking {
  learnerName: string;
  learnerPhone: string;
  learnerSegment: "student" | "corporate";
  targetName: string;
}

export function toRow(b: Booking): BookingRow {
  const l = db().learners.find((x) => x.id === b.learnerId);
  return {
    ...b,
    learnerName: l?.name ?? "Removed learner",
    learnerPhone: l?.phone ?? "",
    learnerSegment: l?.segment ?? "student",
    targetName: targetName(b.targetType, b.targetId),
  };
}

/** Upcoming bookings an operator must act on. */
export function attentionBookings(now = Date.now()): BookingRow[] {
  return db()
    .bookings.filter((b) => b.start > now - 30 * 60_000 && (b.status === "requested" || b.status === "meet_failed"))
    .sort((a, b) => (a.status === "meet_failed" ? -1 : 0) - (b.status === "meet_failed" ? -1 : 0) || a.start - b.start)
    .map(toRow);
}

export function todaysBookings(now = Date.now()): BookingRow[] {
  const start = istDayStart(now);
  return db()
    .bookings.filter((b) => b.start >= start && b.start < start + DAY && b.status !== "cancelled")
    .sort((a, b) => a.start - b.start)
    .map(toRow);
}

function inRange<T>(items: T[], at: (t: T) => number, from: number, to: number) {
  return items.filter((i) => {
    const t = at(i);
    return t >= from && t < to;
  });
}

export interface PeriodMetric {
  current: number;
  previous: number;
}

export function overviewMetrics(now = Date.now(), days = 7) {
  const d = db();
  const from = now - days * DAY;
  const prevFrom = from - days * DAY;

  const regs: PeriodMetric = {
    current: inRange(d.learners, (l) => l.createdAt, from, now).length,
    previous: inRange(d.learners, (l) => l.createdAt, prevFrom, from).length,
  };
  const booked: PeriodMetric = {
    current: inRange(d.bookings, (b) => b.createdAt, from, now).length,
    previous: inRange(d.bookings, (b) => b.createdAt, prevFrom, from).length,
  };
  const heldNow = inRange(d.bookings, (b) => b.start, from, now).filter((b) => b.status !== "cancelled");
  const heldPrev = inRange(d.bookings, (b) => b.start, prevFrom, from).filter((b) => b.status !== "cancelled");
  const attendance: PeriodMetric = {
    current: heldNow.length ? heldNow.filter((b) => b.status === "completed").length / heldNow.length : 0,
    previous: heldPrev.length ? heldPrev.filter((b) => b.status === "completed").length / heldPrev.length : 0,
  };
  const onlineConfirmed = d.bookings.filter((b) => b.mode === "online" && b.start > from && (b.status === "confirmed" || b.status === "completed" || b.status === "meet_failed"));
  const meetRate = onlineConfirmed.length ? onlineConfirmed.filter((b) => b.status !== "meet_failed").length / onlineConfirmed.length : 1;

  return { regs, booked, attendance, meetRate, meetSample: onlineConfirmed.length, days };
}

/** Daily counts for the last `days` days (IST). */
export function dailySeries(days = 30, now = Date.now()) {
  const d = db();
  const today = istDayStart(now);
  const out: Array<{ day: number; registrations: number; bookings: number; students: number; corporate: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const s = today - i * DAY;
    const e = s + DAY;
    const regs = inRange(d.learners, (l) => l.createdAt, s, e);
    out.push({
      day: s,
      registrations: regs.length,
      students: regs.filter((l) => l.segment === "student").length,
      corporate: regs.filter((l) => l.segment === "corporate").length,
      bookings: inRange(d.bookings, (b) => b.createdAt, s, e).length,
    });
  }
  return out;
}

export function funnel(now = Date.now(), days = 30) {
  const d = db();
  const from = now - days * DAY;
  const learners = d.learners.filter((l) => l.createdAt >= from);
  const onboarded = learners.filter((l) => l.onboarded);
  const bookedIds = new Set(d.bookings.filter((b) => b.createdAt >= from).map((b) => b.learnerId));
  const booked = onboarded.filter((l) => bookedIds.has(l.id));
  const attendedIds = new Set(d.bookings.filter((b) => b.createdAt >= from && b.status === "completed").map((b) => b.learnerId));
  const attended = booked.filter((l) => attendedIds.has(l.id));
  return [
    { stage: "Registered", count: learners.length },
    { stage: "Finished onboarding", count: onboarded.length },
    { stage: "Booked a session", count: booked.length },
    { stage: "Attended", count: attended.length },
  ];
}

export function demandByListing(now = Date.now(), days = 30, limit = 8) {
  const d = db();
  const from = now - days * DAY;
  const map = new Map<string, { type: BookingTarget; id: string; bookings: number; completed: number }>();
  for (const b of d.bookings) {
    if (b.createdAt < from) continue;
    const k = `${b.targetType}:${b.targetId}`;
    const cur = map.get(k) ?? { type: b.targetType, id: b.targetId, bookings: 0, completed: 0 };
    cur.bookings += 1;
    if (b.status === "completed") cur.completed += 1;
    map.set(k, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, limit)
    .map((x) => ({ ...x, name: targetName(x.type, x.id) }));
}

export function bookingMix(now = Date.now(), days = 30) {
  const d = db();
  const from = now - days * DAY;
  const counts: Record<BookingTarget, number> = { course: 0, trainer: 0, mentor: 0, consultant: 0 };
  for (const b of d.bookings) if (b.createdAt >= from) counts[b.targetType] += 1;
  return counts;
}

export function badgeCounts() {
  return { bookingsAttention: attentionBookings().length };
}
