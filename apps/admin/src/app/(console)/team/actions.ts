"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, ForbiddenError } from "@/lib/auth";
import { audit, db, newId } from "@/lib/data/store";
import { hashPassword } from "@/lib/data/seed";
import { ROLE_LABEL, ROLE_RANK, assignableRoles, canManage, sanitizeGrants, PERMISSIONS, type Role } from "@/lib/rbac";
import type { ActionResult } from "../bookings/actions";

function fail(e: unknown): ActionResult {
  if (e instanceof ForbiddenError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the form." };
  console.error(e);
  return { ok: false, error: "Something went wrong. Nothing was changed." };
}

function target(id: string) {
  const t = db().admins.find((a) => a.id === id);
  if (!t) throw new ForbiddenError("That operator no longer exists.");
  return t;
}

function guardManage(actor: { id: string; role: Role }, t: { id: string; role: Role }) {
  if (actor.id === t.id) throw new ForbiddenError("You can't change your own access. Ask another super admin or the owner.");
  if (t.role === "owner") throw new ForbiddenError("The owner's access can't be changed. Ownership only moves through a transfer.");
  if (!canManage(actor, t)) throw new ForbiddenError(`Only the owner can manage ${ROLE_LABEL[t.role].toLowerCase()}s.`);
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Enter their name.").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid work email."),
  role: z.enum(["superadmin", "admin"]),
  permissions: z.array(z.string()).default([]),
});

export async function inviteOperator(input: z.input<typeof inviteSchema>): Promise<ActionResult & { inviteUrl?: string }> {
  try {
    const { admin } = await assertPermission("team");
    const v = inviteSchema.parse(input);
    if (!assignableRoles(admin.role).includes(v.role))
      return { ok: false, error: `Only the owner can invite a ${ROLE_LABEL[v.role].toLowerCase()}.` };
    const d = db();
    if (d.admins.some((a) => a.email === v.email)) return { ok: false, error: "An operator with that email already exists." };
    const token = randomBytes(18).toString("base64url");
    const perms = v.role === "admin" ? sanitizeGrants(v.permissions) : [];
    d.admins.push({
      id: newId("adm"),
      name: v.name,
      email: v.email,
      role: v.role,
      permissions: perms,
      status: "invited",
      passwordHash: hashPassword(token),
      tokenVersion: 1,
      createdAt: Date.now(),
      invitedBy: admin.id,
    });
    audit(admin, "team.invite", `${v.name} (${ROLE_LABEL[v.role]})`, {
      severity: v.role === "superadmin" ? "critical" : "notice",
      detail: perms.length ? `Granted: ${perms.join(", ")}` : undefined,
    });
    revalidatePath("/team");
    // Email delivery is wired with Firebase (Auth email link) later. Until then the link is shown once.
    return { ok: true, message: `Invite created for ${v.email}.`, inviteUrl: `/accept-invite?token=${token}` };
  } catch (e) {
    return fail(e);
  }
}

export async function updatePermissions(input: { id: string; permissions: string[] }): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("team");
    const t = target(input.id);
    guardManage(admin, t);
    if (t.role !== "admin") return { ok: false, error: "Super admins hold every operational permission; nothing to change." };
    const before = new Set(t.permissions);
    const next = sanitizeGrants(input.permissions);
    const added = next.filter((p) => !before.has(p));
    const removed = [...before].filter((p) => !next.includes(p as never));
    if (!added.length && !removed.length) return { ok: true, message: "No changes." };
    t.permissions = next;
    const label = (k: string) => PERMISSIONS.find((p) => p.key === k)?.label ?? k;
    audit(admin, "team.permissions", t.name, {
      severity: "critical",
      detail: [added.length ? `Granted: ${added.map(label).join(", ")}` : "", removed.length ? `Removed: ${removed.map(label).join(", ")}` : ""].filter(Boolean).join(" · "),
    });
    revalidatePath("/team");
    return { ok: true, message: `Permissions updated for ${t.name}. They apply on their next page load.` };
  } catch (e) {
    return fail(e);
  }
}

export async function changeRole(input: { id: string; role: "superadmin" | "admin" }): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("team");
    const t = target(input.id);
    guardManage(admin, t);
    if (!assignableRoles(admin.role).includes(input.role)) return { ok: false, error: "Only the owner can promote or demote super admins." };
    if (t.role === input.role) return { ok: true, message: "No changes." };
    const promoting = ROLE_RANK[input.role] > ROLE_RANK[t.role];
    const from = t.role;
    t.role = input.role;
    t.permissions = input.role === "admin" ? sanitizeGrants([]) : [];
    t.tokenVersion += 1; // role changes end their current session
    audit(admin, "team.role", t.name, { severity: "critical", detail: `${ROLE_LABEL[from]} → ${ROLE_LABEL[input.role]}` });
    revalidatePath("/team");
    return {
      ok: true,
      message: `${t.name} is now ${ROLE_LABEL[input.role].toLowerCase()}. ${promoting ? "" : "Their permissions were reset to Overview only. "}They were signed out.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function setOperatorStatus(input: { id: string; status: "active" | "disabled" }): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("team");
    const t = target(input.id);
    guardManage(admin, t);
    if (t.status === "invited" && input.status === "active") return { ok: false, error: "They need to accept the invite first." };
    t.status = input.status;
    if (input.status === "disabled") t.tokenVersion += 1;
    audit(admin, input.status === "disabled" ? "team.disable" : "team.enable", t.name, { severity: "critical" });
    revalidatePath("/team");
    return { ok: true, message: input.status === "disabled" ? `${t.name} lost access and was signed out.` : `${t.name} can sign in again.` };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeSessions(id: string): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("team");
    const t = target(id);
    guardManage(admin, t);
    t.tokenVersion += 1;
    audit(admin, "team.revoke_sessions", t.name, { severity: "notice" });
    revalidatePath("/team");
    return { ok: true, message: `${t.name} was signed out on every device.` };
  } catch (e) {
    return fail(e);
  }
}

export async function removeInvite(id: string): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("team");
    const t = target(id);
    guardManage(admin, t);
    if (t.status !== "invited") return { ok: false, error: "Only pending invites can be withdrawn. Disable active operators instead." };
    db().admins = db().admins.filter((a) => a.id !== id);
    audit(admin, "team.disable", `${t.name} (invite withdrawn)`, { severity: "notice" });
    revalidatePath("/team");
    return { ok: true, message: `Invite for ${t.email} withdrawn.` };
  } catch (e) {
    return fail(e);
  }
}
