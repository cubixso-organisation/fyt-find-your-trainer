"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, ForbiddenError } from "@/lib/auth";
import { audit, db } from "@/lib/data/store";
import type { ActionResult } from "../bookings/actions";

function fail(e: unknown): ActionResult {
  if (e instanceof ForbiddenError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the form." };
  console.error(e);
  return { ok: false, error: "Something went wrong. Nothing was changed." };
}

const settingsSchema = z.object({
  platformName: z.string().trim().min(3).max(60),
  supportEmail: z.string().trim().email("Enter a valid support email."),
  bookingLeadHours: z.coerce.number().int().min(0, "Lead time can't be negative.").max(168),
  cancellationWindowHours: z.coerce.number().int().min(0).max(72),
  reminderMinutes: z
    .array(z.coerce.number().int().min(5, "Reminders are at least 5 minutes before.").max(1440))
    .min(1, "Keep at least one reminder.")
    .max(3, "Up to three reminders.")
    .transform((a) => [...new Set(a)].sort((x, y) => y - x)),
  meetProvider: z.enum(["google_workspace", "oauth_account"]),
});

export async function saveSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("settings");
    const v = settingsSchema.parse(input);
    const s = db().settings;
    const changed = (Object.keys(v) as Array<keyof typeof v>).filter((k) => JSON.stringify(s[k]) !== JSON.stringify(v[k]));
    if (!changed.length) return { ok: true, message: "No changes." };
    Object.assign(s, v);
    audit(admin, "settings.update", undefined, { detail: `Changed: ${changed.join(", ")}`, severity: "notice" });
    revalidatePath("/settings");
    return { ok: true, message: "Settings saved. The app picks them up within a minute." };
  } catch (e) {
    return fail(e);
  }
}

const taxonomySchema = z.object({
  categories: z.array(z.string().trim().min(2).max(40)).min(1, "Keep at least one category.").max(30),
  techStacks: z.array(z.string().trim().min(1).max(40)).min(1, "Keep at least one technology.").max(80),
  featured: z.object({ institutes: z.array(z.string()).max(12), courses: z.array(z.string()).max(12), providers: z.array(z.string()).max(12) }),
});

export async function saveTaxonomy(input: z.input<typeof taxonomySchema>): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("content");
    const v = taxonomySchema.parse(input);
    const d = db();
    const inUse = d.settings.categories.filter((c) => !v.categories.includes(c) && d.courses.some((x) => x.category === c));
    if (inUse.length) return { ok: false, error: `“${inUse[0]}” is still used by courses. Recategorise them before removing it.` };
    d.settings.categories = v.categories;
    d.settings.techStacks = v.techStacks;
    d.settings.homeFeatured = v.featured;
    for (const i of d.institutes) i.featured = v.featured.institutes.includes(i.id);
    for (const c of d.courses) c.featured = v.featured.courses.includes(c.id);
    for (const p of d.providers) p.featured = v.featured.providers.includes(p.id);
    audit(admin, "content.update", "App home", { severity: "notice" });
    revalidatePath("/content");
    return { ok: true, message: "App home and taxonomy saved." };
  } catch (e) {
    return fail(e);
  }
}
