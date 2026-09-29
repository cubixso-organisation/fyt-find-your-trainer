import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/primitives";
import { OwnershipClient } from "./ownership-client";

export const metadata = { title: "Ownership" };

export default async function OwnershipPage() {
  const { admin } = await requirePermission("owner");
  const d = db();
  return (
    <>
      <PageHeader
        eyebrow="Owner only"
        title="Ownership & danger zone"
        description="Controls that affect every operator and every learner. Each one asks you to confirm and is written to the audit log."
      />
      <OwnershipClient
        ownerName={admin.name}
        candidates={d.admins.filter((a) => a.role === "superadmin" && a.status === "active").map((a) => ({ id: a.id, name: a.name, email: a.email }))}
        activeOperators={d.admins.filter((a) => a.status === "active" && a.id !== admin.id).length}
        maintenance={d.settings.maintenanceMode}
      />
    </>
  );
}
