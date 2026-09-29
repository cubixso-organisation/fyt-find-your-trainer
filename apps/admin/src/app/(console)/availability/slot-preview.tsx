"use client";

import * as React from "react";
import { Ban, MapPin, PencilLine, Plus, Video } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { Pill } from "@/components/ui/status";
import { addDays, istEpoch, planDays, type SlotBooking, type SlotException, type SlotRule } from "@/lib/slots";
import { cn, fmtDate, minutesToLabel } from "@/lib/utils";

const PREVIEW_DAYS = 14;

/**
 * Next-14-days preview built with the same pure generator the Cloud Function
 * `getSlots` mirrors, so what is drawn here is what the app offers.
 */
export function SlotPreview({
  rules,
  exceptions,
  bookings,
  leadHours,
  now,
  today,
  isCourse,
  unsaved,
}: {
  rules: SlotRule[];
  exceptions: SlotException[];
  bookings: SlotBooking[];
  leadHours: number;
  now: number;
  today: string;
  isCourse: boolean;
  unsaved: boolean;
}) {
  const days = React.useMemo(
    () => planDays({ rules, exceptions, bookings, leadHours, now, from: today, to: addDays(today, PREVIEW_DAYS - 1) }),
    [rules, exceptions, bookings, leadHours, now, today],
  );
  const open = days.flatMap((d) => d.slots.filter((s) => s.state === "open"));
  const seats = open.reduce((n, s) => n + s.remaining, 0);

  return (
    <Panel>
      <PanelHeader
        title="What learners are offered"
        description={
          <span>
            Next {PREVIEW_DAYS} days after exceptions, existing bookings and the <span className="num">{leadHours}</span>-hour booking lead time.{" "}
            <span className="num text-ink">{open.length}</span> slot{open.length === 1 ? "" : "s"}
            {isCourse ? (
              <>
                , <span className="num text-ink">{seats}</span> seat{seats === 1 ? "" : "s"}
              </>
            ) : null}{" "}
            open.
          </span>
        }
        actions={unsaved ? <Pill tone="warn" icon={PencilLine}>Includes unsaved weekly changes</Pill> : null}
      />
      <ol className="divide-y divide-line">
        {days.map((d) => {
          const offered = d.slots.filter((s) => s.state === "open");
          const full = d.slots.filter((s) => s.state === "full").length;
          const started = d.slots.filter((s) => s.state === "too_soon" && s.start <= now).length;
          const soon = d.slots.filter((s) => s.state === "too_soon").length - started;
          const noon = istEpoch(d.date, 12 * 60);
          return (
            <li key={d.date} className="grid grid-cols-1 gap-2 px-5 py-3 sm:grid-cols-[112px_minmax(0,1fr)]">
              <div>
                <p className="text-[13px] font-medium text-ink">{fmtDate(noon, { weekday: "short", day: "numeric", month: "short" })}</p>
                {d.date === today ? <p className="text-[11.5px] text-ink-3">Today</p> : null}
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                {d.blocked ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="bad" icon={Ban}>Blocked all day</Pill>
                    <span className="text-[12.5px] text-ink-2">{d.blocked.reason ?? "No reason given"}</span>
                  </div>
                ) : d.slots.length === 0 ? (
                  <p className="py-0.5 text-[12.5px] text-ink-3">No windows</p>
                ) : (
                  <>
                    {offered.length ? (
                      <ul className="flex flex-wrap gap-1.5" aria-label={`Open slots on ${d.date}`}>
                        {offered.map((s) => (
                          <li
                            key={`${s.start}-${s.mode}`}
                            className={cn(
                              "inline-flex h-7 items-center gap-1.5 rounded-[6px] border bg-surface px-2 text-[12px] text-ink",
                              s.source === "extra" ? "border-dashed border-line-strong" : "border-line",
                            )}
                            title={`${minutesToLabel(s.startMinute)}–${minutesToLabel(s.endMinute)} · ${s.mode === "online" ? "Online" : "In person"}${
                              s.source === "extra" ? " · extra window" : ""
                            }`}
                          >
                            {s.source === "extra" ? <Plus className="size-3 text-ink-3" strokeWidth={2} aria-label="Extra window" /> : null}
                            {s.mode === "online" ? (
                              <Video className="size-3 text-ink-3" strokeWidth={1.75} aria-label="Online" />
                            ) : (
                              <MapPin className="size-3 text-ink-3" strokeWidth={1.75} aria-label="In person" />
                            )}
                            <span className="num">{minutesToLabel(s.startMinute)}</span>
                            {isCourse || s.capacity > 1 ? (
                              <span className="num text-ink-3">
                                {s.remaining}/{s.capacity} left
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="py-0.5 text-[12.5px] text-ink-2">Nothing bookable</p>
                    )}
                    {full || soon || started || d.partialBlocks.length ? (
                      <p className="text-[12px] text-ink-3">
                        {[
                          ...d.partialBlocks.map(
                            (p) => `Blocked ${minutesToLabel(p.startMinute)}–${minutesToLabel(p.endMinute)}${p.reason ? `: ${p.reason}` : ""}`,
                          ),
                          full ? `${full} full` : null,
                          started ? `${started} already started` : null,
                          soon ? `${soon} inside the ${leadHours}-hour lead time` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
