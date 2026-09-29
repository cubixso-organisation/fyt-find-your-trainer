import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "./session";
import { db } from "./data/store";
import { can, resolvePermissions, type Permission } from "./rbac";
import type { Admin } from "./data/types";

export interface Viewer {
  admin: Admin;
  permissions: Set<Permission>;
}

/**
 * Resolve the signed-in admin from the cookie AND the live record.
 * The token alone is not trusted: a disabled admin, a role change, or a
 * bumped tokenVersion ("sign out everywhere") ends the session immediately.
 */
export async function getViewer(): Promise<Viewer | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);
  if (!claims) return null;
  const admin = db().admins.find((a) => a.id === claims.sub);
  if (!admin || admin.status !== "active" || admin.tokenVersion !== claims.ver || admin.role !== claims.role) return null;
  return { admin, permissions: resolvePermissions(admin.role, admin.permissions) };
}

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  return v;
}

/** For pages: redirect to Overview with a reason if the permission is missing. */
export async function requirePermission(key: Permission): Promise<Viewer> {
  const v = await requireViewer();
  if (!v.permissions.has(key)) redirect(`/?denied=${key}`);
  return v;
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
  }
}

/** For server actions: throw instead of redirecting. */
export async function assertPermission(key: Permission): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw new ForbiddenError("Your session ended. Sign in again.");
  if (!can(v.admin.role, v.admin.permissions, key)) throw new ForbiddenError();
  return v;
}
