import { requirePermission } from "@/lib/auth";
import { requestTime } from "@/lib/clock";
import { db } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/primitives";
import { InstitutesClient } from "./institutes-client";

export const metadata = { title: "Institutes" };

const AREAS = ["Ameerpet", "Madhapur", "Kukatpally", "Gachibowli", "Dilsukhnagar", "Kondapur", "SR Nagar", "Hitech City", "Begumpet", "Miyapur", "Secunderabad", "Uppal", "LB Nagar"];

export default async function InstitutesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  await requirePermission("institutes");
  const sp = await searchParams;
  const d = db();
  return (
    <>
      <PageHeader title="Institutes" description="The institute directory in the app. Only operators create listings; institutes don't sign in." />
      <InstitutesClient
        rows={d.institutes.map((i) => ({ ...i, courseCount: d.courses.filter((c) => c.instituteId === i.id).length }))}
        areas={AREAS}
        categories={d.settings.categories}
        stacks={d.settings.techStacks}
        openNew={sp.new === "1"}
        now={requestTime()}
      />
    </>
  );
}
