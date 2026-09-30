import "server-only";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { buildSeed, type Dataset } from "./seed";
import type { AuditEntry } from "./types";
import type { Role } from "../rbac";

/**
 * In-memory demo store (survives dev hot reloads via globalThis).
 * Swap for a Firestore adapter once the client's Firebase project exists;
 * pages only use the functions exported from ./queries and server actions.
 */
const g = globalThis as unknown as { __tpStore?: Dataset };

export function db(): Dataset {
  g.__tpStore ??= buildSeed();
  return upgrade(g.__tpStore);
}

/**
 * A dev server keeps the dataset across hot reloads, so a store built by an
 * older seed can lack fields added since. Backfill them in place.
 */
function upgrade(d: Dataset): Dataset {
  if (!d.availabilityExceptions) d.availabilityExceptions = buildSeed().availabilityExceptions;
  // Demo phone numbers for phone sign-in (added after the first seed).
  const phones: Record<string, string> = { adm_owner: "+91 94405 62918", adm_content: "+91 70323 18865" };
  for (const a of d.admins) if (!a.phone && phones[a.id]) a.phone = phones[a.id];
  for (const i of d.institutes) {
    if (!Array.isArray(i.gallery)) {
      i.gallery = [];
      delete (i as { galleryCount?: number }).galleryCount;
    }
  }
  return d;
}

export const DATA_SOURCE: "demo" | "firestore" = "demo";

export function verifyPassword(pw: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const got = scryptSync(pw, salt, 32);
  const want = Buffer.from(hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

let seq = 0;
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

export function audit(
  actor: { id: string; name: string; role: Role },
  action: string,
  target?: string,
  opts: { detail?: string; severity?: AuditEntry["severity"] } = {},
) {
  db().audit.unshift({
    id: newId("aud"),
    at: Date.now(),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    target,
    detail: opts.detail,
    severity: opts.severity ?? "info",
  });
}
