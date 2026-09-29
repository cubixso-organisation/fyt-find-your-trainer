import { requirePermission } from "@/lib/auth";
import { requestTime } from "@/lib/clock";
import { db } from "@/lib/data/store";
import { toRow } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/primitives";
import { BookingsClient } from "./bookings-client";

export const metadata = { title: "Bookings" };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requirePermission("bookings");
  const { view } = await searchParams;
  const rows = db().bookings.map(toRow);
  return (
    <>
      <PageHeader
        title="Bookings"
        description="Demo, mentorship and consultation bookings from the app. Confirm requests, fix Meet links and record outcomes."
      />
      <BookingsClient rows={rows} now={requestTime()} initialView={view === "calendar" ? "calendar" : view === "attention" ? "attention" : "upcoming"} />
    </>
  );
}
