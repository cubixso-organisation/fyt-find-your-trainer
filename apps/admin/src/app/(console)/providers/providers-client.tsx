"use client";

import * as React from "react";
import Link from "next/link";
import { Building, CalendarClock, Plus, Star, Trash2, UserRound } from "lucide-react";
import type { Provider, ProviderType } from "@/lib/data/types";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar, Button, Field, Input, buttonClass } from "@/components/ui/primitives";
import { Segmented, TagInput, ToggleRow } from "@/components/ui/choice";
import { ConfirmDialog, Drawer } from "@/components/ui/overlays";
import { Pill, PublishedPill } from "@/components/ui/status";
import { useServerAction } from "@/components/ui/use-action";
import { deleteProvider, saveProvider } from "../catalog-actions";
import { solarIcon } from "@/components/icons/solar";
import { SingleImageField, Thumb } from "@/components/media/image-upload";

type Row = Provider & { upcoming: number; slotsPerWeek: number };
type Draft = Omit<Provider, "id" | "createdAt" | "updatedAt" | "rating" | "photo"> & { id?: string; rating?: number | "" };

const TYPE_LABEL: Record<ProviderType, string> = { trainer: "Trainer", mentor: "Mentor", consultant: "Consultant" };
const blank = (type: ProviderType = "trainer"): Draft => ({
  type,
  name: "",
  isOrganisation: false,
  headline: "",
  expertise: [],
  email: "",
  yearsExperience: 5,
  rating: "",
  published: false,
  featured: false,
});

export function ProvidersClient({ rows, openNew, initialType }: { rows: Row[]; openNew: boolean; initialType?: string }) {
  const [e, setE] = React.useState<Draft | null>(openNew ? blank() : null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const { pending, run } = useServerAction();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setE((c) => (c ? { ...c, [k]: v } : c));
  // The drawer edits a copy; images save on their own, so read them from the live row.
  const live = e?.id ? rows.find((r) => r.id === e.id) : undefined;

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          {r.photo ? (
            <Thumb image={r.photo} alt="" className={r.isOrganisation ? "size-8 shrink-0 rounded-[7px] border border-line" : "size-8 shrink-0 rounded-full border border-line"} />
          ) : r.isOrganisation ? (
            <span className="grid size-8 shrink-0 place-items-center rounded-[7px] bg-sunken text-ink-2"><Building className="size-4" strokeWidth={1.6} /></span>
          ) : (
            <Avatar name={r.name} />
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-medium">
              {r.featured ? <Star className="size-3.5 shrink-0 fill-accent text-accent" strokeWidth={1.5} aria-label="Featured" /> : null}
              {r.name}
            </p>
            <p className="max-w-[340px] truncate text-[12px] text-ink-3">{r.headline}</p>
          </div>
        </div>
      ),
    },
    { key: "type", header: "Type", sortValue: (r) => r.type, cell: (r) => <Pill tone="neutral" icon={r.isOrganisation ? Building : UserRound}>{TYPE_LABEL[r.type]}</Pill> },
    { key: "exp", header: "Experience", hideBelow: "lg", sortValue: (r) => r.yearsExperience, cell: (r) => <span className="num text-ink-2">{r.yearsExperience} yrs</span> },
    {
      key: "slots",
      header: "Open slots / wk",
      hideBelow: "md",
      sortValue: (r) => r.slotsPerWeek,
      cell: (r) =>
        r.slotsPerWeek ? <span className="num">{r.slotsPerWeek}</span> : <span className="text-[12.5px] text-warn">No availability</span>,
    },
    { key: "upcoming", header: "Upcoming", sortValue: (r) => r.upcoming, cell: (r) => <span className="num">{r.upcoming}</span>, className: "text-right", headerClassName: "text-right" },
    { key: "status", header: "In app", sortValue: (r) => Number(r.published), cell: (r) => <PublishedPill published={r.published} /> },
  ];

  return (
    <>
      <DataTable
        caption="Trainers, mentors and consultants"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setE({ ...r, rating: r.rating ?? "" })}
        initialSort={{ key: "upcoming", dir: "desc" }}
        initialFilters={initialType ? { type: initialType } : {}}
        search={(r) => `${r.name} ${r.headline} ${r.expertise.join(" ")} ${r.email}`}
        searchPlaceholder="Search name, expertise, email"
        filters={[
          { key: "type", label: "Type", options: Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })), test: (r, v) => r.type === v },
          { key: "status", label: "In app", options: [{ value: "on", label: "Published" }, { value: "off", label: "Hidden" }], test: (r, v) => (v === "on") === r.published },
        ]}
        toolbar={<Button variant="primary" size="sm" onClick={() => setE(blank())}><Plus className="size-4" strokeWidth={1.75} /> Add person</Button>}
        empty={{ icon: solarIcon("square-academic-cap-bold-duotone"), title: "No trainers, mentors or consultants yet", body: "Add a profile, then set its weekly availability so learners can book it." }}
      />

      <Drawer
        icon={solarIcon("square-academic-cap-bold-duotone")}
        open={!!e}
        onOpenChange={(o) => !o && setE(null)}
        title={e?.id ? e.name || "Edit profile" : "New profile"}
        description={e?.id ? `${TYPE_LABEL[e.type]} profile` : "Add availability after saving so the profile becomes bookable."}
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
              <Button variant="primary" loading={pending === "save"} onClick={async () => { const r = await run("save", () => saveProvider(e)); if (r.ok) setE(null); }}>
                {e.id ? "Save changes" : "Add profile"}
              </Button>
            </>
          ) : null
        }
      >
        {e ? (
          <form className="flex flex-col gap-5" onSubmit={(ev) => ev.preventDefault()}>
            <Field label="Profile type" htmlFor="type">
              <Segmented
                label="Profile type"
                value={e.type}
                onChange={(v) => set("type", v)}
                options={[{ value: "trainer", label: "Trainer" }, { value: "mentor", label: "Mentor" }, { value: "consultant", label: "Consultant" }]}
              />
            </Field>
            <Field label={e.isOrganisation ? "Logo" : "Photo"} htmlFor="photo" optional hint={e.id ? "Square works best. Shown on the profile and in search results." : undefined}>
              <SingleImageField
                id="photo"
                slot="provider-photo"
                ownerId={e.id}
                image={live?.photo}
                alt={`${e.name || "Profile"} ${e.isOrganisation ? "logo" : "photo"}`}
                shape="square"
                label={e.isOrganisation ? "Upload a logo" : "Upload a photo"}
                emptyHint="Add the profile first, then upload a photo."
              />
            </Field>
            <Field label={e.isOrganisation ? "Organisation name" : "Full name"} htmlFor="name">
              <Input id="name" value={e.name} onChange={(ev) => set("name", ev.target.value)} />
            </Field>
            <label className="-mt-2 inline-flex items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={e.isOrganisation} onChange={(ev) => set("isOrganisation", ev.target.checked)} />
              This is an organisation, not an individual
            </label>
            <Field label="Headline" htmlFor="headline" hint="One line shown under the name in the app.">
              <Input id="headline" value={e.headline} onChange={(ev) => set("headline", ev.target.value)} placeholder="VP Engineering at a Hyderabad fintech" />
            </Field>
            <Field label="Expertise" htmlFor="expertise">
              <TagInput id="expertise" value={e.expertise} onChange={(v) => set("expertise", v)} placeholder="System design, Career growth…" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_1fr]">
              <Field label="Email for Meet invites" htmlFor="pemail">
                <Input id="pemail" type="email" value={e.email} onChange={(ev) => set("email", ev.target.value)} />
              </Field>
              <Field label="Experience (yrs)" htmlFor="yrs">
                <Input id="yrs" type="number" min={0} max={60} value={e.yearsExperience} onChange={(ev) => set("yearsExperience", Number(ev.target.value))} className="num" />
              </Field>
              <Field label="Display rating" htmlFor="rating" optional>
                <Input id="rating" type="number" min={1} max={5} step={0.1} value={e.rating ?? ""} onChange={(ev) => set("rating", ev.target.value === "" ? "" : Number(ev.target.value))} className="num" />
              </Field>
            </div>
            <p className="-mt-3 text-[12.5px] text-ink-3">Learner reviews arrive in Phase 2. Until then, the rating is set here by operators.</p>
            <div className="flex flex-col divide-y divide-line rounded-[var(--radius-panel)] border border-line">
              <ToggleRow label="Show in app" body="Hidden profiles can't be found or booked." checked={e.published} onChange={(v) => set("published", v)} />
              <ToggleRow label="Feature on home" body="Appears in the featured row of the app home." checked={e.featured} onChange={(v) => set("featured", v)} />
            </div>
            {e.id ? (
              <Link href={`/availability?target=${e.id}`} className={buttonClass("secondary", "md", "self-start")}>
                <CalendarClock className="size-4" strokeWidth={1.6} /> Edit weekly availability
              </Link>
            ) : null}
          </form>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${e?.name}?`}
        body="Their availability rules are removed too. Profiles with upcoming bookings can't be deleted; hide them instead."
        confirmLabel="Delete profile"
        loading={pending === "delete"}
        onConfirm={async () => {
          if (!e?.id) return;
          const r = await run("delete", () => deleteProvider(e.id!));
          setConfirmDelete(false);
          if (r.ok) setE(null);
        }}
      />
    </>
  );
}
