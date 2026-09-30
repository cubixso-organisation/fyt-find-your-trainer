"use client";

import * as React from "react";
import { Briefcase, GraduationCap } from "lucide-react";
import type { Learner } from "@/lib/data/types";
import type { BookingRow } from "@/lib/data/queries";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar, Button } from "@/components/ui/primitives";
import { ConfirmDialog, Drawer } from "@/components/ui/overlays";
import { BlockedPill, BookingStatusPill, Pill } from "@/components/ui/status";
import { useServerAction } from "@/components/ui/use-action";
import { fmtDate, fmtTime, relTime } from "@/lib/utils";
import { setLearnerBlocked } from "../audience-actions";
import { solarIcon } from "@/components/icons/solar";
import { UiIcon } from "@/components/icons/ui-icon";

type Row = Learner & { bookings: number; attended: number };

export function LearnersClient({ rows, bookingsByLearner, now }: { rows: Row[]; bookingsByLearner: Record<string, BookingRow[]>; now: number }) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [blockOpen, setBlockOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const { pending, run } = useServerAction();
  const o = rows.find((r) => r.id === openId) ?? null;

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Learner",
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={r.name} />
          <div className="min-w-0">
            <p className="truncate font-medium">{r.name}</p>
            <p className="num truncate text-[12px] text-ink-3">{r.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: "segment",
      header: "Segment",
      sortValue: (r) => r.segment,
      cell: (r) =>
        r.segment === "corporate" ? <Pill icon={Briefcase}>Corporate</Pill> : <Pill icon={GraduationCap}>Student</Pill>,
    },
    {
      key: "org",
      header: "College / company",
      hideBelow: "md",
      cell: (r) => (
        <span className="text-ink-2">
          {r.segment === "corporate" ? `${r.currentRole ?? ""}${r.company ? `, ${r.company}` : ""}` : r.institution}
        </span>
      ),
    },
    { key: "area", header: "Area", hideBelow: "xl", sortValue: (r) => r.area, cell: (r) => <span className="text-ink-2">{r.area}</span> },
    {
      key: "bookings",
      header: "Bookings",
      sortValue: (r) => r.bookings,
      className: "text-right",
      headerClassName: "text-right",
      cell: (r) => (
        <span className="num">
          {r.bookings}
          {r.bookings ? <span className="text-ink-3"> · {r.attended} attended</span> : null}
        </span>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      sortValue: (r) => r.createdAt,
      hideBelow: "lg",
      cell: (r) => <span className="text-[12.5px] text-ink-2">{relTime(r.createdAt, now)}</span>,
    },
    {
      key: "state",
      header: "State",
      sortValue: (r) => (r.blocked ? 0 : r.onboarded ? 2 : 1),
      cell: (r) => (r.blocked ? <BlockedPill /> : r.onboarded ? <Pill tone="ok">Active</Pill> : <Pill tone="warn">Onboarding</Pill>),
    },
  ];

  const exportCsv = (list: Row[]) => {
    const head = ["name", "phone", "email", "segment", "college_or_company", "area", "bookings", "joined"];
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = list.map((r) =>
      [r.name, r.phone, r.email ?? "", r.segment, r.segment === "corporate" ? r.company ?? "" : r.institution ?? "", r.area, String(r.bookings), new Date(r.createdAt).toISOString().slice(0, 10)].map(esc).join(","),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    a.download = `learners-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <DataTable
        caption="Learners"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
        initialSort={{ key: "joined", dir: "desc" }}
        search={(r) => `${r.name} ${r.phone} ${r.email ?? ""} ${r.institution ?? ""} ${r.company ?? ""}`}
        searchPlaceholder="Search name, phone, college, company"
        filters={[
          { key: "segment", label: "Segment", options: [{ value: "student", label: "Students" }, { value: "corporate", label: "Corporate" }], test: (r, v) => r.segment === v },
          {
            key: "state",
            label: "State",
            options: [{ value: "active", label: "Active" }, { value: "onboarding", label: "Onboarding" }, { value: "blocked", label: "Blocked" }, { value: "never", label: "Never booked" }],
            test: (r, v) => (v === "blocked" ? r.blocked : v === "onboarding" ? !r.onboarded && !r.blocked : v === "never" ? r.bookings === 0 : r.onboarded && !r.blocked),
          },
        ]}
        selectable
        bulkActions={(sel) => (
          <Button size="sm" onClick={() => exportCsv(sel)}>
            <UiIcon name="export" className="size-3.5" /> Export selected
          </Button>
        )}
        toolbar={
          <Button size="sm" onClick={() => exportCsv(rows)}>
            <UiIcon name="export" className="size-4" /> Export
          </Button>
        }
        empty={{ icon: solarIcon("users-group-rounded-bold-duotone"), title: "No learners yet", body: "People who sign up in the mobile app appear here after they verify their phone number." }}
      />

      <Drawer
        icon={solarIcon("user-rounded-bold-duotone")}
        open={!!o}
        onOpenChange={(v) => !v && setOpenId(null)}
        title={o?.name ?? ""}
        description={o ? `${o.segment === "corporate" ? "Corporate employee" : "Student"} · joined ${fmtDate(o.createdAt, { day: "numeric", month: "short", year: "numeric" })}` : undefined}
        width="max-w-[560px]"
        footer={
          o ? (
            o.blocked ? (
              <Button loading={pending === "unblock"} onClick={() => run("unblock", () => setLearnerBlocked({ id: o.id, blocked: false }))}>
                Unblock learner
              </Button>
            ) : (
              <Button variant="ghost" className="text-bad hover:text-bad" onClick={() => setBlockOpen(true)}>
                Block learner
              </Button>
            )
          ) : null
        }
      >
        {o ? (
          <div className="flex flex-col gap-6">
            <dl className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-2.5 text-[13.5px]">
              <dt className="text-ink-2">Phone</dt>
              <dd className="num">{o.phone}</dd>
              <dt className="text-ink-2">Email</dt>
              <dd>{o.email ?? <span className="text-ink-3">Not given</span>}</dd>
              <dt className="text-ink-2">Area</dt>
              <dd>{o.area}</dd>
              {o.segment === "student" ? (
                <>
                  <dt className="text-ink-2">College</dt>
                  <dd>{o.institution}</dd>
                </>
              ) : (
                <>
                  <dt className="text-ink-2">Role</dt>
                  <dd>
                    {o.currentRole}, {o.company}
                  </dd>
                  <dt className="text-ink-2">Experience</dt>
                  <dd className="num">{o.yearsExperience} yrs</dd>
                </>
              )}
              <dt className="text-ink-2">Wants to learn</dt>
              <dd className="flex flex-wrap gap-1">
                {o.interests.map((i) => (
                  <span key={i} className="rounded-[4px] bg-sunken px-1.5 py-0.5 text-[12px] text-ink-2">{i}</span>
                ))}
              </dd>
              <dt className="text-ink-2">Last active</dt>
              <dd>{relTime(o.lastActiveAt, now)}</dd>
            </dl>
            <section>
              <h3 className="mb-2 text-[13.5px] font-semibold text-ink">Bookings</h3>
              {(bookingsByLearner[o.id] ?? []).length === 0 ? (
                <p className="text-[13px] text-ink-2">No bookings yet.</p>
              ) : (
                <ul className="divide-y divide-line rounded-[var(--radius-panel)] border border-line">
                  {(bookingsByLearner[o.id] ?? [])
                    .sort((a, b) => b.start - a.start)
                    .map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-ink">{b.targetName}</p>
                          <p className="num text-[12px] text-ink-3">
                            {fmtDate(b.start)} · {fmtTime(b.start)} · {b.ref}
                          </p>
                        </div>
                        <BookingStatusPill status={b.status} />
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={blockOpen}
        onOpenChange={(v) => {
          setBlockOpen(v);
          if (!v) setReason("");
        }}
        title={`Block ${o?.name}?`}
        body={
          <div className="flex flex-col gap-3">
            <p>They can still open the app but can&apos;t book. Their upcoming bookings are cancelled and providers are notified.</p>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
              Reason (kept in the audit log)
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-9 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm font-normal focus-visible:border-accent focus-visible:outline-none"
              />
            </label>
          </div>
        }
        confirmLabel="Block learner"
        loading={pending === "block"}
        onConfirm={async () => {
          if (!o) return;
          const r = await run("block", () => setLearnerBlocked({ id: o.id, blocked: true, reason }));
          if (r.ok) {
            setBlockOpen(false);
            setReason("");
          }
        }}
      />
    </>
  );
}
