"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { Button, Checkbox, Panel, PanelHeader } from "@/components/ui/primitives";
import { TagInput } from "@/components/ui/choice";
import { useServerAction } from "@/components/ui/use-action";
import { cn } from "@/lib/utils";
import { saveTaxonomy } from "../settings/actions";

type Item = { id: string; label: string; sub: string };
type Featured = { institutes: string[]; courses: string[]; providers: string[] };

export function ContentClient({
  categories: c0,
  techStacks: t0,
  featured: f0,
  institutes,
  courses,
  providers,
  usage,
}: {
  categories: string[];
  techStacks: string[];
  featured: Featured;
  institutes: Item[];
  courses: Item[];
  providers: Item[];
  usage: Record<string, number>;
}) {
  const [categories, setCategories] = React.useState(c0);
  const [techStacks, setTechStacks] = React.useState(t0);
  const [featured, setFeatured] = React.useState(f0);
  const { pending, run } = useServerAction();
  const dirty = JSON.stringify([categories, techStacks, featured]) !== JSON.stringify([c0, t0, f0]);

  return (
    <div className="grid grid-cols-1 gap-6 pb-20 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <FeaturedPicker title="Featured courses & projects" items={courses} value={featured.courses} onChange={(v) => setFeatured((f) => ({ ...f, courses: v }))} />
        <FeaturedPicker title="Featured institutes" items={institutes} value={featured.institutes} onChange={(v) => setFeatured((f) => ({ ...f, institutes: v }))} />
        <FeaturedPicker title="Featured trainers & mentors" items={providers} value={featured.providers} onChange={(v) => setFeatured((f) => ({ ...f, providers: v }))} />
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <Panel>
          <PanelHeader title="Categories" description="Top-level filter in the app. Categories used by courses can't be removed." />
          <div className="px-5 py-4">
            <TagInput value={categories} onChange={setCategories} placeholder="Add a category" />
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
              {categories.map((c) => (
                <li key={c}>
                  {c} <span className="num">· {usage[c] ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Tech stacks" description="Suggestions for listings and the tech-stack filter." />
          <div className="px-5 py-4">
            <TagInput value={techStacks} onChange={setTechStacks} placeholder="Add a technology" />
          </div>
        </Panel>
        <PhonePreview featured={featured} courses={courses} institutes={institutes} providers={providers} />
      </div>

      <div
        className={cn(
          "fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-[var(--radius-overlay)] border border-line bg-raised px-4 py-2.5 shadow-[var(--shadow-overlay)] transition-[opacity,transform] duration-200",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
        aria-hidden={!dirty}
      >
        <span className="text-[13px] text-ink-2">Unsaved changes</span>
        <Button variant="ghost" size="sm" onClick={() => { setCategories(c0); setTechStacks(t0); setFeatured(f0); }}>Discard</Button>
        <Button variant="primary" size="sm" loading={pending === "save"} onClick={() => run("save", () => saveTaxonomy({ categories, techStacks, featured }))}>
          Publish to app
        </Button>
      </div>
    </div>
  );
}

function FeaturedPicker({ title, items, value, onChange }: { title: string; items: Item[]; value: string[]; onChange: (v: string[]) => void }) {
  const max = 12;
  return (
    <Panel>
      <PanelHeader title={title} description={<span className="num">{value.length} of {max} slots used</span>} />
      <ul className="max-h-[300px] divide-y divide-line overflow-y-auto">
        {items.map((i) => {
          const on = value.includes(i.id);
          const full = !on && value.length >= max;
          return (
            <li key={i.id}>
              <label className={cn("flex items-center gap-3 px-5 py-2", full ? "opacity-50" : "cursor-pointer hover:bg-sunken/50")}>
                <Checkbox checked={on} disabled={full} onChange={() => onChange(on ? value.filter((x) => x !== i.id) : [...value, i.id])} />
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{i.label}</span>
                <span className="text-[12px] capitalize text-ink-3">{i.sub}</span>
                {on ? <Star className="size-3.5 fill-accent text-accent" strokeWidth={1.5} aria-hidden /> : null}
              </label>
            </li>
          );
        })}
        {items.length === 0 ? <li className="px-5 py-4 text-[13px] text-ink-2">Publish some listings first; only published ones can be featured.</li> : null}
      </ul>
    </Panel>
  );
}

function PhonePreview({ featured, courses, institutes, providers }: { featured: Featured; courses: Item[]; institutes: Item[]; providers: Item[] }) {
  const pick = (ids: string[], from: Item[]) => ids.map((id) => from.find((x) => x.id === id)).filter(Boolean) as Item[];
  const rows: Array<[string, Item[]]> = [
    ["Featured courses", pick(featured.courses, courses)],
    ["Top institutes", pick(featured.institutes, institutes)],
    ["Learn from experts", pick(featured.providers, providers)],
  ];
  return (
    <Panel>
      <PanelHeader title="Home preview" description="Approximate layout of the app's home feed." />
      <div className="flex justify-center px-5 py-6">
        <div className="w-[260px] rounded-[28px] border border-line-strong bg-paper p-3 shadow-[var(--shadow-overlay)]">
          <div className="mx-auto mb-3 h-1 w-14 rounded-full bg-line-strong" />
          <div className="mb-3 h-8 rounded-[10px] border border-line bg-surface px-3 text-[11px] leading-8 text-ink-3">Search courses, trainers…</div>
          {rows.map(([title, list]) => (
            <div key={title} className="mb-3">
              <p className="mb-1.5 text-[11px] font-semibold text-ink">{title}</p>
              <div className="flex gap-2 overflow-hidden">
                {list.length ? (
                  list.slice(0, 3).map((i) => (
                    <div key={i.id} className="w-[92px] shrink-0 rounded-[8px] border border-line bg-surface p-1.5">
                      <div className="mb-1 h-10 rounded-[5px] bg-sunken" />
                      <p className="line-clamp-2 text-[9.5px] leading-tight text-ink">{i.label}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-ink-3">Nothing featured; this row is hidden in the app.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
