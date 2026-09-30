"use client";

import * as React from "react";
import { ImageIcon, ImageOff, MapPin, Plus, Star, Trash2 } from "lucide-react";
import type { Institute } from "@/lib/data/types";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { ChipSelect, TagInput, ToggleRow } from "@/components/ui/choice";
import { ConfirmDialog, Drawer } from "@/components/ui/overlays";
import { PublishedPill } from "@/components/ui/status";
import { useServerAction } from "@/components/ui/use-action";
import { relTime } from "@/lib/utils";
import { deleteInstitute, saveInstitute } from "../catalog-actions";
import { solarIcon } from "@/components/icons/solar";
import { GalleryField, Thumb } from "@/components/media/image-upload";

type Row = Institute & { courseCount: number };
type Draft = Omit<Institute, "id" | "createdAt" | "updatedAt" | "gallery"> & { id?: string };

const blank = (): Draft => ({ name: "", area: "", address: "", phone: "", email: "", categories: [], specializations: [], published: false, featured: false });

export function InstitutesClient({ rows, areas, categories, stacks, openNew, now }: { rows: Row[]; areas: string[]; categories: string[]; stacks: string[]; openNew: boolean; now: number }) {
  const [e, setE] = React.useState<Draft | null>(openNew ? blank() : null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const { pending, run } = useServerAction();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setE((c) => (c ? { ...c, [k]: v } : c));
  // Gallery changes save on their own, so the drawer reads them from the live row.
  const live = e?.id ? rows.find((r) => r.id === e.id) : undefined;

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Institute",
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          {r.gallery[0] ? (
            <Thumb image={r.gallery[0]} alt="" className="size-9 shrink-0 rounded-[6px] border border-line" />
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-[6px] border border-dashed border-line-strong text-ink-3">
              <ImageOff className="size-3.5" strokeWidth={1.6} aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium">
              {r.featured ? <Star className="size-3.5 fill-accent text-accent" strokeWidth={1.5} aria-label="Featured" /> : null}
              {r.name}
            </p>
            <p className="flex items-center gap-1 text-[12px] text-ink-3"><MapPin className="size-3" strokeWidth={1.75} /> {r.area}</p>
          </div>
        </div>
      ),
    },
    { key: "cats", header: "Categories", hideBelow: "md", cell: (r) => <span className="text-ink-2">{r.categories.join(", ")}</span> },
    { key: "courses", header: "Courses", hideBelow: "sm", sortValue: (r) => r.courseCount, cell: (r) => <span className="num">{r.courseCount}</span>, className: "text-right", headerClassName: "text-right" },
    {
      key: "gallery",
      header: "Gallery",
      hideBelow: "lg",
      sortValue: (r) => r.gallery.length,
      cell: (r) =>
        r.gallery.length ? (
          <span className="num inline-flex items-center gap-1 text-ink-2"><ImageIcon className="size-3.5" strokeWidth={1.75} /> {r.gallery.length}</span>
        ) : (
          <span className="text-[12.5px] text-warn">No photos</span>
        ),
    },
    { key: "status", header: "In app", sortValue: (r) => Number(r.published), cell: (r) => <PublishedPill published={r.published} /> },
    { key: "updated", header: "Updated", hideBelow: "xl", sortValue: (r) => r.updatedAt, cell: (r) => <span className="text-[12.5px] text-ink-3">{relTime(r.updatedAt, now)}</span> },
  ];

  return (
    <>
      <DataTable
        caption="Institutes"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setE({ ...r })}
        initialSort={{ key: "name", dir: "asc" }}
        search={(r) => `${r.name} ${r.area} ${r.categories.join(" ")} ${r.specializations.join(" ")}`}
        searchPlaceholder="Search name, area, specialisation"
        filters={[
          { key: "area", label: "Area", options: [...new Set(rows.map((r) => r.area))].sort().map((a) => ({ value: a, label: a })), test: (r, v) => r.area === v },
          { key: "cat", label: "Category", options: categories.map((c) => ({ value: c, label: c })), test: (r, v) => r.categories.includes(v) },
          { key: "status", label: "In app", options: [{ value: "on", label: "Published" }, { value: "off", label: "Hidden" }], test: (r, v) => (v === "on") === r.published },
        ]}
        toolbar={<Button variant="primary" size="sm" onClick={() => setE(blank())}><Plus className="size-4" strokeWidth={1.75} /> Add institute</Button>}
        empty={{ icon: solarIcon("buildings-2-bold-duotone"), title: "No institutes yet", body: "Add the institutes the client has onboarded. They appear in the app's directory once published." }}
      />

      <Drawer
        icon={solarIcon("buildings-2-bold-duotone")}
        open={!!e}
        onOpenChange={(o) => !o && setE(null)}
        title={e?.id ? e.name || "Edit institute" : "New institute"}
        description="Contact details are shown to learners in the app."
        width="max-w-[600px]"
        footer={
          e ? (
            <>
              {e.id ? (
                <Button variant="ghost" className="mr-auto text-bad hover:text-bad" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4" strokeWidth={1.75} /> Delete
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setE(null)}>Discard</Button>
              <Button variant="primary" loading={pending === "save"} onClick={async () => { const r = await run("save", () => saveInstitute(e)); if (r.ok) setE(null); }}>
                {e.id ? "Save changes" : "Add institute"}
              </Button>
            </>
          ) : null
        }
      >
        {e ? (
          <form className="flex flex-col gap-5" onSubmit={(ev) => ev.preventDefault()}>
            <Field label="Institute name" htmlFor="name">
              <Input id="name" value={e.name} onChange={(ev) => set("name", ev.target.value)} placeholder="Ameerpet CodeWorks" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr]">
              <Field label="Area" htmlFor="area">
                <Select id="area" value={e.area} onChange={(ev) => set("area", ev.target.value)}>
                  <option value="">Choose…</option>
                  {areas.map((a) => <option key={a}>{a}</option>)}
                </Select>
              </Field>
              <Field label="Street address" htmlFor="address">
                <Input id="address" value={e.address} onChange={(ev) => set("address", ev.target.value)} placeholder="Plot 14, Maitrivanam, Ameerpet" />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Admissions phone" htmlFor="phone">
                <Input id="phone" type="tel" inputMode="tel" value={e.phone} onChange={(ev) => set("phone", ev.target.value)} placeholder="+91 98490 12345" className="num" />
              </Field>
              <Field label="Admissions email" htmlFor="email">
                <Input id="email" type="email" value={e.email} onChange={(ev) => set("email", ev.target.value)} placeholder="admissions@institute.in" />
              </Field>
            </div>
            <Field label="Categories" htmlFor="cats" hint="Used by the category filter in the directory.">
              <ChipSelect id="cats" options={categories} value={e.categories} onChange={(v) => set("categories", v)} />
            </Field>
            <Field label="Specialisations" htmlFor="specs">
              <TagInput id="specs" value={e.specializations} onChange={(v) => set("specializations", v)} suggestions={stacks} />
            </Field>
            <Field label="Gallery" htmlFor="gallery" hint={e.id ? "The first photo is the cover in the directory. Photos save as you add them." : undefined}>
              <GalleryField id="gallery" instituteId={e.id} images={live?.gallery ?? []} name={e.name || "Institute"} />
            </Field>
            <div className="flex flex-col divide-y divide-line rounded-[var(--radius-panel)] border border-line">
              <ToggleRow label="Show in app" body="Hidden institutes don't appear in the directory." checked={e.published} onChange={(v) => set("published", v)} />
              <ToggleRow label="Feature on home" body="Appears in the featured institutes row." checked={e.featured} onChange={(v) => set("featured", v)} />
            </div>
          </form>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${e?.name}?`}
        body="The institute disappears from the app and from this console. Institutes with linked courses can't be deleted; hide them instead."
        confirmLabel="Delete institute"
        loading={pending === "delete"}
        onConfirm={async () => {
          if (!e?.id) return;
          const r = await run("delete", () => deleteInstitute(e.id!));
          setConfirmDelete(false);
          if (r.ok) setE(null);
        }}
      />
    </>
  );
}
