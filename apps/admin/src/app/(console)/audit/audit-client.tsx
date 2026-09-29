"use client";

import { Download} from "lucide-react";
import type { AuditEntry } from "@/lib/data/types";
import { ROLE_LABEL } from "@/lib/rbac";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/primitives";
import { Pill } from "@/components/ui/status";
import { ACTION_LABEL, iconFor } from "@/components/overview/activity-feed";
import { fmtDateTime, relTime } from "@/lib/utils";
import { solarIcon } from "@/components/icons/solar";

const GROUPS: Record<string, string> = {
  booking: "Bookings",
  course: "Catalog",
  institute: "Catalog",
  provider: "Catalog",
  availability: "Availability",
  content: "Catalog",
  learner: "Learners",
  broadcast: "Broadcasts",
  team: "Team",
  owner: "Ownership",
  settings: "Settings",
  auth: "Sign-ins",
  profile: "Profile",
};

function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function AuditClient({ entries, actors, now }: { entries: AuditEntry[]; actors: Array<{ id: string; name: string }>; now: number }) {
  const columns: Column<AuditEntry>[] = [
    {
      key: "at",
      header: "When",
      sortValue: (r) => r.at,
      cell: (r) => (
        <div className="whitespace-nowrap" title={new Date(r.at).toISOString()}>
          <p className="num text-[12.5px] text-ink">{fmtDateTime(r.at)}</p>
          <p className="text-[12px] text-ink-3">{relTime(r.at, now)}</p>
        </div>
      ),
    },
    {
      key: "who",
      header: "Operator",
      sortValue: (r) => r.actorName,
      cell: (r) => (
        <div className="min-w-[7.5rem]">
          <p className="font-medium">{r.actorName}</p>
          <p className="text-[12px] text-ink-3">{ROLE_LABEL[r.actorRole]}</p>
        </div>
      ),
    },
    {
      key: "what",
      header: "Action",
      cell: (r) => {
        const Icon = iconFor(r.action);
        return (
          // A floor on the width: on a phone the table scrolls sideways
          // instead of crushing the sentence to one word per line.
          <div className="flex min-w-[15rem] items-start gap-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={1.6} aria-hidden />
            <div className="min-w-0">
              <p className="text-ink">
                {ACTION_LABEL[r.action] ?? r.action} {r.target ? <span className="font-medium">{r.target}</span> : null}
              </p>
              {r.detail ? <p className="text-[12px] text-ink-2">{r.detail}</p> : null}
            </div>
          </div>
        );
      },
    },
    {
      key: "sev",
      header: "Level",
      sortValue: (r) => ({ critical: 0, notice: 1, info: 2 })[r.severity],
      cell: (r) =>
        r.severity === "critical" ? <Pill tone="bad">Critical</Pill> : r.severity === "notice" ? <Pill tone="warn">Notice</Pill> : <Pill>Info</Pill>,
    },
    { key: "code", header: "Event", hideBelow: "xl", cell: (r) => <span className="num text-[12px] text-ink-3">{r.action}</span> },
  ];

  const exportCsv = () => {
    const rows = [["timestamp_utc", "operator", "role", "event", "target", "detail", "level"]].concat(
      entries.map((e) => [new Date(e.at).toISOString(), e.actorName, e.actorRole, e.action, e.target ?? "", e.detail ?? "", e.severity]),
    );
    const blob = new Blob([rows.map((r) => r.map(csvEscape).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <DataTable
      caption="Audit log"
      rows={entries}
      columns={columns}
      rowKey={(r) => r.id}
      initialSort={{ key: "at", dir: "desc" }}
      pageSize={40}
      search={(r) => `${r.actorName} ${r.action} ${r.target ?? ""} ${r.detail ?? ""}`}
      searchPlaceholder="Search operator, target, detail"
      filters={[
        { key: "actor", label: "Operator", options: actors.map((a) => ({ value: a.id, label: a.name })), test: (r, v) => r.actorId === v },
        {
          key: "group",
          label: "Area",
          options: [...new Set(Object.values(GROUPS))].map((g) => ({ value: g, label: g })),
          test: (r, v) => GROUPS[r.action.split(".")[0]] === v,
        },
        { key: "sev", label: "Level", options: [{ value: "critical", label: "Critical" }, { value: "notice", label: "Notice" }, { value: "info", label: "Info" }], test: (r, v) => r.severity === v },
      ]}
      toolbar={
        <Button size="sm" onClick={exportCsv}>
          <Download className="size-4" strokeWidth={1.6} /> Export CSV
        </Button>
      }
      empty={{ icon: solarIcon("clipboard-list-bold-duotone"), title: "No entries yet", body: "Operator actions are recorded here as they happen." }}
    />
  );
}
