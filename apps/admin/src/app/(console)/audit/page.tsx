import { requirePermission } from "@/lib/auth";
import { requestTime } from "@/lib/clock";
import { db } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/primitives";
import { AuditClient } from "./audit-client";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  await requirePermission("audit");
  const d = db();
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every operator action with who, what and when. Entries can't be edited or deleted from the console."
      />
      <AuditClient entries={d.audit} actors={d.admins.map((a) => ({ id: a.id, name: a.name }))} now={requestTime()} />
    </>
  );
}
