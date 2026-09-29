"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, ForbiddenError } from "@/lib/auth";
import { audit, db, newId } from "@/lib/data/store";
import type { BookingTarget } from "@/lib/data/types";
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
