/**
 * Pure image checks used before anything is stored. No I/O, no Node APIs, so
 * the same code can run in a Cloud Function (e.g. a Storage finalize trigger
 * that re-validates what the client uploaded).
 *
 * The file's declared MIME type and name are NEVER trusted: the type comes
 * from the magic bytes, and the dimensions are parsed from the header, which
 * also rejects truncated or disguised files. SVG (scriptable) and every other
 * format are refused.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Guards later thumbnailing against decompression bombs. */
export const MAX_IMAGE_SIDE = 10_000;
export const MAX_IMAGE_PIXELS = 40_000_000;

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";
export const IMAGE_EXT: Record<ImageMime, "jpg" | "png" | "webp"> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const ACCEPT_ATTR = "image/jpeg,image/png,image/webp";

export type ImageCheck =
  | { ok: true; mime: ImageMime; ext: "jpg" | "png" | "webp"; width: number; height: number }
  | { ok: false; error: string };

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

/** Content type from magic bytes only. */
export function sniffImageType(b: Uint8Array): ImageMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  return null;
}

function pngSize(b: Uint8Array): [number, number] | null {
  // signature (8) + IHDR length (4) + "IHDR" (4) + width (4) + height (4)
  if (b.length < 24 || ascii(b, 12, 4) !== "IHDR") return null;
  return [u32be(b, 16), u32be(b, 20)];
}

function jpegSize(b: Uint8Array): [number, number] | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2; // markers without a length
      continue;
    }
    const len = u16be(b, i + 2);
    if (len < 2) return null;
    // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return [u16be(b, i + 7), u16be(b, i + 5)];
    }
    if (marker === 0xda || marker === 0xd9) return null; // scan started before any frame header
    i += 2 + len;
  }
  return null;
}

function webpSize(b: Uint8Array): [number, number] | null {
  if (b.length < 30) return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 ") {
    // frame tag (3) + start code 9d 01 2a
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return [u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff];
  }
  if (chunk === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  }
  if (chunk === "VP8X") return [u24le(b, 24) + 1, u24le(b, 27) + 1];
  return null;
}

/** Validate an uploaded image by its bytes. */
export function checkImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length === 0) return { ok: false, error: "That file is empty." };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: `Images can be up to ${MAX_IMAGE_BYTES / 1024 / 1024} MB.` };
  const mime = sniffImageType(bytes);
  if (!mime) return { ok: false, error: "Only JPEG, PNG or WebP photos can be uploaded. SVG and other formats are not accepted." };
  const size = mime === "image/png" ? pngSize(bytes) : mime === "image/jpeg" ? jpegSize(bytes) : webpSize(bytes);
  if (!size || size[0] < 1 || size[1] < 1) return { ok: false, error: "That image looks damaged or incomplete. Export it again and retry." };
  const [width, height] = size;
  if (width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE || width * height > MAX_IMAGE_PIXELS)
    return { ok: false, error: `That image is ${width}×${height} px. Keep each side under ${MAX_IMAGE_SIDE.toLocaleString("en-IN")} px.` };
  return { ok: true, mime, ext: IMAGE_EXT[mime], width, height };
}

/* ---------------- storage keys ---------------- */

export const IMAGE_COLLECTIONS = ["providers", "courses", "institutes"] as const;
export type ImageCollection = (typeof IMAGE_COLLECTIONS)[number];

const OWNER_RE = /^[a-z]{2,5}_[a-z0-9]{1,32}$/;
const KEY_RE = /^catalog\/(providers|courses|institutes)\/([a-z]{2,5}_[a-z0-9]{1,32})\/([a-f0-9]{32})\.(jpg|png|webp)$/;

/**
 * Build a storage key. Every part is server-chosen or strictly validated, and
 * the client's file name is never used, so a key cannot traverse paths.
 * Layout matches the planned Firebase Storage rules: catalog/{collection}/{docId}/{random}.{ext}
 */
export function buildImageKey(collection: ImageCollection, ownerId: string, randomHex: string, ext: string): string {
  if (!IMAGE_COLLECTIONS.includes(collection)) throw new Error("bad collection");
  if (!OWNER_RE.test(ownerId)) throw new Error("bad owner id");
  const key = `catalog/${collection}/${ownerId}/${randomHex}.${ext}`;
  if (!KEY_RE.test(key)) throw new Error("bad key");
  return key;
}

/** Parse and validate a key (from a URL or the client). Returns null for anything malformed. */
export function parseImageKey(key: string): { collection: ImageCollection; ownerId: string; ext: string } | null {
  if (typeof key !== "string" || key.length > 160) return null;
  const m = KEY_RE.exec(key);
  if (!m) return null;
  return { collection: m[1] as ImageCollection, ownerId: m[2], ext: m[4] };
}

export function isValidOwnerId(id: string): boolean {
  return OWNER_RE.test(id);
}
