/**
 * Role-based access for the operator console.
 *
 * Three tiers, strictly ordered:
 *   owner       The client. Holds every permission. Exactly one exists.
 *               Cannot be disabled, demoted or deleted by anyone; the role
 *               only moves through an explicit ownership transfer.
 *   superadmin  Runs the operation: team, settings, broadcasts, audit.
 *               Manages admins, never other super admins or the owner.
 *   admin       Staff. Sees only the modules granted to them.
 *
 * Nobody edits their own role or permissions. Every rule here is enforced
 * server-side (proxy + server actions); the UI only mirrors it.
 */

export type Role = "owner" | "superadmin" | "admin";

export const ROLE_RANK: Record<Role, number> = { owner: 3, superadmin: 2, admin: 1 };

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  superadmin: "Super admin",
  admin: "Admin",
};

export const PERMISSION_KEYS = [
  "overview",
  "bookings",
  "availability",
  "institutes",
  "courses",
  "providers",
  "learners",
  "content",
  "notifications",
  "analytics",
  "audit",
  "team",
  "settings",
  "owner",
] as const;

export type Permission = (typeof PERMISSION_KEYS)[number];

export interface PermissionDef {
  key: Permission;
  label: string;
  description: string;
  /** Minimum tier that may hold it at all. Admin-tier keys are grantable. */
  minRole: Role;
  /** Grantable keys that start OFF for a new admin. */
  sensitive?: boolean;
}

export const PERMISSIONS: readonly PermissionDef[] = [
  { key: "overview", label: "Overview", description: "Today's queue, timeline and recent activity. Always on.", minRole: "admin" },
  { key: "bookings", label: "Bookings", description: "Confirm, reschedule and cancel demo, mentorship and consultation bookings.", minRole: "admin" },
  { key: "availability", label: "Availability", description: "Weekly slot rules for trainers, mentors, consultants and courses.", minRole: "admin" },
  { key: "institutes", label: "Institutes", description: "Institute directory: profiles, locations, galleries.", minRole: "admin" },
  { key: "courses", label: "Courses & projects", description: "Course and project listings, filters and featuring.", minRole: "admin" },
  { key: "providers", label: "Trainers, mentors, consultants", description: "Provider profiles and their published state.", minRole: "admin" },
  { key: "learners", label: "Learners", description: "Student and corporate accounts. Contains personal data.", minRole: "admin", sensitive: true },
  { key: "content", label: "Home & taxonomy", description: "Home feed, categories and tech stacks shown in the app.", minRole: "admin", sensitive: true },
  { key: "notifications", label: "Broadcasts", description: "Push broadcasts to app users.", minRole: "admin", sensitive: true },
  { key: "analytics", label: "Analytics", description: "Registrations, booking funnel and demand by listing.", minRole: "admin", sensitive: true },
  { key: "audit", label: "Audit log", description: "Every operator action with actor and time.", minRole: "superadmin" },
  { key: "team", label: "Team & roles", description: "Invite admins, set permissions, disable access.", minRole: "superadmin" },
  { key: "settings", label: "Platform settings", description: "Booking rules, Meet link provider, maintenance window.", minRole: "superadmin" },
  { key: "owner", label: "Ownership", description: "Transfer ownership, force sign-out, danger zone.", minRole: "owner" },
];

export const ALWAYS_GRANTED: Permission = "overview";

export const GRANTABLE: readonly Permission[] = PERMISSIONS.filter((p) => p.minRole === "admin").map((p) => p.key);

export const DEFAULT_ADMIN_PERMISSIONS: readonly Permission[] = PERMISSIONS.filter(
  (p) => p.minRole === "admin" && !p.sensitive,
).map((p) => p.key);

export function isPermission(v: unknown): v is Permission {
  return typeof v === "string" && (PERMISSION_KEYS as readonly string[]).includes(v);
}

/** Effective permission set. Stored grants only matter for plain admins. */
export function resolvePermissions(role: Role, stored: readonly string[] = []): Set<Permission> {
  const out = new Set<Permission>();
  for (const def of PERMISSIONS) {
    if (ROLE_RANK[role] < ROLE_RANK[def.minRole]) continue;
    if (role !== "admin" || def.key === ALWAYS_GRANTED || stored.includes(def.key)) out.add(def.key);
  }
  return out;
}

export function can(role: Role, stored: readonly string[], key: Permission): boolean {
  return resolvePermissions(role, stored).has(key);
}

/** Only grantable keys survive; overview is always included. */
export function sanitizeGrants(input: unknown): Permission[] {
  const list = Array.isArray(input) ? input : [];
  const set = new Set<Permission>([ALWAYS_GRANTED]);
  for (const v of list) if (isPermission(v) && GRANTABLE.includes(v)) set.add(v);
  return [...set];
}

export interface ActorRef {
  id: string;
  role: Role;
}

/**
 * Can `actor` change `target` (profile, status, permissions)?
 * - never yourself (use the profile page for your own name/phone)
 * - never the owner
 * - owner manages super admins and admins
 * - super admin manages admins only
 */
export function canManage(actor: ActorRef, target: ActorRef): boolean {
  if (actor.id === target.id) return false;
  if (target.role === "owner") return false;
  if (actor.role === "owner") return true;
  if (actor.role === "superadmin") return target.role === "admin";
  return false;
}

/** Which roles may `actor` assign when inviting or changing someone. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === "owner") return ["superadmin", "admin"];
  if (actor === "superadmin") return ["admin"];
  return [];
}

/** Route prefix -> permission. Longest prefix wins. */
export const ROUTE_PERMISSIONS: ReadonlyArray<[string, Permission]> = [
  ["/bookings", "bookings"],
  ["/availability", "availability"],
  ["/institutes", "institutes"],
  ["/courses", "courses"],
  ["/providers", "providers"],
  ["/learners", "learners"],
  ["/content", "content"],
  ["/broadcasts", "notifications"],
  ["/analytics", "analytics"],
  ["/audit", "audit"],
  ["/team", "team"],
  ["/settings", "settings"],
  ["/ownership", "owner"],
];

export function permissionForPath(path: string): Permission | null {
  let best: [string, Permission] | null = null;
  for (const entry of ROUTE_PERMISSIONS) {
    if ((path === entry[0] || path.startsWith(entry[0] + "/")) && (!best || entry[0].length > best[0].length)) best = entry;
  }
  return best ? best[1] : null;
}
