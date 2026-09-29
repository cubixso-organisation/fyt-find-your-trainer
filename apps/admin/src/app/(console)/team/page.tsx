import { requirePermission } from "@/lib/auth";
import { requestTime } from "@/lib/clock";
import { db } from "@/lib/data/store";
import { assignableRoles, PERMISSIONS } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/primitives";
import { TeamClient } from "./team-client";

export const metadata = { title: "Team & roles" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { admin } = await requirePermission("team");
  const sp = await searchParams;
  const d = db();
  const order = { owner: 0, superadmin: 1, admin: 2 } as const;
  const operators = [...d.admins]
    .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name))
    .map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      role: a.role,
      permissions: a.permissions,
      status: a.status,
      createdAt: a.createdAt,
      lastLoginAt: a.lastLoginAt,
      invitedBy: a.invitedBy,
      invitedByName: d.admins.find((x) => x.id === a.invitedBy)?.name,
    }));
  return (
    <>
      <PageHeader
        title="Team & roles"
        description="Who can operate the console and what each person can touch. Every change here is written to the audit log."
      />
      <TeamClient
        operators={operators}
        viewer={{ id: admin.id, role: admin.role }}
        assignable={assignableRoles(admin.role)}
        permissionDefs={PERMISSIONS.map((p) => ({ key: p.key, label: p.label, description: p.description, minRole: p.minRole, sensitive: !!p.sensitive }))}
        openInvite={sp.invite === "1"}
        now={requestTime()}
      />
    </>
  );
}
