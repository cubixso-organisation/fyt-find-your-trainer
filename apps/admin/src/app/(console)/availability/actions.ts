"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, ForbiddenError } from "@/lib/auth";
import { audit, db, newId } from "@/lib/data/store";
import type { AvailabilityException, BookingTarget } from "@/lib/data/types";
import { addDays, istDateKey, istEpoch, isValidDateKey, weekdayOf } from "@/lib/slots";
import { fmtDate, minutesToLabel } from "@/lib/utils";
import type { ActionResult } from "../bookings/actions";

const rule = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(6 * 60, "Slots start at 6am or later.").max(23 * 60),
    endMinute: z.number().int().min(6 * 60).max(23 * 60 + 59),
    slotMinutes: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]),
    mode: z.enum(["online", "offline"]),
    capacity: z.number().int().min(1).max(50),
  })
  .refine((r) => r.endMinute - r.startMinute >= r.slotMinutes, "Each window must fit at least one slot.");

const schema = z.object({
  targetType: z.enum(["course", "trainer", "mentor", "consultant"]),
  targetId: z.string(),
  rules: z.array(rule).max(40),
});

export async function saveAvailability(input: z.input<typeof schema>): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("availability");
    const v = schema.parse(input);
    const d = db();
    const name =
      v.targetType === "course" ? d.courses.find((c) => c.id === v.targetId)?.title : d.providers.find((p) => p.id === v.targetId)?.name;
    if (!name) return { ok: false, error: "That listing no longer exists." };
    for (let day = 0; day < 7; day++) {
      const rs = v.rules.filter((r) => r.weekday === day).sort((a, b) => a.startMinute - b.startMinute);
      for (let i = 1; i < rs.length; i++)
        if (rs[i].startMinute < rs[i - 1].endMinute)
          return { ok: false, error: `Two windows overlap on ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]}.` };
    }
    if (v.targetType !== "course" && v.rules.some((r) => r.capacity > 1))
      return { ok: false, error: "1-on-1 sessions have a capacity of 1. Only course demos can be group sessions." };
    d.availability = d.availability.filter((a) => a.targetId !== v.targetId).concat(
      v.rules.map((r) => ({ ...r, id: newId("av"), targetId: v.targetId, targetType: v.targetType as BookingTarget })),
    );
    audit(admin, "availability.update", name, { detail: `${v.rules.length} weekly window${v.rules.length === 1 ? "" : "s"}` });
    revalidatePath("/availability");
    return { ok: true, message: `Availability for ${name} saved. New slots appear in the app right away.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the windows." };
    console.error(e);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}

/* ---------------- Date exceptions ---------------- */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const minute = z.number().int().min(0).max(24 * 60);

const exceptionSchema = z
  .object({
    targetType: z.enum(["course", "trainer", "mentor", "consultant"]),
    targetId: z.string().min(1).max(64),
    date: z.string().refine(isValidDateKey, "Pick a valid date."),
    kind: z.enum(["blocked", "extra"]),
    startMinute: minute.optional(),
    endMinute: minute.optional(),
    slotMinutes: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]).optional(),
    mode: z.enum(["online", "offline"]).optional(),
    capacity: z.number().int().min(1).max(50).optional(),
    reason: z
      .string()
      .trim()
      .max(120, "Keep the reason under 120 characters.")
      .optional()
      .transform((v) => v || undefined),
  })
  .superRefine((v, ctx) => {
    const hasStart = v.startMinute !== undefined;
    const hasEnd = v.endMinute !== undefined;
    if (hasStart !== hasEnd) ctx.addIssue({ code: "custom", message: "Give both a start and an end time, or neither for the whole day." });
    if (hasStart && hasEnd && v.endMinute! <= v.startMinute!) ctx.addIssue({ code: "custom", message: "The end time must be after the start time." });
    if (v.kind === "extra") {
      if (!hasStart || !hasEnd) ctx.addIssue({ code: "custom", message: "An extra window needs a start and an end time." });
      if (!v.slotMinutes || !v.mode || !v.capacity) ctx.addIssue({ code: "custom", message: "An extra window needs a slot length, a mode and seats." });
      else if (hasStart && hasEnd && v.endMinute! - v.startMinute! < v.slotMinutes)
        ctx.addIssue({ code: "custom", message: "The window must fit at least one slot." });
      if (hasStart && v.startMinute! < 6 * 60) ctx.addIssue({ code: "custom", message: "Slots start at 6am or later." });
    }
  });

function listingName(type: BookingTarget, id: string): string | undefined {
  const d = db();
  return type === "course" ? d.courses.find((c) => c.id === id)?.title : d.providers.find((p) => p.id === id && p.type === type)?.name;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

export async function addAvailabilityException(input: z.input<typeof exceptionSchema>): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("availability");
    const v = exceptionSchema.parse(input);
    const d = db();
    const name = listingName(v.targetType, v.targetId);
    if (!name) return { ok: false, error: "That listing no longer exists." };

    const now = Date.now();
    const today = istDateKey(now);
    if (v.date < today) return { ok: false, error: "That date has passed. Pick today or a later date." };
    if (v.date > addDays(today, 365)) return { ok: false, error: "Exceptions can be set up to a year ahead." };

    const mine = d.availabilityExceptions.filter((x) => x.targetId === v.targetId);
    if (mine.length >= 200) return { ok: false, error: "This listing has 200 exceptions. Remove old ones first." };
    const sameDay = mine.filter((x) => x.date === v.date);
    const whole = v.kind === "blocked" && v.startMinute === undefined;
    const label = fmtDate(istEpoch(v.date, 12 * 60), { weekday: "short", day: "numeric", month: "short" });

    if (sameDay.some((x) => x.kind === "blocked" && x.startMinute === undefined))
      return { ok: false, error: `${label} is already blocked for the whole day.` };
    if (whole && sameDay.length)
      return { ok: false, error: `${label} already has ${sameDay.length === 1 ? "an exception" : `${sameDay.length} exceptions`}. Remove ${sameDay.length === 1 ? "it" : "them"} before blocking the whole day.` };
    if (!whole) {
      const clash = sameDay.find((x) => x.kind === v.kind && overlap(x.startMinute!, x.endMinute!, v.startMinute!, v.endMinute!));
      if (clash) return { ok: false, error: `This overlaps another ${v.kind === "extra" ? "extra window" : "block"} on ${label} (${minutesToLabel(clash.startMinute!)}–${minutesToLabel(clash.endMinute!)}).` };
    }
    if (v.kind === "extra") {
      if (v.targetType !== "course" && v.capacity! > 1)
        return { ok: false, error: "1-on-1 sessions have a capacity of 1. Only course demos can be group sessions." };
      const weekday = weekdayOf(v.date);
      const rule = d.availability.find((r) => r.targetId === v.targetId && r.weekday === weekday && overlap(r.startMinute, r.endMinute, v.startMinute!, v.endMinute!));
      if (rule)
        return { ok: false, error: `The weekly ${DAY_NAMES[weekday]} window ${minutesToLabel(rule.startMinute)}–${minutesToLabel(rule.endMinute)} already covers part of this. Pick times outside it.` };
    }

    const exception: AvailabilityException = {
      id: newId("avx"),
      targetType: v.targetType,
      targetId: v.targetId,
      date: v.date,
      kind: v.kind,
      ...(v.startMinute !== undefined ? { startMinute: v.startMinute, endMinute: v.endMinute } : {}),
      ...(v.kind === "extra" ? { slotMinutes: v.slotMinutes, mode: v.mode, capacity: v.capacity } : {}),
      reason: v.reason,
      createdBy: admin.id,
      createdAt: now,
    };
    d.availabilityExceptions.push(exception);

    // Blocking time does not cancel anyone. Tell the operator who is affected.
    let affected = 0;
    if (v.kind === "blocked") {
      const from = istEpoch(v.date, v.startMinute ?? 0);
      const to = istEpoch(v.date, v.endMinute ?? 24 * 60);
      affected = d.bookings.filter(
        (b) => b.targetId === v.targetId && ["requested", "confirmed", "meet_failed"].includes(b.status) && overlap(b.start, b.end, from, to),
      ).length;
    }
    const what = whole
      ? "whole day blocked"
      : v.kind === "blocked"
        ? `blocked ${minutesToLabel(v.startMinute!)}–${minutesToLabel(v.endMinute!)}`
        : `extra window ${minutesToLabel(v.startMinute!)}–${minutesToLabel(v.endMinute!)}`;
    audit(admin, "availability.exception.add", name, {
      detail: `${v.date}: ${what}${v.reason ? ` (${v.reason})` : ""}${affected ? `; ${affected} booking${affected === 1 ? "" : "s"} inside` : ""}`,
      severity: v.kind === "blocked" ? "notice" : "info",
    });
    revalidatePath("/availability");
    return {
      ok: true,
      message: affected
        ? `${label}: ${what}. ${affected} existing booking${affected === 1 ? " falls" : "s fall"} inside it and ${affected === 1 ? "was" : "were"} not cancelled. Reschedule from Bookings.`
        : `${label}: ${what}. The app shows the change right away.`,
    };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the exception." };
    console.error(e);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}

export async function removeAvailabilityException(input: { id: string }): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("availability");
    const { id } = z.object({ id: z.string().min(1).max(64) }).parse(input);
    const d = db();
    const cur = d.availabilityExceptions.find((x) => x.id === id);
    if (!cur) return { ok: false, error: "That exception was already removed." };
    d.availabilityExceptions = d.availabilityExceptions.filter((x) => x.id !== id);
    const name = listingName(cur.targetType, cur.targetId) ?? cur.targetId;
    audit(admin, "availability.exception.remove", name, {
      detail: `${cur.date}: ${cur.kind === "extra" ? "extra window" : cur.startMinute === undefined ? "whole-day block" : "partial block"} removed`,
    });
    revalidatePath("/availability");
    return { ok: true, message: cur.kind === "extra" ? "Extra window removed." : "Block removed. Its slots are bookable again." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: "Check the request." };
    console.error(e);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}
