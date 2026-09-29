import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/primitives";
import { ContentClient } from "./content-client";

export const metadata = { title: "App home & taxonomy" };

export default async function ContentPage() {
  await requirePermission("content");
  const d = db();
  const pub = <T extends { published: boolean }>(xs: T[]) => xs.filter((x) => x.published);
  return (
    <>
      <PageHeader
        title="App home & taxonomy"
        description="What learners see first when they open the app, and the vocabulary behind every filter."
      />
      <ContentClient
        categories={d.settings.categories}
        techStacks={d.settings.techStacks}
        featured={d.settings.homeFeatured}
        institutes={pub(d.institutes).map((x) => ({ id: x.id, label: x.name, sub: x.area }))}
        courses={pub(d.courses).map((x) => ({ id: x.id, label: x.title, sub: x.category }))}
        providers={pub(d.providers).map((x) => ({ id: x.id, label: x.name, sub: x.type }))}
        usage={Object.fromEntries(d.settings.categories.map((c) => [c, d.courses.filter((x) => x.category === c).length]))}
      />
    </>
  );
}
