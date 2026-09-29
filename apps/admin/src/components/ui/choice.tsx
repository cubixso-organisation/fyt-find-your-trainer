"use client";

import * as React from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "./primitives";

/** Multi-select as toggle chips, for small fixed vocabularies. */
export function ChipSelect({
  options,
  value,
  onChange,
  id,
  invalid,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  id?: string;
  invalid?: boolean;
}) {
  return (
    <div id={id} role="group" className={cn("flex flex-wrap gap-1.5", invalid && "rounded-[var(--radius-control)] outline outline-1 outline-bad/60 outline-offset-4")}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-[5px] border px-2 text-[12.5px] transition-colors duration-150",
              on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
            )}
          >
            {on ? <Check className="size-3" strokeWidth={2.25} aria-hidden /> : null}
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** Free-text tags with suggestions. Enter or comma adds a tag. */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Type and press Enter",
  id,
  invalid,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  id?: string;
  invalid?: boolean;
}) {
  const [draft, setDraft] = React.useState("");
  const add = (t: string) => {
    const v = t.trim();
    if (!v || value.some((x) => x.toLowerCase() === v.toLowerCase())) return setDraft("");
    onChange([...value, v]);
    setDraft("");
  };
  const open = suggestions.filter((s) => !value.includes(s) && (!draft || s.toLowerCase().includes(draft.toLowerCase()))).slice(0, 8);
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-surface px-2 py-1.5 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/25",
          invalid && "border-bad",
        )}
      >
        {value.map((t) => (
          <span key={t} className="inline-flex h-6 items-center gap-1 rounded-[4px] bg-sunken pl-2 pr-1 text-[12.5px] text-ink">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="grid size-4 place-items-center rounded text-ink-3 hover:text-ink">
              <X className="size-3" strokeWidth={2} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="h-6 min-w-[120px] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
        />
      </div>
      {open.length ? (
        <div className="flex flex-wrap gap-1.5">
          {open.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex h-6 items-center gap-1 rounded-[4px] border border-dashed border-line-strong px-1.5 text-[12px] text-ink-2 hover:border-ink hover:text-ink"
            >
              <Plus className="size-3" strokeWidth={2} aria-hidden />
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Segmented control for 2-4 mutually exclusive options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[var(--radius-control)] border border-line bg-sunken p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded-[5px] px-3 text-[13px] transition-colors duration-150",
            value === o.value ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--line)]" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ToggleRow({ label, body, checked, onChange, disabled }: { label: string; body: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <p className="text-[13.5px] font-medium text-ink">{label}</p>
        <p className="text-[12.5px] text-ink-2">{body}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}
