"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button, Checkbox, EmptyState, Input, Select } from "./primitives";
import { cn, fmtNumber } from "@/lib/utils";
import { solarIcon } from "@/components/icons/solar";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sortValue?: (row: T) => number | string;
  className?: string;
  headerClassName?: string;
  /** Hide below this breakpoint */
  hideBelow?: "sm" | "md" | "lg" | "xl";
}

export interface Filter<T> {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  test: (row: T, value: string) => boolean;
}

const hideClass = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" };

/**
 * Body scroll is capped rather than left to the page, so the header, the
 * toolbar and the pagination stay on screen while an operator works a long
 * queue. Short tables never reach the cap, so they look no different.
 */
const BODY_MAX_H = "max-h-[min(70svh,860px)]";

/** One applied search term or filter value, removable on its own. */
function FilterChip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-[5px] bg-sunken pl-2 pr-1 text-[12.5px] ring-1 ring-inset ring-line-strong/60">
      <span className="text-ink-3">{label}</span>
      <span className="max-w-[18ch] truncate font-medium text-ink">{value}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${label} ${value}`}
        className="grid size-5 shrink-0 place-items-center rounded-[4px] text-ink-3 transition-[color,background-color,transform] duration-150 ease-[var(--ease-out-quart)] hover:bg-line/70 hover:text-ink active:scale-90"
      >
        <X className="size-3" strokeWidth={2.25} aria-hidden />
      </button>
    </span>
  );
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  search,
  searchPlaceholder = "Search",
  filters = [],
  initialFilters = {},
  initialSort,
  onRowClick,
  selectable,
  bulkActions,
  toolbar,
  empty,
  pageSize = 25,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  search?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: Filter<T>[];
  initialFilters?: Record<string, string>;
  initialSort?: { key: string; dir: "asc" | "desc" };
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  toolbar?: React.ReactNode;
  empty: { icon: React.ElementType; title: string; body: React.ReactNode; action?: React.ReactNode };
  pageSize?: number;
  caption: string;
}) {
  const [q, setQRaw] = React.useState("");
  const [f, setFRaw] = React.useState<Record<string, string>>(initialFilters);
  const [sort, setSortRaw] = React.useState(initialSort);
  const [page, setPage] = React.useState(0);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [scrolled, setScrolled] = React.useState(false);
  // Anchor for shift-click range selection, in visible-row order.
  const anchor = React.useRef<number | null>(null);

  // Any change to search, filters or sort starts from the first page.
  const setQ = (v: string) => {
    setQRaw(v);
    setPage(0);
  };
  const setF = (v: React.SetStateAction<Record<string, string>>) => {
    setFRaw(v);
    setPage(0);
  };
  const setSort = (v: React.SetStateAction<typeof initialSort>) => {
    setSortRaw(v);
    setPage(0);
  };
  const clearAll = () => {
    setF({});
    setQ("");
  };
  // Selection only ever contains rows that still exist.
  const selected = React.useMemo(() => {
    const keys = new Set(rows.map(rowKey));
    return new Set([...picked].filter((k) => keys.has(k)));
  }, [picked, rows, rowKey]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (needle && search && !search(r).toLowerCase().includes(needle)) return false;
      for (const flt of filters) {
        const v = f[flt.key];
        if (v && v !== "all" && !flt.test(r, v)) return false;
      }
      return true;
    });
    const col = sort && columns.find((c) => c.key === sort.key);
    if (col?.sortValue) {
      const sv = col.sortValue;
      out = [...out].sort((a, b) => {
        const x = sv(a);
        const y = sv(b);
        const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return sort!.dir === "asc" ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, q, f, sort, columns, filters, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const pageRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const appliedFilters = filters
    .map((flt) => ({ flt, value: f[flt.key] }))
    .filter((x): x is { flt: Filter<T>; value: string } => !!x.value && x.value !== "all");
  const activeFilters = appliedFilters.length + (q ? 1 : 0);
  const selectedRows = rows.filter((r) => selected.has(rowKey(r)));
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(rowKey(r)));
  const someOnPage = !allOnPage && pageRows.some((r) => selected.has(rowKey(r)));

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : undefined) : { key, dir: "asc" }));

  /** Plain click toggles one row; shift extends from the last row you touched. */
  const pickRow = (index: number, key: string, shift: boolean) => {
    const isSel = selected.has(key);
    setPicked((prev) => {
      const next = new Set(prev);
      if (shift && anchor.current !== null) {
        const [lo, hi] = anchor.current < index ? [anchor.current, index] : [index, anchor.current];
        // A range takes the state the anchor row is about to have, so dragging
        // back over a run clears it instead of stalling.
        const turnOn = !isSel;
        for (let i = lo; i <= hi; i++) {
          const k = rowKey(pageRows[i]);
          if (turnOn) next.add(k);
          else next.delete(k);
        }
        return next;
      }
      if (isSel) next.delete(key);
      else next.add(key);
      return next;
    });
    anchor.current = index;
  };

  const togglePage = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const r of pageRows) {
        if (allOnPage) next.delete(rowKey(r));
        else next.add(rowKey(r));
      }
      return next;
    });

  const hasRows = filtered.length > 0;

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center">
        {search ? (
          <div className="group/search relative w-full lg:max-w-[300px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3 transition-colors duration-150 group-focus-within/search:text-ink-2"
              strokeWidth={1.5}
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className={cn("pl-9", q && "pr-9")}
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-[4px] text-ink-3 transition-[color,background-color,transform] duration-150 ease-[var(--ease-out-quart)] hover:bg-sunken hover:text-ink active:scale-90"
              >
                <X className="size-3.5" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
        {filters.length ? (
          <div className="flex flex-wrap items-center gap-2">
            {filters.map((flt) => {
              const on = !!f[flt.key] && f[flt.key] !== "all";
              return (
                <Select
                  key={flt.key}
                  aria-label={flt.label}
                  value={f[flt.key] ?? "all"}
                  onChange={(e) => setF((prev) => ({ ...prev, [flt.key]: e.target.value }))}
                  className={cn(
                    "w-auto min-w-[140px]",
                    on && "border-line-strong bg-sunken font-medium text-ink",
                  )}
                >
                  <option value="all">{flt.label}: All</option>
                  {flt.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {flt.label}: {o.label}
                    </option>
                  ))}
                </Select>
              );
            })}
          </div>
        ) : null}
        <div className="flex items-center gap-3 lg:ml-auto">
          <span className="num whitespace-nowrap text-[12.5px] text-ink-3" aria-live="polite">
            {activeFilters ? (
              <>
                <span className="font-medium text-ink-2">{fmtNumber(filtered.length)}</span> of {fmtNumber(rows.length)}
              </>
            ) : (
              <>{fmtNumber(rows.length)} total</>
            )}
          </span>
          {toolbar}
        </div>
      </div>

      {/* What is applied, spelled out and removable one at a time. */}
      {activeFilters ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-sunken/40 px-4 py-2">
          {q ? <FilterChip label="Search" value={q} onClear={() => setQ("")} /> : null}
          {appliedFilters.map(({ flt, value }) => (
            <FilterChip
              key={flt.key}
              label={flt.label}
              value={flt.options.find((o) => o.value === value)?.label ?? value}
              onClear={() => setF((prev) => ({ ...prev, [flt.key]: "all" }))}
            />
          ))}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[12.5px]" onClick={clearAll}>
            Clear all
          </Button>
        </div>
      ) : null}

      {!hasRows ? (
        rows.length === 0 ? (
          <EmptyState icon={empty.icon} title={empty.title} body={empty.body} action={empty.action} />
        ) : (
          <EmptyState
            icon={solarIcon("magnifer-bold-duotone")}
            title="Nothing matches"
            body="No rows match your search and filters. Clear them to see everything."
            action={
              <Button size="sm" onClick={clearAll}>
                Clear filters
              </Button>
            }
          />
        )
      ) : (
        <div
          className={cn("overflow-auto overscroll-contain [scrollbar-width:thin]", BODY_MAX_H)}
          onScroll={(e) => {
            const next = e.currentTarget.scrollTop > 0;
            if (next !== scrolled) setScrolled(next);
          }}
        >
          <table className="w-full border-collapse text-left text-[13.5px]">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 z-10">
              <tr>
                {selectable ? (
                  <th
                    scope="col"
                    className={cn(
                      "w-10 border-b border-line bg-sunken py-2.5 pl-4 transition-shadow duration-150",
                      scrolled && "shadow-[var(--shadow-pinned)]",
                    )}
                  >
                    <Checkbox
                      aria-label={allOnPage ? "Clear selection on this page" : "Select all on this page"}
                      checked={allOnPage}
                      indeterminate={someOnPage}
                      onChange={togglePage}
                    />
                  </th>
                ) : null}
                {columns.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={c.sortValue ? (active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none") : undefined}
                      className={cn(
                        "whitespace-nowrap border-b border-line bg-sunken px-4 py-2.5 text-[12px] font-medium text-ink-2",
                        "transition-shadow duration-150",
                        scrolled && "shadow-[var(--shadow-pinned)]",
                        c.hideBelow && hideClass[c.hideBelow],
                        c.headerClassName,
                      )}
                    >
                      {c.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className={cn(
                            "group/sort -mx-1.5 inline-flex max-w-full items-center gap-1 rounded-[4px] px-1.5 py-0.5",
                            "transition-[color,transform] duration-150 ease-[var(--ease-out-quart)] active:scale-[0.97]",
                            active ? "font-semibold text-ink" : "hover:text-ink",
                          )}
                        >
                          {c.header}
                          {/* Ghosted under the pointer so a sortable column says
                              so, solid once it is the sort, and asc/desc is one
                              glyph rotating rather than two swapping. */}
                          <span
                            aria-hidden
                            className={cn(
                              "grid size-3 shrink-0 place-items-center",
                              "transition-[opacity,scale,rotate] duration-150 ease-[var(--ease-out-quart)]",
                              active
                                ? "scale-100 opacity-100"
                                : "scale-75 opacity-0 group-hover/sort:scale-100 group-hover/sort:opacity-45 group-focus-visible/sort:scale-100 group-focus-visible/sort:opacity-45",
                              active && sort!.dir === "asc" && "rotate-180",
                            )}
                          >
                            <ChevronDown className="size-3" strokeWidth={2.5} />
                          </span>
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => {
                const k = rowKey(r);
                const isSel = selected.has(k);
                return (
                  <tr
                    key={k}
                    aria-selected={selectable ? isSel : undefined}
                    data-selected={isSel || undefined}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    className={cn(
                      "group/row border-b border-line last:border-b-0",
                      onRowClick && "cursor-pointer",
                      isSel && "bg-accent-soft/45",
                    )}
                  >
                    {selectable ? (
                      <td
                        className={cn(
                          "py-2.5 pl-4 transition-colors duration-100 ease-[var(--ease-out-quart)]",
                          !isSel && "group-hover/row:bg-sunken/70",
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          aria-label="Select row"
                          checked={isSel}
                          onChange={() => {}}
                          onClick={(e) => pickRow(i, k, e.shiftKey)}
                        />
                      </td>
                    ) : null}
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-4 py-2.5 align-middle text-ink transition-colors duration-100 ease-[var(--ease-out-quart)]",
                          !isSel && "group-hover/row:bg-sunken/70",
                          c.hideBelow && hideClass[c.hideBelow],
                          c.className,
                        )}
                      >
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && hasRows ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[12.5px] text-ink-2"
        >
          <span className="num">
            <span className="font-medium text-ink">
              {safePage * pageSize + 1}–{Math.min(filtered.length, (safePage + 1) * pageSize)}
            </span>{" "}
            <span className="text-ink-3">of {fmtNumber(filtered.length)}</span>
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="group/page size-8"
              aria-label="Previous page"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              <ChevronLeft
                className={cn(
                  "size-4 transition-transform duration-150 ease-[var(--ease-out-quart)]",
                  safePage > 0 && "group-hover/page:-translate-x-px",
                )}
                strokeWidth={1.75}
              />
            </Button>
            <span className="num px-2 text-ink-3">
              <span className="font-medium text-ink-2">{safePage + 1}</span> / {pages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="group/page size-8"
              aria-label="Next page"
              disabled={safePage >= pages - 1}
              onClick={() => setPage(safePage + 1)}
            >
              <ChevronRight
                className={cn(
                  "size-4 transition-transform duration-150 ease-[var(--ease-out-quart)]",
                  safePage < pages - 1 && "group-hover/page:translate-x-px",
                )}
                strokeWidth={1.75}
              />
            </Button>
          </div>
        </nav>
      ) : null}

      {/* The bulk bar floats over the rows it acts on rather than pushing them
          down, so nothing an operator is reading moves when they tick a box. */}
      {selectable && selectedRows.length > 0 ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4",
            // Clears the pagination row rather than covering it.
            pages > 1 ? "bottom-[60px]" : "bottom-5",
          )}
        >
          <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-line bg-raised py-1.5 pl-4 pr-1.5 shadow-[var(--shadow-float)] animate-pop-in">
            <span className="whitespace-nowrap text-[13px] font-medium text-ink">
              <span className="num">{selectedRows.length}</span> selected
            </span>
            <span className="h-4 w-px shrink-0 bg-line" aria-hidden />
            <div className="flex items-center gap-1.5">{bulkActions?.(selectedRows, () => setPicked(new Set()))}</div>
            <button
              type="button"
              onClick={() => setPicked(new Set())}
              aria-label="Clear selection"
              className="grid size-7 shrink-0 place-items-center rounded-full text-ink-3 transition-[color,background-color,transform] duration-150 ease-[var(--ease-out-quart)] hover:bg-sunken hover:text-ink active:scale-90"
            >
              <X className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface" aria-busy>
      <div className="flex gap-2 border-b border-line px-4 py-3">
        <div className="h-9 w-full max-w-[300px] rounded-[var(--radius-control)] bg-sunken" />
        <div className="h-9 w-[140px] rounded-[var(--radius-control)] bg-sunken" />
      </div>
      <div className="flex gap-4 border-b border-line bg-sunken/70 px-4 py-3">
        {Array.from({ length: cols }, (_, j) => (
          <div key={j} className={cn("h-3 rounded bg-line/70", j === 0 ? "w-[22%]" : "w-[12%]")} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="grid gap-4 border-b border-line px-4 py-3.5 last:border-b-0"
          style={{ gridTemplateColumns: `2fr repeat(${cols - 1}, 1fr)` }}
        >
          {Array.from({ length: cols }, (_, j) => (
            <div
              key={j}
              className="h-4 rounded bg-[linear-gradient(90deg,var(--sunken),var(--line),var(--sunken))] bg-[length:200%_100%] animate-shimmer"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
