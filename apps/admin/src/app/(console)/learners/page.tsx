import { requirePermission } from "@/lib/auth";
import { requestTime } from "@/lib/clock";
import { db } from "@/lib/data/store";
import { toRow } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/primitives";
import { LearnersClient } from "./learners-client";

export const metadata = { title: "Learners" };

export default async function LearnersPage() {
  await requirePermission("learners");
  const d = db();
  const counts = new Map<string, { total: number; attended: number }>();
  for (const b of d.bookings) {
    const c = counts.get(b.learnerId) ?? { total: 0, attended: 0 };
    c.total++;
    if (b.status === "completed") c.attended++;
    counts.set(b.learnerId, c);
  }
  const rows = d.learners.map((l) => ({ ...l, bookings: counts.get(l.id)?.total ?? 0, attended: counts.get(l.id)?.attended ?? 0 }));
  const bookingsByLearner: Record<string, ReturnType<typeof toRow>[]> = {};
  for (const b of d.bookings) (bookingsByLearner[b.learnerId] ??= []).push(toRow(b));
  return (
    <>
      <PageHeader
        title="Learners"
        description="Students and corporate employees who signed up in the app. Contains personal data; access is logged."
      />
      <LearnersClient rows={rows} bookingsByLearner={bookingsByLearner} now={requestTime()} />
    </>
  );
}
