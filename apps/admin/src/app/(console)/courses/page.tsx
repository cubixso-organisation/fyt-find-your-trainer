import { requirePermission } from "@/lib/auth";
import { requestTime } from "@/lib/clock";
import { db } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/primitives";
import { CoursesClient } from "./courses-client";

export const metadata = { title: "Courses & projects" };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  await requirePermission("courses");
  const sp = await searchParams;
  const d = db();
  const now = requestTime();
  const demand = new Map<string, number>();
  for (const b of d.bookings) if (b.targetType === "course" && b.createdAt > now - 30 * 86_400_000) demand.set(b.targetId, (demand.get(b.targetId) ?? 0) + 1);
  return (
    <>
      <PageHeader title="Courses & projects" description="Listings learners browse and book demos for. Hidden listings stay here but disappear from the app." />
      <CoursesClient
        rows={d.courses.map((c) => ({ ...c, demand30: demand.get(c.id) ?? 0, instituteName: d.institutes.find((i) => i.id === c.instituteId)?.name }))}
        institutes={d.institutes.map((i) => ({ id: i.id, name: i.name }))}
        categories={d.settings.categories}
        stacks={d.settings.techStacks}
        openNew={sp.new === "1"}
        now={now}
      />
    </>
  );
}
