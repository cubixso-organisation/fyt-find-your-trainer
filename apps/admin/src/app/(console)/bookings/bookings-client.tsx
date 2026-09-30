"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheck2,
  CalendarDays,
  Copy,
  Download,
  List,
  MapPin,
  RefreshCw,
  Video,
} from "lucide-react";
import type { BookingRow } from "@/lib/data/queries";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button, Field, Input } from "@/components/ui/primitives";
import { BookingStatusPill, BOOKING_STATUS } from "@/components/ui/status";
import { ConfirmDialog, Drawer } from "@/components/ui/overlays";
import { cn, fmtDate, fmtDateTime, fmtTime, relTime } from "@/lib/utils";
import { cancelBooking, confirmBooking, markOutcome, rescheduleBooking, retryMeetLink, type ActionResult } from "./actions";
import { solarIcon } from "@/components/icons/solar";
import { BookingCalendar } from "./booking-calendar";
import { downloadBookingsCsv, TARGET_LABEL } from "./bookings-csv";

type View = "attention" | "upcoming" | "past" | "all" | "calendar";

export function BookingsClient({ rows, now, initialView }: { rows: BookingRow[]; now: number; initialView: View }) {
  const [view, setView] = React.useState<View>(initialView);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = rows.find((r) => r.id === openId) ?? null;

  const sets: Record<Exclude<View, "calendar">, BookingRow[]> = React.useMemo(
    () => ({
      attention: rows.filter((r) => r.start > now - 30 * 60_000 && (r.status === "requested" || r.status === "meet_failed")),
      upcoming: rows.filter((r) => r.start >= now && r.status !== "cancelled"),
      past: rows.filter((r) => r.start < now).sort((a, b) => b.start - a.start),
      all: [...rows].sort((a, b) => b.createdAt - a.createdAt),
    }),
    [rows, now],
  );

  const columns: Column<BookingRow>[] = [
    {
      key: "when",
      header: "When (IST)",
      sortValue: (r) => r.start,
      cell: (r) => (
        <div className="whitespace-nowrap">
          <p className="num text-[13px] text-ink">{fmtDate(r.start, { weekday: "short", day: "numeric", month: "short" })}</p>
          <p className="num text-[12px] text-ink-3">{fmtTime(r.start)}</p>
        </div>
      ),
    },
    {
      key: "learner",
      header: "Learner",
      sortValue: (r) => r.learnerName,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.learnerName}</p>
          <p className="text-[12px] text-ink-3">{r.learnerSegment === "corporate" ? "Corporate" : "Student"}</p>
        </div>
      ),
    },
    {
      key: "with",
      header: "Booked for",
      sortValue: (r) => r.targetName,
      cell: (r) => (
        <div className="min-w-0 max-w-[280px]">
          <p className="truncate">{r.targetName}</p>
          <p className="text-[12px] text-ink-3">{TARGET_LABEL[r.targetType]}</p>
        </div>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      hideBelow: "xl",
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          {r.mode === "online" ? <Video className="size-3.5" strokeWidth={1.75} /> : <MapPin className="size-3.5" strokeWidth={1.75} />}
          {r.mode === "online" ? "Online" : "In person"}
        </span>
      ),
    },
    { key: "status", header: "Status", sortValue: (r) => r.status, cell: (r) => <BookingStatusPill status={r.status} /> },
    { key: "ref", header: "Ref", hideBelow: "xl", cell: (r) => <span className="num whitespace-nowrap text-[12.5px] text-ink-2">{r.ref}</span> },
  ];

  const tabs: Array<[View, string, number | null]> = [
    ["attention", "Needs action", sets.attention.length],
    ["upcoming", "Upcoming", sets.upcoming.length],
    ["past", "Past", null],
    ["all", "All", null],
    ["calendar", "Calendar", null],
  ];

  return (
    <>
      <div role="tablist" aria-label="Booking views" className="mb-4 flex flex-wrap items-center gap-1 border-b border-line">
        {tabs.map(([k, label, count]) => (
          <button
            key={k}
            role="tab"
            aria-selected={view === k}
            onClick={() => setView(k)}
            className={cn(
              "relative -mb-px inline-flex h-10 items-center gap-2 border-b-2 px-3 text-[13.5px] transition-colors",
              view === k ? "border-ink font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {k === "calendar" ? <CalendarDays className="size-4" strokeWidth={1.6} /> : k === "all" ? <List className="size-4" strokeWidth={1.6} /> : null}
            {label}
            {count ? (
              <span className={cn("num rounded-[4px] px-1.5 text-[11px] leading-5", k === "attention" ? "bg-accent text-accent-ink font-semibold" : "bg-sunken text-ink-2")}>
                {count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {view === "calendar" ? (
        <BookingCalendar rows={rows} now={now} onOpen={setOpenId} onExport={downloadBookingsCsv} />
      ) : (
        <DataTable
          key={view}
          caption="Bookings"
          rows={sets[view]}
          columns={columns}
          rowKey={(r) => r.id}
          onRowClick={(r) => setOpenId(r.id)}
          initialSort={view === "past" || view === "all" ? undefined : { key: "when", dir: "asc" }}
          search={(r) => `${r.ref} ${r.learnerName} ${r.learnerPhone} ${r.targetName}`}
          searchPlaceholder="Search ref, learner, phone, listing"
          filters={[
            {
              key: "type",
              label: "Type",
              options: Object.entries(TARGET_LABEL).map(([value, label]) => ({ value, label })),
              test: (r, v) => r.targetType === v,
            },
            {
              key: "status",
              label: "Status",
              options: Object.entries(BOOKING_STATUS).map(([value, s]) => ({ value, label: s.label })),
              test: (r, v) => r.status === v,
            },
            {
              key: "mode",
              label: "Mode",
              options: [
                { value: "online", label: "Online" },
                { value: "offline", label: "In person" },
              ],
              test: (r, v) => r.mode === v,
            },
          ]}
          toolbar={
            <Button
              size="sm"
              disabled={!sets[view].length}
              onClick={() => downloadBookingsCsv(sets[view])}
              title={`Exports all ${sets[view].length} bookings in this tab. Search and filters are not applied to the file.`}
            >
              <Download className="size-4" strokeWidth={1.6} aria-hidden /> Export CSV
            </Button>
          }
          empty={
            view === "attention"
              ? { icon: solarIcon("checklist-minimalistic-bold-duotone"), title: "Nothing needs action", body: "New requests and failed Meet links from the app land here first." }
              : { icon: solarIcon("inbox-line-bold-duotone"), title: "No bookings here yet", body: "Bookings made in the mobile app appear here within seconds." }
          }
        />
      )}

      <BookingDrawer booking={open} now={now} onClose={() => setOpenId(null)} />
    </>
  );
}

function useAction() {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<ActionResult>) => {
    setPending(key);
    const r = await fn();
    setPending(null);
    if (r.ok) {
      toast.success(r.message ?? "Saved");
      router.refresh();
    } else toast.error(r.error);
    return r.ok;
  };
  return { pending, run };
}

function toLocalInput(ms: number) {
  // datetime-local in IST
  const d = new Date(ms + 5.5 * 3_600_000);
  return d.toISOString().slice(0, 16);
}
function fromLocalInput(v: string) {
  return Date.parse(v + ":00Z") - 5.5 * 3_600_000;
}

function BookingDrawer({ booking: b, now, onClose }: { booking: BookingRow | null; now: number; onClose: () => void }) {
  const { pending, run } = useAction();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [when, setWhen] = React.useState(b ? toLocalInput(b.start) : "");
  const [shownKey, setShownKey] = React.useState(b ? `${b.id}:${b.start}` : "");
  const key = b ? `${b.id}:${b.start}` : "";
  if (key !== shownKey) {
    setShownKey(key);
    if (b) setWhen(toLocalInput(b.start));
  }

  const upcoming = b ? b.start > now : false;
  const canCancel = b && ["requested", "confirmed", "meet_failed"].includes(b.status);

  return (
    <Drawer
      open={!!b}
      onOpenChange={(o) => !o && onClose()}
      title={b ? <span className="flex items-center gap-2">Booking <span className="num text-ink-2">{b.ref}</span></span> : ""}
      description={b ? `${TARGET_LABEL[b.targetType]} · created ${relTime(b.createdAt, now)}` : undefined}
      footer={
        b ? (
          <>
            {canCancel ? (
              <Button variant="ghost" className="mr-auto text-bad hover:text-bad" onClick={() => setCancelOpen(true)}>
                Cancel booking
              </Button>
            ) : null}
            {b.status === "requested" ? (
              <Button variant="primary" loading={pending === "confirm"} onClick={() => run("confirm", () => confirmBooking(b.id))}>
                <CalendarCheck2 className="size-4" strokeWidth={1.75} /> Confirm
              </Button>
            ) : null}
            {b.status === "meet_failed" ? (
              <Button variant="primary" loading={pending === "retry"} onClick={() => run("retry", () => retryMeetLink(b.id))}>
                <RefreshCw className="size-4" strokeWidth={1.75} /> Retry Meet link
              </Button>
            ) : null}
            {b.status === "confirmed" && !upcoming ? (
              <>
                <Button loading={pending === "no_show"} onClick={() => run("no_show", () => markOutcome({ id: b.id, outcome: "no_show" }))}>
                  No-show
                </Button>
                <Button variant="primary" loading={pending === "completed"} onClick={() => run("completed", () => markOutcome({ id: b.id, outcome: "completed" }))}>
                  Mark attended
                </Button>
              </>
            ) : null}
          </>
        ) : null
      }
    >
      {b ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <BookingStatusPill status={b.status} />
            {b.status === "meet_failed" ? <span className="text-[13px] text-bad">The learner has no link yet.</span> : null}
          </div>

          <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 sm:grid-cols-[120px_minmax(0,1fr)] gap-y-3 text-[13.5px]">
            <dt className="text-ink-2">When</dt>
            <dd className="num text-ink">
              {fmtDateTime(b.start)} <span className="text-ink-3">({relTime(b.start, now)})</span>
            </dd>
            <dt className="text-ink-2">Learner</dt>
            <dd className="text-ink">
              {b.learnerName}
              <span className="num block text-[12.5px] text-ink-3">{b.learnerPhone}</span>
            </dd>
            <dt className="text-ink-2">Booked for</dt>
            <dd className="text-ink">{b.targetName}</dd>
            <dt className="text-ink-2">Mode</dt>
            <dd className="text-ink">{b.mode === "online" ? "Online (Google Meet)" : "In person"}</dd>
            {b.mode === "online" ? (
              <>
                <dt className="text-ink-2">Meet link</dt>
                <dd>
                  {b.meetLink ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <a href={b.meetLink} target="_blank" rel="noreferrer" title={b.meetLink} className="num min-w-0 truncate text-[13px] text-ink underline decoration-line-strong underline-offset-4">
                        {b.meetLink.replace("https://", "")}
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        aria-label="Copy Meet link"
                        onClick={() => {
                          void navigator.clipboard.writeText(b.meetLink!);
                          toast.success("Meet link copied");
                        }}
                      >
                        <Copy className="size-3.5" strokeWidth={1.75} />
                      </Button>
                    </span>
                  ) : (
                    <span className="text-ink-3">{b.status === "requested" ? "Created on confirmation" : "Not created"}</span>
                  )}
                </dd>
              </>
            ) : (
              <>
                <dt className="text-ink-2">Address</dt>
                <dd className="text-ink">{b.offlineAddress}</dd>
              </>
            )}
            {b.cancelledReason ? (
              <>
                <dt className="text-ink-2">Cancel reason</dt>
                <dd className="text-ink">{b.cancelledReason}</dd>
              </>
            ) : null}
          </dl>

          {upcoming && ["requested", "confirmed", "meet_failed"].includes(b.status) ? (
            <section className="rounded-[var(--radius-panel)] border border-line p-4">
              <h3 className="text-[13.5px] font-semibold text-ink">Reschedule</h3>
              <p className="mt-0.5 text-[12.5px] text-ink-2">Both the learner and the provider get the new time by push and email.</p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Field label="New time (IST)" htmlFor="resched" className="min-w-[12rem] flex-1">
                  <Input id="resched" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                </Field>
                <Button
                  loading={pending === "resched"}
                  disabled={!when || when === toLocalInput(b.start)}
                  onClick={() => run("resched", () => rescheduleBooking({ id: b.id, start: fromLocalInput(when) }))}
                >
                  Move booking
                </Button>
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">Timeline</h3>
            <ol className="mt-2 space-y-2 text-[13px] text-ink-2">
              <li className="flex gap-2"><span className="num w-36 shrink-0 text-ink-3">{fmtDateTime(b.createdAt)}</span> Requested in the app</li>
              {b.updatedAt !== b.createdAt ? (
                <li className="flex gap-2"><span className="num w-36 shrink-0 text-ink-3">{fmtDateTime(b.updatedAt)}</span> Last changed by an operator</li>
              ) : null}
            </ol>
          </section>
        </div>
      ) : null}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={(o) => {
          setCancelOpen(o);
          if (!o) setReason("");
        }}
        title={`Cancel ${b?.ref ?? ""}?`}
        body={
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Reason shown to the learner
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Trainer unavailable at this time"
              className="h-9 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm font-normal focus-visible:border-accent focus-visible:outline-none"
            />
          </label>
        }
        confirmLabel="Cancel booking"
        loading={pending === "cancel"}
        onConfirm={async () => {
          if (!b) return;
          const ok = await run("cancel", () => cancelBooking({ id: b.id, reason }));
          if (ok) {
            setCancelOpen(false);
            setReason("");
          }
        }}
      />
    </Drawer>
  );
}
