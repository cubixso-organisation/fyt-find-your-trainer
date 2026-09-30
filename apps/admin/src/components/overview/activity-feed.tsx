import Link from "next/link";
import {
  CalendarCheck2,
  CalendarX2,
  CalendarClock,
  KeyRound,
  Pencil,
  Eye,
  ShieldAlert,
  UserPlus,
  Megaphone,
  RefreshCw,
} from "lucide-react";
import type { AuditEntry } from "@/lib/data/types";
import { ROLE_LABEL } from "@/lib/rbac";
import { cn, relTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/primitives";
import { solarIcon } from "@/components/icons/solar";
import { UiIcon } from "@/components/icons/ui-icon";

const ICONS: Array<[RegExp, React.ElementType]> = [
  [/^booking\.confirm/, CalendarCheck2],
  [/^booking\.cancel/, CalendarX2],
  [/^booking\.reschedule/, CalendarClock],
  [/^booking\.meet_retry/, RefreshCw],
  [/^auth\./, KeyRound],
  [/publish/, Eye],
  [/^team\.invite/, UserPlus],
  [/^team\./, ShieldAlert],
  [/^owner\./, ShieldAlert],
  [/^broadcast/, Megaphone],
];

export const ACTION_LABEL: Record<string, string> = {
  "booking.confirm": "confirmed booking",
  "booking.cancel": "cancelled booking",
  "booking.reschedule": "rescheduled booking",
  "booking.meet_retry": "regenerated the Meet link for",
  "booking.completed": "marked attended",
  "booking.no_show": "marked no-show",
  "course.update": "updated course",
  "course.create": "added course",
  "course.delete": "deleted course",
  "institute.update": "updated institute",
  "institute.create": "added institute",
  "institute.delete": "deleted institute",
  "provider.update": "updated",
  "provider.create": "added",
  "provider.publish": "published",
  "provider.unpublish": "hid",
  "provider.delete": "deleted",
  "availability.update": "changed availability for",
  "auth.login": "signed in to the",
  "team.invite": "invited",
  "team.permissions": "changed permissions for",
  "team.role": "changed the role of",
  "team.disable": "disabled",
  "team.enable": "restored access for",
  "team.revoke_sessions": "signed out",
  "broadcast.send": "sent broadcast",
  "broadcast.schedule": "scheduled broadcast",
  "settings.update": "updated platform settings",
  "content.update": "updated the app home",
  "learner.block": "blocked learner",
  "learner.unblock": "unblocked learner",
  "owner.transfer": "transferred ownership to",
  "owner.revoke_all": "signed out every operator",
  "owner.maintenance": "changed maintenance mode",
  "profile.update": "updated their profile",
};

export function iconFor(action: string) {
  return ICONS.find(([re]) => re.test(action))?.[1] ?? Pencil;
}

export function ActivityFeed({ entries, now, showAllHref }: { entries: AuditEntry[]; now: number; showAllHref?: string }) {
  if (!entries.length)
    return <EmptyState icon={solarIcon("graph-up-bold-duotone")} title="No activity yet" body="Operator actions like confirmations and edits show up here as they happen." />;
  return (
    <ol className="relative flex flex-col">
      {entries.map((e, i) => {
        const Icon = iconFor(e.action);
        return (
          <li key={e.id} className="relative flex gap-3 px-5 py-2.5">
            {i < entries.length - 1 ? <span aria-hidden className="absolute left-[33px] top-9 bottom-0 w-px bg-line" /> : null}
            <span
              className={cn(
                "relative z-[1] mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border bg-surface",
                e.severity === "critical" ? "border-bad/40 text-bad" : e.severity === "notice" ? "border-line-strong text-ink" : "border-line text-ink-3",
              )}
            >
              <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 text-[13px] leading-snug">
              <p className="text-ink-2">
                <span className="font-medium text-ink">{e.actorName}</span> {ACTION_LABEL[e.action] ?? e.action}{" "}
                {e.target ? <span className="font-medium text-ink">{e.target}</span> : null}
              </p>
              <p className="mt-0.5 text-[12px] text-ink-3" title={new Date(e.at).toISOString()}>
                {relTime(e.at, now)} · {ROLE_LABEL[e.actorRole]}
              </p>
            </div>
          </li>
        );
      })}
      {showAllHref ? (
        <li className="px-5 pb-3 pt-1">
          <Link href={showAllHref} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            <UiIcon name="audit" className="size-[18px] shrink-0 text-ink-2" />
            Full audit log
          </Link>
        </li>
      ) : null}
    </ol>
  );
}
