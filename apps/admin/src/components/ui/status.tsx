import {
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  Clock3,
  Crown,
  ShieldCheck,
  UserRound,
  VideoOff,
  XCircle,
  UserX,
  MailQuestion,
  Ban,
  Eye,
  EyeOff,
} from "lucide-react";
import type { BookingStatus, AdminStatus } from "@/lib/data/types";
import type { Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "accent";

/**
 * Label colour is the `on-*-soft` token, not the base hue: at 12px on its own
 * soft fill the base hue falls under 4.5:1 in light, and `--accent-ink` is
 * unreadable on the dark `--accent-soft`. The inset ring gives the pill an
 * edge, so it reads as an object on both `--surface` and `--sunken` rows.
 */
const toneClass: Record<Tone, string> = {
  ok: "bg-ok-soft text-on-ok-soft ring-ok/20",
  warn: "bg-warn-soft text-on-warn-soft ring-warn/20",
  bad: "bg-bad-soft text-on-bad-soft ring-bad/20",
  info: "bg-info-soft text-on-info-soft ring-info/20",
  neutral: "bg-sunken text-ink-2 ring-line-strong/50",
  accent: "bg-accent-soft text-on-accent-soft ring-accent/30",
};

export function Pill({
  tone = "neutral",
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-[5px] px-2 text-[12px] font-medium",
        "ring-1 ring-inset",
        toneClass[tone],
        className,
      )}
    >
      {/* Status is never colour alone: every pill pairs an icon with its label. */}
      {Icon ? <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden /> : null}
      {children}
    </span>
  );
}

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: Tone; icon: React.ElementType }> = {
  requested: { label: "Requested", tone: "warn", icon: Clock3 },
  confirmed: { label: "Confirmed", tone: "ok", icon: CheckCircle2 },
  completed: { label: "Completed", tone: "neutral", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", tone: "neutral", icon: XCircle },
  no_show: { label: "No-show", tone: "neutral", icon: UserX },
  meet_failed: { label: "Meet link failed", tone: "bad", icon: VideoOff },
};

export function BookingStatusPill({ status }: { status: BookingStatus }) {
  const s = BOOKING_STATUS[status];
  return (
    <Pill tone={s.tone} icon={s.icon}>
      {s.label}
    </Pill>
  );
}

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  if (role === "owner")
    return (
      <Pill tone="accent" icon={Crown} className={className}>
        Owner
      </Pill>
    );
  if (role === "superadmin")
    return (
      <Pill tone="info" icon={ShieldCheck} className={className}>
        Super admin
      </Pill>
    );
  return (
    <Pill tone="neutral" icon={UserRound} className={className}>
      Admin
    </Pill>
  );
}

export function AdminStatusPill({ status }: { status: AdminStatus }) {
  if (status === "active") return <Pill tone="ok" icon={CheckCircle2}>Active</Pill>;
  if (status === "invited") return <Pill tone="warn" icon={MailQuestion}>Invite pending</Pill>;
  return <Pill tone="neutral" icon={Ban}>Disabled</Pill>;
}

export function PublishedPill({ published }: { published: boolean }) {
  return published ? (
    <Pill tone="ok" icon={Eye}>Published</Pill>
  ) : (
    <Pill tone="neutral" icon={EyeOff}>Hidden</Pill>
  );
}

export function DraftPill() {
  return <Pill tone="neutral" icon={CircleDashed}>Draft</Pill>;
}

export function BlockedPill() {
  return <Pill tone="bad" icon={CircleSlash}>Blocked</Pill>;
}
