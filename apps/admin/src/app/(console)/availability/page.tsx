import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/primitives";
import { AvailabilityClient } from "./availability-client";

export const metadata = { title: "Availability" };

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ target?: string }> }) {
  await requirePermission("availability");
  const sp = await searchParams;
  const d = db();
  const targets = [
    ...d.providers.map((p) => ({ id: p.id, type: p.type, name: p.name, published: p.published })),
    ...d.courses.map((c) => ({ id: c.id, type: "course" as const, name: c.title, published: c.published })),
  ];
  return (
    <>
      <PageHeader
        title="Availability"
        description="Weekly windows that turn into bookable slots in the app. Trainers don't log in, so operators keep these current."
      />
      <AvailabilityClient
        targets={targets}
        rules={d.availability}
        initialTarget={targets.find((t) => t.id === sp.target)?.id ?? targets[0]?.id}
      />
    </>
  );
}
