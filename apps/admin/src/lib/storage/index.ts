import "server-only";
import { memoryStorage } from "./memory-storage";
import type { ImageStorage } from "./types";

/**
 * The active image store. Demo data -> in-memory bytes served by /api/media.
 * When the Firestore adapter lands, return `firebaseStorage` from
 * ./firebase-storage here (it is deliberately not imported until then).
 */
export function imageStorage(): ImageStorage {
  return memoryStorage;
}

export type { ImageStorage, PutImageInput, StoredImage } from "./types";
