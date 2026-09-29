"use client";

/**
 * Small chart kit following the dataviz method:
 * - fixed categorical order (--viz-1, --viz-2), validated light + dark
 * - thin marks, 4px rounded data-ends on the value end, 2px surface gaps
 * - hover layer with tooltip; hit targets are the full column
 * - legend for >= 2 series, text in ink tokens, a table view for every chart
 */
import * as React from "react";
import { Table2, BarChart3 } from "lucide-react";
import { cn, fmtDate, fmtNumber } from "@/lib/utils";

export interface Series {
  key: string;
  label: string;
  color: string; // css var
}

function niceMax(v: number) {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export function ViewToggle({ table, onChange }: { table: boolean; onChange: (t: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!table)}
      className="inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2 text-[12px] text-ink-2 hover:bg-sunken hover:text-ink"
      aria-pressed={table}
    >
      {table ? <BarChart3 className="size-3.5" strokeWidth={1.75} /> : <Table2 className="size-3.5" strokeWidth={1.75} />}
      {table ? "Chart" : "Table"}
    </button>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-4 text-[12px] text-ink-2">
      {series.map((s) => (
        <li key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px]" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** Stacked daily columns. One y-axis, baseline at zero. */
export function StackedColumns<T extends { day: number } & Record<string, number>>({
  data,
  series,
  height = 220,
  label,
  table,
}: {
  data: T[];
  series: Series[];
  height?: number;
  label: string;
  table: boolean;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const totals = data.map((d) => series.reduce((s, x) => s + (d[x.key] ?? 0), 0));
  const max = niceMax(Math.max(1, ...totals));
  const ticks = [0, max / 2, max];
  const W = 100; // percent-based x
  const colW = W / data.length;

  if (table)
    return (
      <div className="max-h-[260px] overflow-y-auto">
        <table className="w-full text-[12.5px]">
          <caption className="sr-only">{label}</caption>
          <thead className="sticky top-0 bg-surface text-left text-ink-2">
            <tr>
              <th scope="col" className="py-1.5 font-medium">Day</th>
              {series.map((s) => <th key={s.key} scope="col" className="py-1.5 text-right font-medium">{s.label}</th>)}
              <th scope="col" className="py-1.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.day} className="border-t border-line">
                <td className="num py-1.5 text-ink">{fmtDate(d.day, { day: "numeric", month: "short" })}</td>
                {series.map((s) => <td key={s.key} className="num py-1.5 text-right text-ink">{d[s.key]}</td>)}
                <td className="num py-1.5 text-right font-medium text-ink">{totals[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="relative" role="img" aria-label={`${label}. Use the Table view for exact values.`}>
      <div className="relative ml-8" style={{ height }}>
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-line/80" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="num absolute -left-8 -top-2 w-6 text-right text-[10.5px] text-ink-3">{fmtNumber(t)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end" onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => {
            let acc = 0;
            return (
              <div
                key={d.day}
                className="relative flex h-full flex-col justify-end"
                style={{ width: `${colW}%` }}
                onMouseEnter={() => setHover(i)}
              >
                {hover === i ? <div className="absolute inset-y-0 inset-x-[1px] rounded-[3px] bg-sunken/80" aria-hidden /> : null}
                <div className="relative mx-auto flex w-[62%] max-w-[18px] flex-col-reverse gap-[2px]">
                  {series.map((s, si) => {
                    const v = d[s.key] ?? 0;
                    if (!v) return null;
                    acc += v;
                    const isTop = acc === totals[i];
                    return (
                      <div
                        key={s.key}
                        style={{ height: Math.max(2, (v / max) * height - 2), background: s.color }}
                        className={cn(isTop ? "rounded-t-[4px]" : "", si === 0 && "rounded-b-[1px]")}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {hover !== null ? (
          <div
            className="pointer-events-none absolute z-10 w-44 rounded-[8px] border border-line bg-raised px-3 py-2 text-[12px] shadow-[var(--shadow-overlay)]"
            style={{
              left: `clamp(0px, calc(${(hover + 0.5) * colW}% - 88px), calc(100% - 176px))`,
              bottom: `${Math.min(92, (totals[hover] / max) * 100 + 6)}%`,
            }}
          >
            <p className="num mb-1 font-medium text-ink">{fmtDate(data[hover].day, { weekday: "short", day: "numeric", month: "short" })}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3 text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px]" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="num text-ink">{data[hover][s.key]}</span>
              </p>
            ))}
            <p className="mt-1 flex justify-between border-t border-line pt-1 text-ink-2">
              Total <span className="num font-medium text-ink">{totals[hover]}</span>
            </p>
          </div>
        ) : null}
      </div>
      <div className="ml-8 mt-2 flex justify-between text-[10.5px] text-ink-3">
        <span className="num">{fmtDate(data[0].day)}</span>
        <span className="num">{fmtDate(data[Math.floor(data.length / 2)].day)}</span>
        <span className="num">{fmtDate(data[data.length - 1].day)}</span>
      </div>
    </div>
  );
}

/** Horizontal bars with direct labels. Magnitude in one hue; identity by text. */
export function BarList({
  items,
  color = "var(--viz-1)",
  format = fmtNumber,
  secondary,
}: {
  items: Array<{ label: string; value: number; sub?: string }>;
  color?: string;
  format?: (n: number) => string;
  secondary?: (i: { label: string; value: number; sub?: string }, idx: number) => React.ReactNode;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((i, idx) => (
        <li key={i.label} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-ink" title={i.sub ? `${i.label} · ${i.sub}` : i.label}>
              {i.label}
              {i.sub ? <span className="ml-1.5 text-[12px] text-ink-3">{i.sub}</span> : null}
            </span>
            <span className="num shrink-0 text-ink">
              {format(i.value)}
              {secondary ? <span className="ml-2 text-[12px] text-ink-3">{secondary(i, idx)}</span> : null}
            </span>
          </div>
          <div className="h-2 w-full rounded-[2px] bg-sunken" title={`${i.label}: ${format(i.value)}`}>
            <div
              className="h-full rounded-r-[4px] transition-[width] duration-300 ease-[var(--ease-out-quart)]"
              style={{ width: `${(i.value / max) * 100}%`, background: color, minWidth: i.value ? 3 : 0 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
