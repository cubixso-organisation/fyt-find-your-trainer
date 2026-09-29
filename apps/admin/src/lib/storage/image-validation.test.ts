import { describe, it } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./image-validation");
const { checkImage, buildImageKey, parseImageKey, MAX_IMAGE_BYTES }: Mod = await import(new URL("./image-validation.ts", import.meta.url).href);

const png = (w: number, h: number) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
};
// SOI, APP0 (len 16), SOF0 (len 17): precision, height, width
const jpeg = (w: number, h: number) =>
  new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...new Array(14).fill(0), 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, ...new Array(9).fill(0)]);
const webpX = (w: number, h: number) => {
  const b = new Uint8Array(30);
  b.set([...Buffer.from("RIFF"), 22, 0, 0, 0, ...Buffer.from("WEBPVP8X"), 10, 0, 0, 0, 0, 0, 0, 0]);
  b.set([(w - 1) & 255, ((w - 1) >> 8) & 255, 0, (h - 1) & 255, ((h - 1) >> 8) & 255, 0], 24);
  return b;
};

describe("checkImage", () => {
  it("accepts PNG, JPEG and WebP by magic bytes and reads dimensions", () => {
    assert.deepEqual(checkImage(png(800, 600)), { ok: true, mime: "image/png", ext: "png", width: 800, height: 600 });
    assert.deepEqual(checkImage(jpeg(1200, 900)), { ok: true, mime: "image/jpeg", ext: "jpg", width: 1200, height: 900 });
    assert.deepEqual(checkImage(webpX(640, 480)), { ok: true, mime: "image/webp", ext: "webp", width: 640, height: 480 });
  });
  it("rejects SVG, HTML, GIF and truncated files whatever they are called", () => {
    for (const s of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "<!doctype html><p>hi", "GIF89a......"])
      assert.equal(checkImage(new TextEncoder().encode(s)).ok, false);
    assert.equal(checkImage(png(10, 10).subarray(0, 12)).ok, false);
    assert.equal(checkImage(new Uint8Array(0)).ok, false);
  });
  it("rejects oversize files and absurd dimensions", () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(png(10, 10));
    assert.equal(checkImage(big).ok, false);
    assert.equal(checkImage(png(20_000, 10)).ok, false);
  });
});

describe("image keys", () => {
  it("builds keys only from validated parts", () => {
    const hex = "0123456789abcdef0123456789abcdef";
    assert.equal(buildImageKey("providers", "prv_001", hex, "png"), `catalog/providers/prv_001/${hex}.png`);
    assert.throws(() => buildImageKey("providers", "../../etc", hex, "png"));
    assert.throws(() => buildImageKey("providers", "prv_001", "../x", "png"));
    assert.throws(() => buildImageKey("providers", "prv_001", hex, "svg"));
  });
  it("refuses traversal and foreign keys when parsing", () => {
    assert.equal(parseImageKey("catalog/providers/prv_001/../../secret.png"), null);
    assert.equal(parseImageKey("catalog/admins/adm_owner/0123456789abcdef0123456789abcdef.png"), null);
    assert.equal(parseImageKey("/etc/passwd"), null);
    assert.deepEqual(parseImageKey("catalog/institutes/ins_00c/0123456789abcdef0123456789abcdef.webp"), { collection: "institutes", ownerId: "ins_00c", ext: "webp" });
  });
});
