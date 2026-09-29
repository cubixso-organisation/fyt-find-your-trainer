"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, ForbiddenError } from "@/lib/auth";
import { audit, db } from "@/lib/data/store";
import type { Course, ImageRef, Institute, Provider } from "@/lib/data/types";
import type { Permission } from "@/lib/rbac";
import { imageStorage } from "@/lib/storage";
import { MAX_IMAGE_BYTES, buildImageKey, checkImage, isValidOwnerId, type ImageCollection } from "@/lib/storage/image-validation";

/**
 * Image uploads. The ONLY write path into image storage.
 * Every call: session + live permission for the owning module, strict input
 * shapes, magic-byte type check, 5 MB cap, server-built keys, and an audit
 * entry for every upload, removal and reorder.
 */

export type MediaResult = { ok: true; message?: string; image?: ImageRef } | { ok: false; error: string };

const MAX_GALLERY_IMAGES = 12;

const SLOTS = {
  "provider-photo": { collection: "providers", permission: "providers", label: "photo" },
  "course-cover": { collection: "courses", permission: "courses", label: "cover image" },
  "institute-gallery": { collection: "institutes", permission: "institutes", label: "gallery photo" },
} as const satisfies Record<string, { collection: ImageCollection; permission: Permission; label: string }>;
type Slot = keyof typeof SLOTS;
const slotSchema = z.enum(Object.keys(SLOTS) as [Slot, ...Slot[]]);
const ownerSchema = z.string().max(40).refine(isValidOwnerId, "Unknown record.");

function fail(e: unknown): MediaResult {
  if (e instanceof ForbiddenError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the request." };
  console.error(e);
  return { ok: false, error: "The upload failed. Nothing was changed." };
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

type Owner =
  | { kind: "provider"; name: string; path: string; rec: Provider }
  | { kind: "course"; name: string; path: string; rec: Course }
  | { kind: "institute"; name: string; path: string; rec: Institute };

function findOwner(slot: Slot, ownerId: string): Owner | null {
  const d = db();
  if (slot === "provider-photo") {
    const rec = d.providers.find((x) => x.id === ownerId);
    return rec ? { kind: "provider", name: rec.name, path: "/providers", rec } : null;
  }
  if (slot === "course-cover") {
    const rec = d.courses.find((x) => x.id === ownerId);
    return rec ? { kind: "course", name: rec.title, path: "/courses", rec } : null;
  }
  const rec = d.institutes.find((x) => x.id === ownerId);
  return rec ? { kind: "institute", name: rec.name, path: "/institutes", rec } : null;
}

/** Upload one image. FormData fields: slot, ownerId, file. */
export async function uploadImage(form: FormData): Promise<MediaResult> {
  try {
    const slot = slotSchema.parse(form.get("slot"));
    const cfg = SLOTS[slot];
    const { admin } = await assertPermission(cfg.permission);
    const ownerId = ownerSchema.parse(form.get("ownerId"));
    const file = form.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Choose an image to upload." };
    // Cheap check on the declared size first, then the real one after reading.
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: `That file is ${kb(file.size)}. Images can be up to 5 MB.` };

    const owner = findOwner(slot, ownerId);
    if (!owner) return { ok: false, error: "That record no longer exists. Refresh the page." };
    if (owner.kind === "institute" && owner.rec.gallery.length >= MAX_GALLERY_IMAGES)
      return { ok: false, error: `A gallery holds up to ${MAX_GALLERY_IMAGES} photos. Remove one first.` };

    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkImage(bytes);
    if (!check.ok) {
      audit(admin, `${owner.kind}.image.rejected`, owner.name, { detail: check.error, severity: "notice" });
      return { ok: false, error: check.error };
    }

    const key = buildImageKey(cfg.collection, ownerId, randomBytes(16).toString("hex"), check.ext);
    const store = imageStorage();
    const { url } = await store.putImage({ key, bytes, contentType: check.mime });
    const now = Date.now();
    const image: ImageRef = { key, url, contentType: check.mime, bytes: bytes.byteLength, width: check.width, height: check.height, uploadedAt: now, uploadedBy: admin.id };

    // Re-read the record: it may have changed or gone while the bytes uploaded.
    const fresh = findOwner(slot, ownerId);
    if (!fresh) {
      await store.deleteImage(key);
      return { ok: false, error: "That record was deleted while uploading." };
    }
    let replaced: ImageRef | undefined;
    if (fresh.kind === "provider") {
      replaced = fresh.rec.photo;
      fresh.rec.photo = image;
    } else if (fresh.kind === "course") {
      replaced = fresh.rec.cover;
      fresh.rec.cover = image;
    } else {
      if (fresh.rec.gallery.length >= MAX_GALLERY_IMAGES) {
        await store.deleteImage(key);
        return { ok: false, error: `A gallery holds up to ${MAX_GALLERY_IMAGES} photos. Remove one first.` };
      }
      fresh.rec.gallery.push(image);
    }
    fresh.rec.updatedAt = now;
    if (replaced) await store.deleteImage(replaced.key);

    audit(admin, `${fresh.kind}.image.upload`, fresh.name, {
      detail: `${cfg.label}${replaced ? " replaced" : ""}: ${check.mime.replace("image/", "").toUpperCase()}, ${check.width}×${check.height}, ${kb(bytes.byteLength)}`,
    });
    revalidatePath(fresh.path);
    return { ok: true, message: replaced ? `${cap(cfg.label)} replaced.` : `${cap(cfg.label)} uploaded.`, image };
  } catch (e) {
    return fail(e);
  }
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const removeSchema = z.object({ slot: slotSchema, ownerId: ownerSchema, key: z.string().max(160) });

/** Remove one image. The key must belong to the record, so arbitrary keys can't be deleted. */
export async function removeImage(input: z.input<typeof removeSchema>): Promise<MediaResult> {
  try {
    const slot = slotSchema.parse(input?.slot);
    const cfg = SLOTS[slot];
    const { admin } = await assertPermission(cfg.permission);
    const v = removeSchema.parse(input);
    const owner = findOwner(slot, v.ownerId);
    if (!owner) return { ok: false, error: "That record no longer exists." };
    let found: ImageRef | undefined;
    if (owner.kind === "provider" && owner.rec.photo?.key === v.key) {
      found = owner.rec.photo;
      owner.rec.photo = undefined;
    } else if (owner.kind === "course" && owner.rec.cover?.key === v.key) {
      found = owner.rec.cover;
      owner.rec.cover = undefined;
    } else if (owner.kind === "institute") {
      found = owner.rec.gallery.find((g) => g.key === v.key);
      if (found) owner.rec.gallery = owner.rec.gallery.filter((g) => g.key !== v.key);
    }
    if (!found) return { ok: false, error: "That image was already removed." };
    owner.rec.updatedAt = Date.now();
    await imageStorage().deleteImage(found.key);
    audit(admin, `${owner.kind}.image.delete`, owner.name, { detail: `${cfg.label} removed`, severity: "notice" });
    revalidatePath(owner.path);
    return { ok: true, message: `${cap(cfg.label)} removed.` };
  } catch (e) {
    return fail(e);
  }
}

const reorderSchema = z.object({ instituteId: ownerSchema, keys: z.array(z.string().max(160)).max(MAX_GALLERY_IMAGES) });

/** Reorder an institute gallery. `keys` must be exactly the current keys, in the new order. */
export async function reorderGallery(input: z.input<typeof reorderSchema>): Promise<MediaResult> {
  try {
    const { admin } = await assertPermission("institutes");
    const v = reorderSchema.parse(input);
    const inst = db().institutes.find((x) => x.id === v.instituteId);
    if (!inst) return { ok: false, error: "That institute no longer exists." };
    const current = inst.gallery.map((g) => g.key);
    const same = v.keys.length === current.length && new Set(v.keys).size === v.keys.length && v.keys.every((k) => current.includes(k));
    if (!same) return { ok: false, error: "The gallery changed in another tab. Refresh and try again." };
    inst.gallery = v.keys.map((k) => inst.gallery.find((g) => g.key === k)!);
    inst.updatedAt = Date.now();
    audit(admin, "institute.image.reorder", inst.name, { detail: `Gallery reordered (${v.keys.length} photos)` });
    revalidatePath("/institutes");
    return { ok: true, message: "Gallery order saved." };
  } catch (e) {
    return fail(e);
  }
}
