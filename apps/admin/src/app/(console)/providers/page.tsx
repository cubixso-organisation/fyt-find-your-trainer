import { requirePermission } from "@/lib/auth";
import { requestTime } from "@/lib/clock";
import { db } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/primitives";
import { ProvidersClient } from "./providers-client";

export const metadata = { title: "Trainers & mentors" };

export default async function ProvidersPage({ searchParams }: { searchParams: Promise<{ new?: string; type?: string }> }) {
  await requirePermission("providers");
  const sp = await searchParams;
  const d = db();
  const now = requestTime();
  return (
    <>
      <PageHeader
        title="Trainers, mentors & consultants"
        description="People and organisations learners book 1-on-1 time with. They get Meet invites by email; they don't sign in."
      />
      <ProvidersClient
        rows={d.providers.map((p) => ({
          ...p,
          upcoming: d.bookings.filter((b) => b.targetId === p.id && b.start > now && ["confirmed", "requested"].includes(b.status)).length,
          slotsPerWeek: d.availability
            .filter((a) => a.targetId === p.id)
            .reduce((n, a) => n + Math.floor((a.endMinute - a.startMinute) / a.slotMinutes), 0),
        }))}
        openNew={sp.new === "1"}
        initialType={sp.type}
      />
    </>
  );
}
