/**
 * Unit tests for the pure slot generator. Runs on Node's built-in test runner
 * with native TypeScript type stripping (Node >= 22.18), no extra deps:
 *
 *   npm test          (node --test src/lib/*.test.ts)
 *
 * The module is loaded through a URL so Node gets an explicit `.ts` path while
 * `tsc` still type-checks it against `./slots`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

type SlotsModule = typeof import("./slots");
const mod: SlotsModule = await import(new URL("./slots.ts", import.meta.url).href);
const { generateSlots, planDays, istEpoch, istDateKey, weekdayOf, addDays } = mod;

// 2026-10-05 is a Monday. "now" is Sunday 2026-10-04 08:00 IST.
const NOW = istEpoch("2026-10-04", 8 * 60);
const MON = "2026-10-05";
const TUE = "2026-10-06";

const monMorning = { weekday: 1, startMinute: 10 * 60, endMinute: 12 * 60, slotMinutes: 60, mode: "online" as const, capacity: 1 };
const tueMorning = { ...monMorning, weekday: 2 };

const base = { exceptions: [], bookings: [], leadHours: 4, now: NOW, from: MON, to: TUE };

describe("IST helpers", () => {
  it("maps IST dates and weekdays without DST drift", () => {
    assert.equal(weekdayOf(MON), 1);
    assert.equal(addDays(MON, 1), TUE);
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    // 10:00 IST is 04:30 UTC
    assert.equal(new Date(istEpoch(MON, 600)).toISOString(), "2026-10-05T04:30:00.000Z");
    // 00:15 IST on Tuesday is still Monday in UTC, but Tuesday in IST
    assert.equal(istDateKey(istEpoch(TUE, 15)), TUE);
  });
  it("rejects malformed dates", () => {
    assert.throws(() => weekdayOf("2026-02-30"));
    assert.throws(() => weekdayOf("5 Oct"));
  });
});

describe("generateSlots", () => {
  it("expands weekly rules into back-to-back slots on matching weekdays only", () => {
    const slots = generateSlots({ ...base, rules: [monMorning, { ...monMorning, startMinute: 14 * 60, endMinute: 15 * 60 + 30 }] });
    // Mon 10-11, 11-12, 14-15 (15:00-15:30 remainder dropped); nothing on Tue
    assert.deepEqual(
      slots.map((s) => [s.date, s.startMinute, s.endMinute]),
      [[MON, 600, 660], [MON, 660, 720], [MON, 840, 900]],
    );
    assert.equal(slots[0].start, istEpoch(MON, 600));
    assert.equal(slots[0].end - slots[0].start, 60 * 60_000);
    assert.equal(slots[0].remaining, 1);
    assert.equal(slots[0].source, "weekly");
  });

  it("drops every slot on a whole-day block, including extra windows", () => {
    const q = {
      ...base,
      rules: [monMorning, tueMorning],
      exceptions: [
        { id: "x1", date: MON, kind: "blocked" as const, reason: "Dussehra" },
        { id: "x2", date: MON, kind: "extra" as const, startMinute: 16 * 60, endMinute: 17 * 60, slotMinutes: 60 },
      ],
    };
    const slots = generateSlots(q);
    assert.ok(slots.every((s) => s.date === TUE));
    assert.equal(slots.length, 2);
    const mon = planDays(q)[0];
    assert.deepEqual(mon.blocked, { reason: "Dussehra", exceptionId: "x1" });
  });

  it("removes only the slots that overlap a partial block", () => {
    const slots = generateSlots({
      ...base,
      rules: [monMorning],
      exceptions: [{ date: MON, kind: "blocked", startMinute: 10 * 60 + 30, endMinute: 11 * 60, reason: "Dentist" }],
    });
    // 10:00-11:00 overlaps 10:30-11:00; 11:00-12:00 does not (half-open interval)
    assert.deepEqual(slots.map((s) => s.startMinute), [660]);
  });

  it("adds an extra one-off window, and weekly slots win any overlap", () => {
    const slots = generateSlots({
      ...base,
      rules: [monMorning],
      exceptions: [
        { id: "e1", date: TUE, kind: "extra", startMinute: 18 * 60, endMinute: 19 * 60 + 30, slotMinutes: 45, mode: "offline", capacity: 3 },
        { id: "e2", date: MON, kind: "extra", startMinute: 11 * 60 + 30, endMinute: 13 * 60, slotMinutes: 30 },
      ],
    });
    const tue = slots.filter((s) => s.date === TUE);
    assert.deepEqual(tue.map((s) => [s.startMinute, s.mode, s.capacity, s.source, s.exceptionId]), [
      [1080, "offline", 3, "extra", "e1"],
      [1125, "offline", 3, "extra", "e1"],
    ]);
    // Monday extra 11:30-12:00 collides with weekly 11-12 and is skipped; 12:00-13:00 survive
    assert.deepEqual(slots.filter((s) => s.date === MON).map((s) => [s.startMinute, s.source]), [
      [600, "weekly"], [660, "weekly"], [720, "extra"], [750, "extra"],
    ]);
  });

  it("hides a fully booked slot and counts remaining seats; cancelled bookings free a seat", () => {
    const group = { ...monMorning, endMinute: 11 * 60, capacity: 2 };
    const at = (m: number) => ({ start: istEpoch(MON, m), end: istEpoch(MON, m + 60) });
    const one = generateSlots({ ...base, rules: [group], bookings: [{ ...at(600), status: "confirmed" }, { ...at(600), status: "cancelled" }] });
    assert.equal(one.length, 1);
    assert.equal(one[0].booked, 1);
    assert.equal(one[0].remaining, 1);

    const full = { ...base, rules: [group], bookings: [{ ...at(600), status: "confirmed" as const }, { ...at(600), status: "requested" as const }] };
    assert.equal(generateSlots(full).length, 0);
    assert.equal(planDays(full)[0].slots[0].state, "full");
  });

  it("does not offer slots inside the booking lead time", () => {
    // now = Monday 07:30 IST, lead 3h -> cutoff 10:30. 10:00 is too soon, 11:00 is offered.
    const q = { ...base, rules: [monMorning], now: istEpoch(MON, 7 * 60 + 30), leadHours: 3 };
    assert.deepEqual(generateSlots(q).map((s) => s.startMinute), [660]);
    assert.equal(planDays(q)[0].slots[0].state, "too_soon");
    // a slot exactly at the cutoff is offered
    assert.deepEqual(generateSlots({ ...q, leadHours: 3.5 }).map((s) => s.startMinute), [660]);
    assert.deepEqual(generateSlots({ ...q, leadHours: 2.5 }).map((s) => s.startMinute), [600, 660]);
  });

  it("is deterministic for the same input", () => {
    const q = { ...base, rules: [monMorning, tueMorning] };
    assert.deepEqual(generateSlots(q), generateSlots(q));
  });
});
