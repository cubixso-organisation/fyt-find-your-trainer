"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, ForbiddenError } from "@/lib/auth";
import { audit, db } from "@/lib/data/store";
import type { BookingStatus } from "@/lib/data/types";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  if (e instanceof ForbiddenError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the form." };
  console.error(e);
  return { ok: false, error: "Something went wrong. Nothing was changed." };
}

function find(id: string) {
  const b = db().bookings.find((x) => x.id === id);
  if (!b) throw new ForbiddenError("That booking no longer exists.");
  return b;
}

function meetCode() {
  const a = "abcdefghijkmnopqrstuvwxyz";
  const s = (n: number) => Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join("");
  return `https://meet.google.com/${s(3)}-${s(4)}-${s(3)}`;
}

const ALLOWED: Record<BookingStatus, BookingStatus[]> = {
  requested: ["confirmed", "cancelled"],
  meet_failed: ["confirmed", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  completed: [],
  no_show: [],
  cancelled: [],
};

export async function confirmBooking(id: string): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("bookings");
    const b = find(id);
    if (!ALLOWED[b.status].includes("confirmed")) return { ok: false, error: "Only requested bookings can be confirmed." };
    if (b.mode === "online") b.meetLink = meetCode();
    b.status = "confirmed";
    b.updatedAt = Date.now();
    audit(admin, "booking.confirm", b.ref);
    revalidatePath("/", "layout");
    return { ok: true, message: `${b.ref} confirmed${b.mode === "online" ? " and Meet link sent" : ""}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function retryMeetLink(id: string): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("bookings");
    const b = find(id);
    if (b.status !== "meet_failed") return { ok: false, error: "This booking already has a working link." };
    // In production this calls the createMeetLink Cloud Function.
    b.meetLink = meetCode();
    b.status = "confirmed";
    b.updatedAt = Date.now();
    audit(admin, "booking.meet_retry", b.ref, { severity: "notice" });
    revalidatePath("/", "layout");
    return { ok: true, message: `New Meet link created for ${b.ref}. Both parties were notified.` };
  } catch (e) {
    return fail(e);
  }
}

const cancelSchema = z.object({ id: z.string(), reason: z.string().trim().min(3, "Give a short reason; the learner sees it.").max(160) });

export async function cancelBooking(input: { id: string; reason: string }): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("bookings");
    const { id, reason } = cancelSchema.parse(input);
    const b = find(id);
    if (!ALLOWED[b.status].includes("cancelled")) return { ok: false, error: "This booking can't be cancelled anymore." };
    b.status = "cancelled";
    b.cancelledReason = reason;
    b.updatedAt = Date.now();
    audit(admin, "booking.cancel", b.ref, { detail: reason, severity: "notice" });
    revalidatePath("/", "layout");
    return { ok: true, message: `${b.ref} cancelled. The learner was notified.` };
  } catch (e) {
    return fail(e);
  }
}

const rescheduleSchema = z.object({ id: z.string(), start: z.number().int() });

export async function rescheduleBooking(input: { id: string; start: number }): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("bookings");
    const { id, start } = rescheduleSchema.parse(input);
    const b = find(id);
    if (!["requested", "confirmed", "meet_failed"].includes(b.status)) return { ok: false, error: "Only upcoming bookings can be moved." };
    if (start < Date.now() + 60 * 60_000) return { ok: false, error: "Pick a time at least an hour from now." };
    const dur = b.end - b.start;
    const clash = db().bookings.some(
      (o) => o.id !== b.id && o.targetId === b.targetId && o.targetType !== "course" && ["confirmed", "requested"].includes(o.status) && o.start < start + dur && start < o.end,
    );
    if (clash) return { ok: false, error: "That slot is already booked for this provider." };
    b.start = start;
    b.end = start + dur;
    b.updatedAt = Date.now();
    audit(admin, "booking.reschedule", b.ref, { severity: "notice" });
    revalidatePath("/", "layout");
    return { ok: true, message: `${b.ref} moved. Both parties were notified.` };
  } catch (e) {
    return fail(e);
  }
}

export async function markOutcome(input: { id: string; outcome: "completed" | "no_show" }): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("bookings");
    const b = find(input.id);
    if (!ALLOWED[b.status].includes(input.outcome)) return { ok: false, error: "Only confirmed bookings get an outcome." };
    if (b.start > Date.now()) return { ok: false, error: "This session hasn't happened yet." };
    b.status = input.outcome;
    b.updatedAt = Date.now();
    audit(admin, `booking.${input.outcome}`, b.ref);
    revalidatePath("/", "layout");
    return { ok: true, message: `${b.ref} marked ${input.outcome === "completed" ? "attended" : "no-show"}.` };
  } catch (e) {
    return fail(e);
  }
}
