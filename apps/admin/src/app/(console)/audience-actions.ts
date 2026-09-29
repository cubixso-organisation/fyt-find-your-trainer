"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, ForbiddenError } from "@/lib/auth";
import { audit, db, newId } from "@/lib/data/store";
import type { ActionResult } from "./bookings/actions";

function fail(e: unknown): ActionResult {
  if (e instanceof ForbiddenError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the form." };
  console.error(e);
  return { ok: false, error: "Something went wrong. Nothing was changed." };
}

export async function setLearnerBlocked(input: { id: string; blocked: boolean; reason?: string }): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("learners");
    const l = db().learners.find((x) => x.id === input.id);
    if (!l) return { ok: false, error: "That learner no longer exists." };
    if (input.blocked && (!input.reason || input.reason.trim().length < 3)) return { ok: false, error: "Add a reason; it's kept in the audit log." };
    l.blocked = input.blocked;
    let cancelled = 0;
    if (input.blocked) {
      for (const b of db().bookings)
        if (b.learnerId === l.id && b.start > Date.now() && ["requested", "confirmed", "meet_failed"].includes(b.status)) {
          b.status = "cancelled";
          b.cancelledReason = "Account blocked";
          cancelled++;
        }
    }
    audit(admin, input.blocked ? "learner.block" : "learner.unblock", l.name, { severity: "notice", detail: input.reason });
    revalidatePath("/learners");
    return {
      ok: true,
      message: input.blocked
        ? `${l.name} is blocked${cancelled ? ` and ${cancelled} upcoming booking${cancelled === 1 ? " was" : "s were"} cancelled` : ""}.`
        : `${l.name} can book again.`,
    };
  } catch (e) {
    return fail(e);
  }
}

const broadcastSchema = z.object({
  title: z.string().trim().min(4, "Title needs at least 4 characters.").max(50, "Keep the title under 50 characters; phones truncate it."),
  body: z.string().trim().min(10, "Write at least 10 characters.").max(180, "Keep it under 180 characters so it fits a notification."),
  audience: z.enum(["all", "student", "corporate"]),
  when: z.enum(["now", "later"]),
  scheduledFor: z.number().optional(),
});

export async function createBroadcast(input: z.input<typeof broadcastSchema>): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("notifications");
    const v = broadcastSchema.parse(input);
    const d = db();
    if (v.when === "later" && (!v.scheduledFor || v.scheduledFor < Date.now() + 10 * 60_000))
      return { ok: false, error: "Schedule at least 10 minutes from now." };
    const reach = d.learners.filter((l) => !l.blocked && l.onboarded && (v.audience === "all" || l.segment === v.audience)).length;
    d.broadcasts.unshift({
      id: newId("bc"),
      title: v.title,
      body: v.body,
      audience: v.audience,
      status: v.when === "now" ? "sent" : "scheduled",
      sentAt: v.when === "now" ? Date.now() : undefined,
      scheduledFor: v.when === "later" ? v.scheduledFor : undefined,
      reach: v.when === "now" ? reach : undefined,
      createdBy: admin.id,
      createdAt: Date.now(),
    });
    audit(admin, v.when === "now" ? "broadcast.send" : "broadcast.schedule", v.title, { severity: "notice", detail: `Audience: ${v.audience}, ${reach} learners` });
    revalidatePath("/broadcasts");
    return { ok: true, message: v.when === "now" ? `Sent to ${reach} learners.` : "Broadcast scheduled." };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelScheduledBroadcast(id: string): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("notifications");
    const d = db();
    const b = d.broadcasts.find((x) => x.id === id);
    if (!b || b.status !== "scheduled") return { ok: false, error: "Only scheduled broadcasts can be withdrawn." };
    b.status = "draft";
    b.scheduledFor = undefined;
    audit(admin, "broadcast.schedule", b.title, { detail: "Withdrawn" });
    revalidatePath("/broadcasts");
    return { ok: true, message: "Scheduled broadcast withdrawn and kept as a draft." };
  } catch (e) {
    return fail(e);
  }
}
