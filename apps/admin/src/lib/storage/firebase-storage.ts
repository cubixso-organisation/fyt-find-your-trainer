import "server-only";
import { parseImageKey } from "./image-validation";
import type { ImageStorage } from "./types";

/**
 * ============================================================================
 *  STUB — NOT WIRED UP. Firebase Storage implementation of ImageStorage.
 *  The client's Firebase project doesn't exist yet. storage/index.ts keeps
 *  returning memoryStorage until this is finished and switched on.
 * ============================================================================
 *
 * TODO(firebase) when the project exists:
 *  1. `npm i firebase-admin`; initialise once with a service account from
 *     Secret Manager / env (never commit it). Bucket from FIREBASE_STORAGE_BUCKET.
 *  2. putImage: bucket.file(key).save(Buffer.from(bytes), {
 *       resumable: false,
 *       contentType,                       // the SNIFFED type, not the browser's
 *       metadata: { cacheControl: "public, max-age=31536000, immutable",
 *                   contentDisposition: "inline" },
 *       preconditionOpts: { ifGenerationMatch: 0 },   // never overwrite
 *     })
 *     Return { key, url } where url is either a long-lived download token URL
 *     (firebaseStorageDownloadTokens metadata) for the app, or a short signed
 *     URL generated at read time. Keys are random, so URLs are unguessable.
 *  3. deleteImage: bucket.file(key).delete({ ignoreNotFound: true }).
 *  4. getImage is not needed: the app and console load from `url` directly,
 *     and /api/media can be removed.
 *  5. storage.rules (docs/DESIGN-v2.md §security): only admins write
 *     `catalog/**`; signed-in users read; enforce
 *       request.resource.size < 5 * 1024 * 1024 &&
 *       request.resource.contentType.matches('image/(jpeg|png|webp)')
 *     Uploads still go through the server action (which checks magic bytes and
 *     audits), so client writes can stay denied entirely.
 *  6. Optional: a Storage finalize Cloud Function re-running checkImage() and
 *     producing thumbnails.
 *  7. Flip storage/index.ts to return firebaseStorage when DATA_SOURCE is
 *     "firestore", and migrate ImageRef.url values if the URL scheme changes.
 */
export const firebaseStorage: ImageStorage = {
  name: "firebase",

  async putImage({ key }) {
    if (!parseImageKey(key)) throw new Error("Refusing to store an invalid key");
    throw new Error("firebaseStorage.putImage is not implemented yet (see TODOs in firebase-storage.ts)");
  },

  async deleteImage(key) {
    if (!parseImageKey(key)) return;
    throw new Error("firebaseStorage.deleteImage is not implemented yet (see TODOs in firebase-storage.ts)");
  },
};
