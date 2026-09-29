"use client";

import * as React from "react";
import { Eye, EyeOff, ImageOff, Plus, Star, Trash2 } from "lucide-react";
import type { Course } from "@/lib/data/types";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Segmented, TagInput, ToggleRow } from "@/components/ui/choice";
import { ConfirmDialog, Drawer } from "@/components/ui/overlays";
import { PublishedPill } from "@/components/ui/status";
import { useServerAction } from "@/components/ui/use-action";
import { relTime } from "@/lib/utils";
import { deleteCourse, saveCourse, setCoursesPublished } from "../catalog-actions";
import { solarIcon } from "@/components/icons/solar";
import { SingleImageField, Thumb } from "@/components/media/image-upload";

type Row = Course & { demand30: number; instituteName?: string };

const blank = (): Omit<Course, "id" | "createdAt" | "updatedAt" | "cover"> & { id?: string } => ({
  kind: "course",
  title: "",
  instituteId: undefined,
  category: "",
  techStack: [],
  durationWeeks: 8,
  modes: ["online"],
  description: "",
  published: false,
  featured: false,
});

export function CoursesClient({
  rows,
  institutes,
  categories,
  stacks,
  openNew,
  now,
}: {
  rows: Row[];
  institutes: Array<{ id: string; name: string }>;
  categories: string[];
  stacks: string[];
  openNew: boolean;
  now: number;
}) {
  const [editing, setEditing] = React.useState<ReturnType<typeof blank> | null>(openNew ? blank() : null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const { pending, run } = useServerAction();

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Listing",
      sortValue: (r) => r.title,
      cell: (r) => (
        <div className="flex min-w-0 max-w-[420px] items-center gap-3">
          {r.cover ? (
            <Thumb image={r.cover} alt="" className="h-9 w-14 shrink-0 rounded-[5px] border border-line" />
          ) : (
            <span className="grid h-9 w-14 shrink-0 place-items-center rounded-[5px] border border-dashed border-line-strong text-ink-3" title="No cover image">
              <ImageOff className="size-3.5" strokeWidth={1.6} aria-label="No cover image" />
            </span>
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-medium">
              {r.featured ? <Star className="size-3.5 shrink-0 fill-accent text-accent" strokeWidth={1.5} aria-label="Featured" /> : null}
              <span className="truncate">{r.title}</span>
            </p>
            <p className="truncate text-[12px] text-ink-3">{r.kind === "project" ? "Project" : r.instituteName ?? "No institute"}</p>
          </div>
        </div>
      ),
    },
    { key: "category", header: "Category", sortValue: (r) => r.category, hideBelow: "md", cell: (r) => <span className="text-ink-2">{r.category}</span> },
    {
      key: "stack",
      header: "Tech stack",
      hideBelow: "lg",
      cell: (r) => (
        <div className="flex max-w-[240px] flex-wrap gap-1">
          {r.techStack.slice(0, 3).map((t) => (
            <span key={t} className="rounded-[4px] bg-sunken px-1.5 py-0.5 text-[11.5px] text-ink-2">{t}</span>
          ))}
          {r.techStack.length > 3 ? <span className="text-[11.5px] text-ink-3">+{r.techStack.length - 3}</span> : null}
        </div>
      ),
    },
    { key: "weeks", header: "Length", sortValue: (r) => r.durationWeeks, hideBelow: "md", cell: (r) => <span className="num text-ink-2">{r.durationWeeks} wk</span> },
    {
      key: "demand",
      header: "Bookings 30d",
      sortValue: (r) => r.demand30,
      cell: (r) => <span className="num">{r.demand30}</span>,
      className: "text-right",
      headerClassName: "text-right",
    },
    { key: "status", header: "In app", sortValue: (r) => Number(r.published), cell: (r) => <PublishedPill published={r.published} /> },
    { key: "updated", header: "Updated", sortValue: (r) => r.updatedAt, hideBelow: "xl", cell: (r) => <span className="text-[12.5px] text-ink-3">{relTime(r.updatedAt, now)}</span> },
  ];

  const e = editing;
  const live = e?.id ? rows.find((r) => r.id === e.id) : undefined;
  const set = <K extends keyof NonNullable<typeof e>>(k: K, v: NonNullable<typeof e>[K]) => setEditing((cur) => (cur ? { ...cur, [k]: v } : cur));

  return (
    <>
      <DataTable
        caption="Courses and projects"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setEditing({ ...r })}
        initialSort={{ key: "demand", dir: "desc" }}
        search={(r) => `${r.title} ${r.category} ${r.techStack.join(" ")} ${r.instituteName ?? ""}`}
        searchPlaceholder="Search title, stack, institute"
        filters={[
          { key: "kind", label: "Type", options: [{ value: "course", label: "Courses" }, { value: "project", label: "Projects" }], test: (r, v) => r.kind === v },
          { key: "category", label: "Category", options: categories.map((c) => ({ value: c, label: c })), test: (r, v) => r.category === v },
          { key: "status", label: "In app", options: [{ value: "on", label: "Published" }, { value: "off", label: "Hidden" }], test: (r, v) => (v === "on") === r.published },
        ]}
        selectable
        bulkActions={(sel, clear) => (
          <>
            <Button size="sm" loading={pending === "pub"} onClick={async () => { await run("pub", () => setCoursesPublished(sel.map((s) => s.id), true)); clear(); }}>
              <Eye className="size-3.5" strokeWidth={1.75} /> Publish
            </Button>
            <Button size="sm" loading={pending === "hide"} onClick={async () => { await run("hide", () => setCoursesPublished(sel.map((s) => s.id), false)); clear(); }}>
              <EyeOff className="size-3.5" strokeWidth={1.75} /> Hide
            </Button>
          </>
        )}
        toolbar={
          <Button variant="primary" size="sm" onClick={() => setEditing(blank())}>
            <Plus className="size-4" strokeWidth={1.75} /> Add listing
          </Button>
        }
        empty={{
          icon: solarIcon("notebook-bookmark-bold-duotone"),
          title: "No courses yet",
          body: "Add the first course or capstone project. Learners can book demos once it is published.",
          action: <Button variant="primary" size="sm" onClick={() => setEditing(blank())}><Plus className="size-4" /> Add listing</Button>,
        }}
      />

      <Drawer
        open={!!e}
        onOpenChange={(o) => !o && setEditing(null)}
        title={e?.id ? "Edit listing" : "New listing"}
        description={e?.id ? "Changes reach the app as soon as you save." : "Starts hidden unless you switch on “Show in app”."}
        width="max-w-[600px]"
        footer={
          e ? (
            <>
              {e.id ? (
                <Button variant="ghost" className="mr-auto text-bad hover:text-bad" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4" strokeWidth={1.75} /> Delete
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setEditing(null)}>Discard</Button>
              <Button
                variant="primary"
                loading={pending === "save"}
                onClick={async () => {
                  const r = await run("save", () => saveCourse(e));
                  if (r.ok) setEditing(null);
                }}
              >
                {e.id ? "Save changes" : "Add listing"}
              </Button>
            </>
          ) : null
        }
      >
        {e ? (
          <form className="flex flex-col gap-5" onSubmit={(ev) => ev.preventDefault()}>
            <Field label="Type" htmlFor="kind">
              <Segmented label="Listing type" value={e.kind} onChange={(v) => set("kind", v)} options={[{ value: "course", label: "Course" }, { value: "project", label: "Project" }]} />
            </Field>
            <Field label="Cover image" htmlFor="cover" optional hint={e.id ? "Wide images (16:9) crop best on the listing card." : undefined}>
              <SingleImageField
                id="cover"
                slot="course-cover"
                ownerId={e.id}
                image={live?.cover}
                alt={`${e.title || "Listing"} cover`}
                label="Upload a cover image"
                emptyHint="Add the listing first, then upload a cover image."
              />
            </Field>
            <Field label="Title" htmlFor="title" hint="Learners search by this. Lead with the skill, not the institute.">
              <Input id="title" value={e.title} onChange={(ev) => set("title", ev.target.value)} placeholder="Full Stack Java with Spring Boot" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="category">
                <Select id="category" value={e.category} onChange={(ev) => set("category", ev.target.value)}>
                  <option value="">Choose…</option>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Duration (weeks)" htmlFor="weeks">
                <Input id="weeks" type="number" min={1} max={104} value={e.durationWeeks} onChange={(ev) => set("durationWeeks", Number(ev.target.value))} className="num" />
              </Field>
            </div>
            <Field label="Institute" htmlFor="institute" optional={e.kind === "project"} hint={e.kind === "course" ? "Required for in-person demos; the address comes from here." : undefined}>
              <Select id="institute" value={e.instituteId ?? ""} onChange={(ev) => set("instituteId", ev.target.value || undefined)}>
                <option value="">No institute</option>
                {institutes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </Field>
            <Field label="Tech stack" htmlFor="stack" hint="Drives the tech-stack filter in the app.">
              <TagInput id="stack" value={e.techStack} onChange={(v) => set("techStack", v)} suggestions={stacks} />
            </Field>
            <Field label="Demo modes" htmlFor="modes">
              <div className="flex gap-4 text-sm">
                {(["online", "offline"] as const).map((m) => (
                  <label key={m} className="inline-flex items-center gap-2">
                    <Checkbox checked={e.modes.includes(m)} onChange={() => set("modes", e.modes.includes(m) ? e.modes.filter((x) => x !== m) : [...e.modes, m])} />
                    {m === "online" ? "Online (Google Meet)" : "In person"}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Description" htmlFor="desc" hint={`${e.description.length}/1200`}>
              <Textarea id="desc" value={e.description} onChange={(ev) => set("description", ev.target.value)} rows={5} />
            </Field>
            <div className="flex flex-col divide-y divide-line rounded-[var(--radius-panel)] border border-line">
              <ToggleRow label="Show in app" body="Hidden listings can't be found or booked." checked={e.published} onChange={(v) => set("published", v)} />
              <ToggleRow label="Feature on home" body="Appears in the featured row of the app home." checked={e.featured} onChange={(v) => set("featured", v)} />
            </div>
          </form>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${e?.title}”?`}
        body="This removes the listing for good. Past bookings keep their history. If you might bring it back, hide it instead."
        confirmLabel="Delete listing"
        loading={pending === "delete"}
        onConfirm={async () => {
          if (!e?.id) return;
          const r = await run("delete", () => deleteCourse(e.id!));
          setConfirmDelete(false);
          if (r.ok) setEditing(null);
        }}
      />
    </>
  );
}
