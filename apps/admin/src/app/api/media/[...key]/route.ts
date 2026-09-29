import { getViewer } from "@/lib/auth";
import { imageStorage } from "@/lib/storage";
import { parseImageKey, type ImageCollection } from "@/lib/storage/image-validation";
import type { Permission } from "@/lib/rbac";

/**
 * Serves dev-store image bytes to signed-in operators.
 *
 * SECURITY: src/proxy.ts does not run on /api/* (nor on *.png/*.jpg/*.webp
 * paths), so this handler authenticates on its own: a valid signed session
 * resolved against the live admin record, plus the permission that owns the
 * image's collection. Keys are re-validated against a strict pattern before
 * any lookup, and responses can't be sniffed or executed as anything else.
 */
const PERMISSION_FOR: Record<ImageCollection, Permission> = {
  providers: "providers",
  courses: "courses",
  institutes: "institutes",
};

const deny = (status: number, body: string) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const viewer = await getViewer();
  if (!viewer) return deny(401, "Sign in to view this image.");

  const { key: parts } = await ctx.params;
  const key = (parts ?? []).join("/");
  const parsed = parseImageKey(key);
  if (!parsed) return deny(404, "Not found");
  if (!viewer.permissions.has(PERMISSION_FOR[parsed.collection])) return deny(403, "You don't have access to this image.");

  const store = imageStorage();
  const img = store.getImage ? await store.getImage(key) : null;
  if (!img) return deny(404, "Not found");

  return new Response(img.bytes as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": img.contentType,
      "Content-Length": String(img.bytes.byteLength),
      // Keys are random and never reused, but access depends on the session.
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
