import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, fmtNumber } from "@/lib/utils";

export interface Kpi {
  label: string;
  value: string;
  /** Change vs previous period; undefined = no comparison available. */
  delta?: { text: string; direction: "up" | "down" | "flat"; good: boolean };
  hint: string;
}

export function KpiBand({ items }: { items: Kpi[] }) {
  return (
    <section
      aria-label="Key figures"
      className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface lg:grid-cols-4"
    >
      {items.map((k, i) => (
        <div
          key={k.label}
          className={cn(
            "flex min-w-0 flex-col gap-1 px-4 py-4 sm:px-5",
            i % 2 === 1 && "border-l border-line",
            i >= 2 && "border-t border-line lg:border-t-0",
            i === 2 && "lg:border-l",
          )}
        >
          <p className="text-[12.5px] text-ink-2">{k.label}</p>
          <p className="num truncate text-[26px] font-semibold leading-tight tracking-tight text-ink" title={k.value}>{k.value}</p>
          {/* Wraps as a unit: the delta never splits across lines, the hint
              drops below it when the cell is narrow. */}
          <div className="flex min-h-5 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] leading-snug">
            {k.delta ? (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap font-medium",
                  k.delta.direction === "flat" ? "text-ink-3" : k.delta.good ? "text-ok" : "text-bad",
                )}
              >
                {k.delta.direction === "up" ? (
                  <ArrowUpRight className="size-3.5" strokeWidth={2} aria-hidden />
                ) : k.delta.direction === "down" ? (
                  <ArrowDownRight className="size-3.5" strokeWidth={2} aria-hidden />
                ) : (
                  <Minus className="size-3.5" strokeWidth={2} aria-hidden />
                )}
                <span className="num">{k.delta.text}</span>
              </span>
            ) : null}
            <span className="text-ink-3">{k.hint}</span>
          </div>
        </div>
      ))}
    </section>
  );
}

export function countDelta(cur: number, prev: number, higherIsGood = true): Kpi["delta"] {
  if (prev === 0 && cur === 0) return { text: "0", direction: "flat", good: true };
  const diff = cur - prev;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const text = prev === 0 ? `+${fmtNumber(diff)}` : `${diff > 0 ? "+" : ""}${Math.round((diff / prev) * 100)}%`;
  return { text, direction, good: direction === "flat" || (direction === "up") === higherIsGood };
}

export function rateDelta(cur: number, prev: number): Kpi["delta"] {
  const pp = (cur - prev) * 100;
  const direction = Math.abs(pp) < 0.5 ? "flat" : pp > 0 ? "up" : "down";
  return { text: `${pp > 0 ? "+" : ""}${pp.toFixed(1)} pts`, direction, good: direction !== "down" };
}
