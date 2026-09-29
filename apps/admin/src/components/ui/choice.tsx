"use client";

/**
 * Choice controls: ChipSelect, TagInput, Segmented, ToggleRow.
 *
 * Segmented follows the structure of "Segmented Control" by ddoemonn on
 * 21st.dev (https://21st.dev/@ddoemonn/components/segmented-control): a
 * radiogroup with a sliding thumb and arrow-key navigation. The source code
 * was not retrieved (21st.dev daily retrieval quota exhausted) and its licence
 * was not verified; this is an original implementation of the WAI-ARIA
 * radiogroup pattern (roving tabindex, arrows / Home / End move and select)
 * in the console's tokens. The thumb moves with transform only.
 */

import * as React from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "./primitives";

const motion = "duration-150 ease-[var(--ease-out-quart)]";
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
    <div
      id={id}
      role="group"
      className={cn("flex flex-wrap gap-1.5", invalid && "rounded-[var(--radius-control)] p-1 ring-1 ring-inset ring-bad/60")}
    >
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cn(
              "inline-flex h-7 select-none items-center gap-1 rounded-[5px] px-2 text-[12.5px] ring-1 ring-inset",
              "transition-[background-color,color,box-shadow,transform] active:scale-[0.97]",
              motion,
              focusRing,
              on ? "bg-ink text-paper ring-ink" : "bg-surface text-ink-2 ring-line hover:text-ink hover:ring-line-strong",
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
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-[var(--radius-control)] border bg-surface px-2 py-1.5",
          "shadow-[inset_0_1px_0_oklch(var(--shadow-ink)/0.03)] transition-[border-color,box-shadow]",
          motion,
          invalid
            ? "border-bad focus-within:ring-3 focus-within:ring-bad/25"
            : "border-line hover:border-line-strong focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/25 focus-within:hover:border-accent",
        )}
      >
        {value.map((t) => (
          <span key={t} className="inline-flex h-6 items-center gap-1 rounded-[4px] bg-sunken pl-2 pr-1 text-[12.5px] text-ink ring-1 ring-inset ring-line-strong/50">
            {t}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              onClick={() => onChange(value.filter((x) => x !== t))}
              className={cn("grid size-4 place-items-center rounded-[3px] text-ink-3 transition-[color,background-color] hover:bg-surface hover:text-ink", motion, "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent")}
            >
              <X className="size-3" strokeWidth={2} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          aria-invalid={invalid || undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "" : placeholder}
          // The wrapper draws the focus ring for the whole field.
          className="h-6 min-w-[120px] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none"
        />
      </div>
      {open.length ? (
        <div className="flex flex-wrap gap-1.5" aria-label="Suggestions">
          {open.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-[4px] border border-dashed border-line-strong px-1.5 text-[12px] text-ink-2",
                "transition-[border-color,color,transform] hover:border-ink hover:text-ink active:scale-[0.97]",
                motion,
                focusRing,
              )}
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
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const index = options.findIndex((o) => o.value === value);

  const move = (to: number) => {
    const n = options.length;
    const i = ((to % n) + n) % n;
    onChange(options[i].value);
    refs.current[i]?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    move(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative inline-grid rounded-[var(--radius-control)] bg-sunken p-0.5 ring-1 ring-inset ring-line"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {/* Sliding thumb: one element moved by transform, so the change reads as motion, not a repaint. */}
      {index >= 0 ? (
        <span
          aria-hidden
          className={cn("pointer-events-none absolute inset-y-0.5 left-0.5 rounded-[5px] bg-surface ring-1 ring-inset ring-line-strong/60 transition-transform", "duration-200 ease-[var(--ease-out-quart)]")}
          style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
        />
      ) : null}
      {options.map((o, i) => {
        const on = i === index;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (index < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative h-7 whitespace-nowrap rounded-[5px] px-3 text-[13px] transition-colors",
              motion,
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
              on ? "font-medium text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ToggleRow({ label, body, checked, onChange, disabled }: { label: string; body: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = React.useId();
  return (
    <div className={cn("flex items-center justify-between gap-4 px-4 py-3", disabled && "opacity-70")}>
      <div className="min-w-0">
        {/* A label can target the switch button, so the text is a click target too. */}
        <label htmlFor={id} className={cn("text-[13.5px] font-medium text-ink", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
          {label}
        </label>
        <p className="text-[12.5px] text-ink-2">{body}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}
