import { requirePermission } from "@/lib/auth";
import { requestTime } from "@/lib/clock";
import { db } from "@/lib/data/store";
import { addDays, istDateKey, istEpoch } from "@/lib/slots";
import { PageHeader } from "@/components/ui/primitives";
import { AvailabilityClient } from "./availability-client";

export const metadata = { title: "Availability" };

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ target?: string }> }) {
  await requirePermission("availability");
  const sp = await searchParams;
  const d = db();
  const now = requestTime();
  const today = istDateKey(now);
  // Only what the 14-day preview needs, and only the fields the generator reads.
  const horizon = istEpoch(addDays(today, 15), 0);
  const bookings = d.bookings
    .filter((b) => b.end > now && b.start < horizon && b.status !== "cancelled")
    .map((b) => ({ targetId: b.targetId, start: b.start, end: b.end, status: b.status }));
  const targets = [
    ...d.providers.map((p) => ({ id: p.id, type: p.type, name: p.name, published: p.published })),
    ...d.courses.map((c) => ({ id: c.id, type: "course" as const, name: c.title, published: c.published })),
  ];
  return (
    <>
      <PageHeader
        title="Availability"
        description="Weekly windows and date exceptions that turn into bookable slots in the app. Trainers don't log in, so operators keep these current."
      />
      <AvailabilityClient
        targets={targets}
        rules={d.availability}
        exceptions={d.availabilityExceptions}
        bookings={bookings}
        leadHours={d.settings.bookingLeadHours}
        now={now}
        today={today}
        initialTarget={targets.find((t) => t.id === sp.target)?.id ?? targets[0]?.id}
      />
    </>
  );
}
