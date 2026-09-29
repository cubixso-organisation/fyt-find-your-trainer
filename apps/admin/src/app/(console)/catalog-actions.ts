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

const list = z
  .array(z.string().trim().min(1))
  .max(20)
  .transform((a) => [...new Set(a)]);

/* ---------------- Institutes ---------------- */

const instituteSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(3, "Name needs at least 3 characters.").max(80),
  area: z.string().trim().min(2, "Pick an area."),
  address: z.string().trim().min(8, "Add the full street address so learners can find it.").max(200),
  phone: z.string().trim().regex(/^\+?[0-9 ]{10,16}$/, "Use a 10-digit Indian number, optionally with +91."),
  email: z.string().trim().email("Enter a valid email."),
  categories: list.refine((a) => a.length > 0, "Pick at least one category."),
  specializations: list,
  published: z.boolean(),
  featured: z.boolean(),
});

export async function saveInstitute(input: z.input<typeof instituteSchema>): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("institutes");
    const v = instituteSchema.parse(input);
    const d = db();
    const dupe = d.institutes.find((x) => x.name.toLowerCase() === v.name.toLowerCase() && x.id !== v.id);
    if (dupe) return { ok: false, error: `An institute called "${dupe.name}" already exists.` };
    const now = Date.now();
    if (v.id) {
      const cur = d.institutes.find((x) => x.id === v.id);
      if (!cur) return { ok: false, error: "That institute no longer exists." };
      Object.assign(cur, { ...v, updatedAt: now });
      audit(admin, "institute.update", cur.name);
    } else {
      d.institutes.unshift({ ...v, id: newId("ins"), galleryCount: 0, createdAt: now, updatedAt: now });
      audit(admin, "institute.create", v.name);
    }
    revalidatePath("/institutes");
    return { ok: true, message: v.id ? "Institute saved." : `${v.name} added${v.published ? " and visible in the app" : " as hidden"}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteInstitute(id: string): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("institutes");
    const d = db();
    const cur = d.institutes.find((x) => x.id === id);
    if (!cur) return { ok: false, error: "That institute no longer exists." };
    const linked = d.courses.filter((c) => c.instituteId === id).length;
    if (linked) return { ok: false, error: `${linked} course${linked === 1 ? " is" : "s are"} linked to this institute. Move or delete them first, or hide the institute instead.` };
    d.institutes = d.institutes.filter((x) => x.id !== id);
    audit(admin, "institute.delete", cur.name, { severity: "notice" });
    revalidatePath("/institutes");
    return { ok: true, message: `${cur.name} deleted.` };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- Courses & projects ---------------- */

const courseSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(["course", "project"]),
  title: z.string().trim().min(4, "Title needs at least 4 characters.").max(90),
  instituteId: z.string().optional().transform((v) => v || undefined),
  category: z.string().min(1, "Pick a category."),
  techStack: list.refine((a) => a.length > 0, "Add at least one technology so filters work."),
  durationWeeks: z.coerce.number().int().min(1, "Duration is at least 1 week.").max(104),
  modes: z.array(z.enum(["online", "offline"])).min(1, "Choose online, in person, or both."),
  description: z.string().trim().min(20, "Describe it in at least 20 characters.").max(1200),
  published: z.boolean(),
  featured: z.boolean(),
});

export async function saveCourse(input: z.input<typeof courseSchema>): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("courses");
    const v = courseSchema.parse(input);
    const d = db();
    if (v.modes.includes("offline") && !v.instituteId && v.kind === "course")
      return { ok: false, error: "In-person courses need an institute so learners get an address." };
    const now = Date.now();
    if (v.id) {
      const cur = d.courses.find((x) => x.id === v.id);
      if (!cur) return { ok: false, error: "That listing no longer exists." };
      Object.assign(cur, { ...v, updatedAt: now });
      audit(admin, "course.update", cur.title);
    } else {
      d.courses.unshift({ ...v, id: newId("crs"), createdAt: now, updatedAt: now });
      audit(admin, "course.create", v.title);
    }
    revalidatePath("/courses");
    return { ok: true, message: v.id ? "Listing saved." : `${v.title} added.` };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCourse(id: string): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("courses");
    const d = db();
    const cur = d.courses.find((x) => x.id === id);
    if (!cur) return { ok: false, error: "That listing no longer exists." };
    const upcoming = d.bookings.filter((b) => b.targetId === id && b.start > Date.now() && ["requested", "confirmed"].includes(b.status)).length;
    if (upcoming) return { ok: false, error: `${upcoming} upcoming booking${upcoming === 1 ? "" : "s"} still point here. Hide the listing instead, or cancel them first.` };
    d.courses = d.courses.filter((x) => x.id !== id);
    audit(admin, "course.delete", cur.title, { severity: "notice" });
    revalidatePath("/courses");
    return { ok: true, message: `${cur.title} deleted.` };
  } catch (e) {
    return fail(e);
  }
}

export async function setCoursesPublished(ids: string[], published: boolean): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("courses");
    const d = db();
    let n = 0;
    for (const c of d.courses) {
      if (!ids.includes(c.id) || c.published === published) continue;
      c.published = published;
      c.updatedAt = Date.now();
      n++;
    }
    audit(admin, "course.update", `${n} listing${n === 1 ? "" : "s"}`, { detail: published ? "Published" : "Hidden" });
    revalidatePath("/courses");
    return { ok: true, message: `${n} listing${n === 1 ? "" : "s"} ${published ? "published" : "hidden"}.` };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- Providers ---------------- */

const providerSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["trainer", "mentor", "consultant"]),
  name: z.string().trim().min(3, "Name needs at least 3 characters.").max(80),
  isOrganisation: z.boolean(),
  headline: z.string().trim().min(10, "Write a one-line headline of at least 10 characters.").max(120),
  expertise: list.refine((a) => a.length > 0, "Add at least one area of expertise."),
  email: z.string().trim().email("Invites and Meet links go to this email, so it must be valid."),
  yearsExperience: z.coerce.number().int().min(0).max(60),
  rating: z
    .union([z.literal(""), z.coerce.number().min(1, "Rating is between 1 and 5.").max(5, "Rating is between 1 and 5.")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  published: z.boolean(),
  featured: z.boolean(),
});

export async function saveProvider(input: z.input<typeof providerSchema>): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("providers");
    const v = providerSchema.parse(input);
    const d = db();
    const now = Date.now();
    if (v.id) {
      const cur = d.providers.find((x) => x.id === v.id);
      if (!cur) return { ok: false, error: "That profile no longer exists." };
      const wasPublished = cur.published;
      Object.assign(cur, { ...v, updatedAt: now });
      audit(admin, wasPublished !== v.published ? (v.published ? "provider.publish" : "provider.unpublish") : "provider.update", cur.name);
    } else {
      d.providers.unshift({ ...v, id: newId("prv"), createdAt: now, updatedAt: now });
      audit(admin, "provider.create", v.name);
    }
    revalidatePath("/providers");
    return { ok: true, message: v.id ? "Profile saved." : `${v.name} added.` };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteProvider(id: string): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("providers");
    const d = db();
    const cur = d.providers.find((x) => x.id === id);
    if (!cur) return { ok: false, error: "That profile no longer exists." };
    const upcoming = d.bookings.filter((b) => b.targetId === id && b.start > Date.now() && ["requested", "confirmed"].includes(b.status)).length;
    if (upcoming) return { ok: false, error: `${cur.name} has ${upcoming} upcoming booking${upcoming === 1 ? "" : "s"}. Hide the profile instead, or cancel them first.` };
    d.providers = d.providers.filter((x) => x.id !== id);
    d.availability = d.availability.filter((a) => a.targetId !== id);
    audit(admin, "provider.delete", cur.name, { severity: "notice" });
    revalidatePath("/providers");
    return { ok: true, message: `${cur.name} deleted.` };
  } catch (e) {
    return fail(e);
  }
}
