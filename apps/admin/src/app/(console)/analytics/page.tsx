import Link from "next/link";
import { requestTime } from "@/lib/clock";
import { requirePermission } from "@/lib/auth";
import { bookingMix, dailySeries, demandByListing, funnel } from "@/lib/data/queries";
import { db } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/primitives";
import { solarIcon } from "@/components/icons/solar";
import { KpiBand, countDelta, rateDelta, type Kpi } from "@/components/overview/kpi-band";
import { fmtNumber, fmtPct, cn } from "@/lib/utils";
import { AnalyticsCharts } from "./analytics-charts";

export const metadata = { title: "Analytics" };

const RANGES = [7, 30, 90] as const;
const DAY = 86_400_000;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requirePermission("analytics");
  const sp = await searchParams;
  const days = (RANGES as readonly number[]).includes(Number(sp.range)) ? Number(sp.range) : 30;
  const now = requestTime();
  const d = db();

  const inRange = (t: number, from: number, to: number) => t >= from && t < to;
  const from = now - days * DAY;
  const prevFrom = from - days * DAY;
  const regs = d.learners.filter((l) => inRange(l.createdAt, from, now)).length;
  const regsPrev = d.learners.filter((l) => inRange(l.createdAt, prevFrom, from)).length;
  const bk = d.bookings.filter((b) => inRange(b.createdAt, from, now));
  const bkPrev = d.bookings.filter((b) => inRange(b.createdAt, prevFrom, from));
  const conv = (list: typeof bk, f: number, t: number) => {
    const learners = d.learners.filter((l) => inRange(l.createdAt, f, t) && l.onboarded);
    if (!learners.length) return 0;
    const ids = new Set(list.map((b) => b.learnerId));
    return learners.filter((l) => ids.has(l.id)).length / learners.length;
  };
  const held = (list: typeof bk) => list.filter((b) => b.start < now && b.status !== "cancelled");
  const att = (list: typeof bk) => {
    const h = held(list);
    return h.length ? h.filter((b) => b.status === "completed").length / h.length : 0;
  };

  const kpis: Kpi[] = [
    { label: "New learners", icon: solarIcon("user-plus-rounded-bold-duotone"), value: fmtNumber(regs), delta: countDelta(regs, regsPrev), hint: `vs previous ${days} days` },
    { label: "Bookings made", icon: solarIcon("calendar-add-bold-duotone"), value: fmtNumber(bk.length), delta: countDelta(bk.length, bkPrev.length), hint: `vs previous ${days} days` },
    { label: "Learners who booked", icon: solarIcon("course-up-bold-duotone"), value: fmtPct(conv(bk, from, now)), delta: rateDelta(conv(bk, from, now), conv(bkPrev, prevFrom, from)), hint: "of new, onboarded" },
    { label: "Attendance", icon: solarIcon("user-check-rounded-bold-duotone"), value: fmtPct(att(bk)), delta: rateDelta(att(bk), att(bkPrev)), hint: "of sessions held" },
  ];

  const series = dailySeries(Math.min(days, 60), now);
  const mix = bookingMix(now, days);
  const segmentBookings = { student: 0, corporate: 0 };
  for (const b of bk) {
    const l = d.learners.find((x) => x.id === b.learnerId);
    if (l) segmentBookings[l.segment] += 1;
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How the platform is doing: who signs up, who books, and which listings pull demand."
        actions={
          <nav aria-label="Date range" className="inline-flex rounded-[var(--radius-control)] border border-line bg-sunken p-0.5">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/analytics?range=${r}`}
                aria-current={r === days ? "page" : undefined}
                className={cn(
                  "num h-7 rounded-[5px] px-3 text-[13px] leading-7 transition-colors",
                  r === days ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--line)]" : "text-ink-2 hover:text-ink",
                )}
              >
                {r}d
              </Link>
            ))}
          </nav>
        }
      />
      <KpiBand items={kpis} />
      <AnalyticsCharts
        days={days}
        series={series}
        funnel={funnel(now, days)}
        demand={demandByListing(now, days, 8)}
        mix={[
          { label: "Course demos", value: mix.course },
          { label: "Trainer 1-on-1", value: mix.trainer },
          { label: "Mentorship", value: mix.mentor },
          { label: "Consultation", value: mix.consultant },
        ]}
        segments={segmentBookings}
      />
    </>
  );
}
