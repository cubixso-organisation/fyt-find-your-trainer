/**
 * Image storage contract. The console only talks to this interface, so the
 * dev implementation (memory-storage.ts) can be swapped for Firebase Storage
 * (firebase-storage.ts) without touching actions or pages.
 *
 * Callers validate BEFORE calling putImage: permission, magic bytes, size and
 * key shape (see image-validation.ts). Implementations still refuse keys that
 * don't parse, as a second line of defence.
 */
import type { ImageMime } from "./image-validation";

export interface PutImageInput {
  /** Server-built key from buildImageKey(); never client supplied. */
  key: string;
  bytes: Uint8Array;
  contentType: ImageMime;
}

export interface StoredImage {
  bytes: Uint8Array;
  contentType: ImageMime;
}

export interface ImageStorage {
  readonly name: "memory" | "firebase";
  putImage(input: PutImageInput): Promise<{ url: string; key: string }>;
  /** Idempotent: deleting a missing key is not an error. */
  deleteImage(key: string): Promise<void>;
  /**
   * Read back bytes. Only the dev implementation serves bytes itself (via the
   * authenticated /api/media route); Firebase serves through its own URLs.
   */
  getImage?(key: string): Promise<StoredImage | null>;
}
