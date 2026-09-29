"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, ForbiddenError } from "@/lib/auth";
import { audit, db, verifyPassword } from "@/lib/data/store";
import { SESSION_COOKIE } from "@/lib/session";
import type { ActionResult } from "../bookings/actions";

function fail(e: unknown): ActionResult {
  if (e instanceof ForbiddenError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the form." };
  console.error(e);
  return { ok: false, error: "Something went wrong. Nothing was changed." };
}

/**
 * Ownership transfer. Owner only, re-authenticated with their password.
 * The new owner must be an active super admin; the old owner becomes a
 * super admin. Both are signed out so the new roles take effect at once.
 */
export async function transferOwnership(input: { toId: string; password: string; confirmText: string }): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("owner");
    const to = db().admins.find((a) => a.id === input.toId);
    if (!to) return { ok: false, error: "Choose who receives ownership." };
    if (to.role !== "superadmin" || to.status !== "active") return { ok: false, error: "Ownership can only go to an active super admin." };
    if (input.confirmText.trim() !== "TRANSFER") return { ok: false, error: "Type TRANSFER to confirm." };
    if (!verifyPassword(input.password, admin.passwordHash)) return { ok: false, error: "Your password is incorrect." };
    to.role = "owner";
    to.permissions = [];
    to.tokenVersion += 1;
    admin.role = "superadmin";
    admin.tokenVersion += 1;
    audit({ ...admin, role: "owner" }, "owner.transfer", to.name, { severity: "critical" });
    (await cookies()).delete(SESSION_COOKIE);
    revalidatePath("/", "layout");
    return { ok: true, message: `${to.name} is now the owner. You are a super admin and were signed out.` };
  } catch (e) {
    return fail(e);
  }
}

/** Ends every operator session except the owner's own. */
export async function signOutEveryone(): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("owner");
    let n = 0;
    for (const a of db().admins) {
      if (a.id === admin.id || a.status !== "active") continue;
      a.tokenVersion += 1;
      n++;
    }
    audit(admin, "owner.revoke_all", `${n} operators`, { severity: "critical" });
    revalidatePath("/", "layout");
    return { ok: true, message: `${n} operator${n === 1 ? " was" : "s were"} signed out. You stay signed in.` };
  } catch (e) {
    return fail(e);
  }
}

export async function setMaintenance(on: boolean): Promise<ActionResult> {
  try {
    const { admin } = await assertPermission("owner");
    db().settings.maintenanceMode = on;
    audit(admin, "owner.maintenance", on ? "On" : "Off", { severity: "critical" });
    revalidatePath("/", "layout");
    return { ok: true, message: on ? "Maintenance mode is on. The app shows a notice and blocks new bookings." : "Maintenance mode is off. Bookings are open again." };
  } catch (e) {
    return fail(e);
  }
}
