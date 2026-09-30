"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { CalendarCheck2, RefreshCw, VideoOff, Clock3, MapPin } from "lucide-react";
import { Button, EmptyState, Panel, PanelHeader, buttonClass } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { cancelBooking, confirmBooking, retryMeetLink } from "@/app/(console)/bookings/actions";
import { fmtDate, fmtTime, relTime } from "@/lib/utils";
import { solarIcon } from "@/components/icons/solar";
import { MeetIcon } from "@/components/icons/brand-icon";

export interface QueueRow {
  id: string;
  ref: string;
  status: "requested" | "meet_failed";
  start: number;
  mode: "online" | "offline";
  learnerName: string;
  targetName: string;
  targetType: string;
}

const QueueClear = solarIcon("checklist-minimalistic-bold-duotone");

export function AttentionQueue({ rows, now }: { rows: QueueRow[]; now: number }) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [cancelFor, setCancelFor] = React.useState<QueueRow | null>(null);
  const [reason, setReason] = React.useState("");

  async function run(id: string, fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setPending(id);
    const r = await fn();
    setPending(null);
    if (r.ok) toast.success(r.message ?? "Done");
    else toast.error(r.error ?? "Something went wrong.");
  }

  const failed = rows.filter((r) => r.status === "meet_failed").length;

  return (
    <Panel>
      <PanelHeader
        icon={solarIcon("notification-unread-lines-bold-duotone")}
        title="Needs action"
        description={
          rows.length
            ? `${rows.length} upcoming booking${rows.length === 1 ? "" : "s"}${failed ? `, ${failed} without a working Meet link` : ""}`
            : "Upcoming bookings that are waiting on an operator"
        }
        actions={
          <Link href="/bookings?view=attention" className={buttonClass("ghost", "sm")}>
            Open queue
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={QueueClear}
          title="Queue is clear"
          body="Every upcoming booking is confirmed with a working link. New requests from the app appear here first."
        />
      ) : (
        <ul className="divide-y divide-line">
          <AnimatePresence initial={false}>
            {rows.slice(0, 8).map((r) => (
              <motion.li
                key={r.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                className="grid grid-cols-1 gap-3 px-5 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={
                      r.status === "meet_failed"
                        ? "mt-0.5 grid size-8 shrink-0 place-items-center rounded-[7px] bg-bad-soft text-bad"
                        : "mt-0.5 grid size-8 shrink-0 place-items-center rounded-[7px] bg-warn-soft text-warn"
                    }
                  >
                    {r.status === "meet_failed" ? (
                      <VideoOff className="size-4" strokeWidth={1.75} aria-label="Meet link failed" />
                    ) : (
                      <Clock3 className="size-4" strokeWidth={1.75} aria-label="Awaiting confirmation" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-[13.5px] text-ink" title={`${r.learnerName} with ${r.targetName}`}>
                      <span className="font-medium">{r.learnerName}</span>
                      <span className="text-ink-3"> with </span>
                      <span className="font-medium">{r.targetName}</span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-ink-2">
                      <span className="num">{r.ref}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {fmtDate(r.start, { weekday: "short", day: "numeric", month: "short" })}, {fmtTime(r.start)}
                      </span>
                      <span className="text-ink-3">({relTime(r.start, now)})</span>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        {r.mode === "online" ? <MeetIcon className="size-3.5" title="Google Meet" /> : <MapPin className="size-3.5" strokeWidth={1.75} />}
                        {r.mode === "online" ? "Online" : "In person"}
                      </span>
                    </p>
                    {r.status === "meet_failed" ? (
                      <p className="mt-1 text-[12.5px] text-bad">Google Meet link wasn&apos;t created. The learner has no link yet.</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-11 sm:pl-0">
                  <Button variant="ghost" size="sm" onClick={() => setCancelFor(r)} disabled={pending === r.id}>
                    Cancel
                  </Button>
                  {r.status === "meet_failed" ? (
                    <Button variant="primary" size="sm" loading={pending === r.id} onClick={() => run(r.id, () => retryMeetLink(r.id))}>
                      {pending === r.id ? null : <RefreshCw className="size-3.5" strokeWidth={1.75} />}
                      Retry link
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" loading={pending === r.id} onClick={() => run(r.id, () => confirmBooking(r.id))}>
                      {pending === r.id ? null : <CalendarCheck2 className="size-3.5" strokeWidth={1.75} />}
                      Confirm
                    </Button>
                  )}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {rows.length > 8 ? (
        <div className="border-t border-line px-5 py-2.5 text-[13px] text-ink-2">
          {rows.length - 8} more in the{" "}
          <Link href="/bookings?view=attention" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            bookings queue
          </Link>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!cancelFor}
        onOpenChange={(o) => {
          if (!o) {
            setCancelFor(null);
            setReason("");
          }
        }}
        title={`Cancel ${cancelFor?.ref ?? "booking"}?`}
        body={
          <div className="flex flex-col gap-3">
            <p>
              {cancelFor?.learnerName} will get a push notification with your reason. The slot opens up for others.
            </p>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
              Reason shown to the learner
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Trainer unavailable at this time"
                className="h-9 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm font-normal focus-visible:border-accent focus-visible:outline-none"
              />
            </label>
          </div>
        }
        confirmLabel="Cancel booking"
        loading={!!cancelFor && pending === cancelFor.id}
        onConfirm={async () => {
          if (!cancelFor) return;
          const id = cancelFor.id;
          await run(id, () => cancelBooking({ id, reason }));
          setCancelFor(null);
          setReason("");
        }}
      />
    </Panel>
  );
}
