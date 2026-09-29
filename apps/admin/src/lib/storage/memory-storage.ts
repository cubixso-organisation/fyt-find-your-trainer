import "server-only";
import { parseImageKey } from "./image-validation";
import type { ImageStorage, StoredImage } from "./types";

/**
 * DEV ONLY. Keeps image bytes in process memory next to the demo dataset, so
 * uploads live exactly as long as the demo data they belong to (both reset on
 * a server restart) and nothing lands on disk or in git.
 *
 * Bytes are served by the authenticated route handler at /api/media/[...key],
 * which re-checks the session and the matching permission itself (the proxy
 * does not run on /api/*).
 */
const g = globalThis as unknown as { __tpImages?: Map<string, StoredImage & { at: number }> };
const images = () => (g.__tpImages ??= new Map());

/** Cap total memory so a runaway demo can't exhaust the dev server. */
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

export const memoryStorage: ImageStorage = {
  name: "memory",

  async putImage({ key, bytes, contentType }) {
    if (!parseImageKey(key)) throw new Error("Refusing to store an invalid key");
    const store = images();
    let total = bytes.byteLength;
    for (const v of store.values()) total += v.bytes.byteLength;
    if (total > MAX_TOTAL_BYTES) throw new Error("Dev image store is full; restart the dev server");
    // Copy so the caller's buffer can't mutate what we serve later.
    store.set(key, { bytes: new Uint8Array(bytes), contentType, at: Date.now() });
    return { key, url: `/api/media/${key}` };
  },

  async deleteImage(key) {
    if (!parseImageKey(key)) return;
    images().delete(key);
  },

  async getImage(key) {
    if (!parseImageKey(key)) return null;
    const hit = images().get(key);
    return hit ? { bytes: hit.bytes, contentType: hit.contentType } : null;
  },
};
