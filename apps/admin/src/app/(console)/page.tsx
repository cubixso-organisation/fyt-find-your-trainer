import Link from "next/link";
import { requestTime } from "@/lib/clock";
import { MapPin, Video } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { attentionBookings, overviewMetrics, todaysBookings } from "@/lib/data/queries";
import { db } from "@/lib/data/store";
import { PERMISSIONS } from "@/lib/rbac";
import { fmtDate, fmtNumber, fmtPct, fmtTime } from "@/lib/utils";
import { EmptyState, PageHeader, Panel, PanelHeader, buttonClass } from "@/components/ui/primitives";
import { BookingStatusPill } from "@/components/ui/status";
import { KpiBand, countDelta, rateDelta, type Kpi } from "@/components/overview/kpi-band";
import { AttentionQueue } from "@/components/overview/attention-queue";
import { ActivityFeed } from "@/components/overview/activity-feed";
import { solarIcon } from "@/components/icons/solar";

export const metadata = { title: "Overview" };

const LockIcon = solarIcon("lock-keyhole-minimalistic-bold-duotone");

function greeting(now: number) {
  const h = Number(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(now));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { admin, permissions } = await requireViewer();
  const { denied } = await searchParams;
  const now = requestTime();
  const canBookings = permissions.has("bookings");
  const m = overviewMetrics(now, 7);
  const today = canBookings ? todaysBookings(now) : [];
  const queue = canBookings ? attentionBookings(now) : [];
  // Admins without audit access see operational activity only, never
  // team, ownership or sign-in events.
  const activity = db()
    .audit.filter((e) => permissions.has("audit") || !/^(team|owner|auth|settings)\./.test(e.action))
    .slice(0, 7);
  const deniedDef = PERMISSIONS.find((p) => p.key === denied);

  const kpis: Kpi[] = [
    { label: "New learners", value: fmtNumber(m.regs.current), delta: countDelta(m.regs.current, m.regs.previous), hint: "vs previous 7 days" },
    { label: "Bookings made", value: fmtNumber(m.booked.current), delta: countDelta(m.booked.current, m.booked.previous), hint: "vs previous 7 days" },
    { label: "Attendance", value: fmtPct(m.attendance.current), delta: rateDelta(m.attendance.current, m.attendance.previous), hint: "of sessions held" },
    {
      label: "Meet links working",
      value: fmtPct(m.meetRate),
      delta: m.meetRate >= 0.999 ? { text: "on target", direction: "flat", good: true } : { text: "under target", direction: "down", good: false },
      hint: `of ${m.meetSample} online`,
    },
  ];

  return (
    <>
      {deniedDef ? (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-[var(--radius-panel)] border border-line bg-surface px-4 py-3">
          <LockIcon className="mt-0.5 size-[18px] shrink-0 text-[var(--accent)]" />
          <p className="text-[13px] text-ink-2">
            <span className="font-medium text-ink">{deniedDef.label} is locked for your account.</span>{" "}
            {deniedDef.minRole === "admin"
              ? "A super admin can grant it from Team & roles."
              : deniedDef.minRole === "owner"
                ? "Only the owner can open it."
                : "It needs a super admin or the owner."}
          </p>
        </div>
      ) : null}

      <PageHeader
        eyebrow={fmtDate(now, { weekday: "long", day: "numeric", month: "long" })}
        title={`${greeting(now)}, ${admin.name.split(" ")[0]}`}
        description={
          canBookings
            ? queue.length
              ? `${queue.length} booking${queue.length === 1 ? " needs" : "s need"} you, and ${today.length} session${today.length === 1 ? " is" : "s are"} on today's calendar.`
              : `Nothing is waiting on you. ${today.length} session${today.length === 1 ? " is" : "s are"} on today's calendar.`
            : "Here is how the platform is doing this week."
        }
      />

      <KpiBand items={kpis} />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {canBookings ? (
            <AttentionQueue
              now={now}
              rows={queue.map((b) => ({
                id: b.id,
                ref: b.ref,
                status: b.status as "requested" | "meet_failed",
                start: b.start,
                mode: b.mode,
                learnerName: b.learnerName,
                targetName: b.targetName,
                targetType: b.targetType,
              }))}
            />
          ) : null}

          {canBookings ? (
            <Panel>
              <PanelHeader
                title="Today"
                description={`${today.length} session${today.length === 1 ? "" : "s"}, times in IST`}
                actions={
                  <Link href="/bookings?view=calendar" className={buttonClass("ghost", "sm")}>
                    Calendar
                  </Link>
                }
              />
              {today.length === 0 ? (
                <EmptyState icon={solarIcon("calendar-mark-bold-duotone")} title="No sessions today" body="Confirmed demos, mentorship and consultations for today show up here in time order." />
              ) : (
                <ol className="divide-y divide-line">
                  {today.map((b) => {
                    const past = b.end < now;
                    const live = b.start <= now && now < b.end;
                    return (
                      <li key={b.id} className={`grid grid-cols-[72px_1fr_auto] items-center gap-4 px-5 py-3 ${past ? "opacity-60" : ""}`}>
                        <div className="num text-[13px] text-ink">
                          {fmtTime(b.start)}
                          {live ? (
                            <span className="mt-1 flex items-center gap-1 font-sans text-[11px] font-medium text-ok">
                              <span className="size-1.5 animate-pulse rounded-full bg-ok" /> Live
                            </span>
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium text-ink">{b.targetName}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-ink-2">
                            {b.mode === "online" ? <Video className="size-3.5 shrink-0" strokeWidth={1.75} /> : <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />}
                            {b.learnerName} · {b.learnerSegment === "corporate" ? "Corporate" : "Student"}
                          </p>
                        </div>
                        <BookingStatusPill status={b.status} />
                      </li>
                    );
                  })}
                </ol>
              )}
            </Panel>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelHeader title="Recent activity" description="What operators changed" />
            <div className="py-2">
              <ActivityFeed entries={activity} now={now} showAllHref={permissions.has("audit") ? "/audit" : undefined} />
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
