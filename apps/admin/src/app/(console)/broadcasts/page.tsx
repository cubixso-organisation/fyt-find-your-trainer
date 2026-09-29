import { requirePermission } from "@/lib/auth";
import { requestTime } from "@/lib/clock";
import { db } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/primitives";
import { BroadcastsClient } from "./broadcasts-client";

export const metadata = { title: "Broadcasts" };

export default async function BroadcastsPage() {
  await requirePermission("notifications");
  const d = db();
  const reachable = d.learners.filter((l) => !l.blocked && l.onboarded);
  return (
    <>
      <PageHeader title="Broadcasts" description="Push notifications to learners' phones. Use sparingly: every send costs attention." />
      <BroadcastsClient
        history={d.broadcasts.map((b) => ({ ...b, createdByName: d.admins.find((a) => a.id === b.createdBy)?.name ?? "Unknown" }))}
        reach={{ all: reachable.length, student: reachable.filter((l) => l.segment === "student").length, corporate: reachable.filter((l) => l.segment === "corporate").length }}
        platformName={d.settings.platformName}
        now={requestTime()}
      />
    </>
  );
}
