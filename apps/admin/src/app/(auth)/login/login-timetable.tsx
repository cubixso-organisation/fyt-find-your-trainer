"use client";

/**
 * The sign-in panel's timetable: pick a day, see that day's sessions.
 *
 * SECURITY / HONESTY: the sign-in page is public, so this never reads the
 * store. Every session below is generated from the date alone out of a small
 * fixed list of fictional names and courses, and the card is badged "Demo".
 * It shows how the console lays out a day; it says nothing about real usage.
 */
import * as React from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { CalendarDays, CheckCircle2, Clock3, MapPin, Video } from "lucide-react";
import { TimetableCalendar } from "@/components/ui/timetable-calendar";
import { cn } from "@/lib/utils";

type Status = "completed" | "ready" | "needs" | "confirmed";

interface Session {
  time: string;
  course: string;
  trainer: string;
  kind: string;
  online: boolean;
  area: string;
  status: Status;
}

const COURSES = [
  "CI/CD Pipeline on EKS",
  "MERN Stack Bootcamp",
  "Java with Spring Boot",
  "SAP FICO Functional",
  "Salesforce Admin",
  "Power BI Dashboards",
  "Selenium with Java",
  "Python for Data Analysis",
];
const TRAINERS = ["Nalini", "Akhil", "Keerthana", "Ravi", "Sravani", "Harika", "Vamshi"];
const KINDS = ["Demo class", "Mentorship", "Consultation"];
const AREAS = ["Ameerpet", "Madhapur", "Kukatpally", "Gachibowli"];
const TIMES = ["7:00 am", "9:30 am", "11:00 am", "1:30 pm", "4:00 pm", "6:30 pm"];

/** Small deterministic hash of the date key (FNV-1a). */
function seedOf(key: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

function sessionsFor(day: Date, today: Date): Session[] {
  const key = format(day, "yyyy-MM-dd");
  let s = seedOf(key);
  const next = () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0;
    s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0;
    return (s ^= s >>> 16) >>> 0;
  };
  const sunday = day.getDay() === 0;
  const count = sunday ? next() % 2 : 2 + (next() % 3);
  // Fisher-Yates with the seeded generator (not a random comparator: sort
  // order would then differ between engines and break hydration).
  const order = [...TIMES.keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const slots = order.slice(0, count).sort((a, b) => a - b);
  const past = day.getTime() < today.getTime() && !isSameDay(day, today);
  const isToday = isSameDay(day, today);
  return slots.map((slot, i) => {
    const online = next() % 3 !== 0;
    let status: Status = "confirmed";
    if (past) status = "completed";
    else if (isToday) status = i === 0 ? "completed" : i === 1 ? "needs" : "ready";
    else if (i === count - 1 && next() % 2 === 0) status = "needs";
    return {
      time: TIMES[slot],
      course: COURSES[next() % COURSES.length],
      trainer: TRAINERS[next() % TRAINERS.length],
      kind: KINDS[next() % KINDS.length],
      online,
      area: AREAS[next() % AREAS.length],
      status,
    };
  });
}

const STATUS: Record<Status, { label: string; icon: React.ElementType; cls: string }> = {
  completed: { label: "Completed", icon: CheckCircle2, cls: "bg-sunken text-ink-2 ring-line" },
  ready: { label: "Meet ready", icon: Video, cls: "bg-ok-soft text-on-ok-soft ring-ok/25" },
  needs: { label: "Needs action", icon: Clock3, cls: "bg-accent-soft text-on-accent-soft ring-accent/40" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, cls: "bg-ok-soft text-on-ok-soft ring-ok/25" },
};

const MAX_ROWS = 3;

export function LoginTimetable({ todayKey }: { todayKey: string }) {
  const today = React.useMemo(() => parseISO(todayKey), [todayKey]);
  const [day, setDay] = React.useState(today);
  const sessions = React.useMemo(() => sessionsFor(day, today), [day, today]);
  const needs = sessions.filter((s) => s.status === "needs").length;
  const shown = sessions.slice(0, MAX_ROWS);
  const isToday = isSameDay(day, today);

  return (
    <section aria-labelledby="timetable-heading" className="w-full">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="timetable-heading" className="font-display flex items-center gap-2 text-[14px] font-semibold text-ink">
          <CalendarDays className="size-4 text-ink-2" strokeWidth={1.75} aria-hidden />
          Session timetable
        </h2>
        <span className="rounded-full border border-dashed border-line-strong bg-surface/70 px-2 py-px text-[11px] font-medium uppercase tracking-[0.12em] text-ink-2">
          Demo
        </span>
      </div>

      <TimetableCalendar
        value={day}
        onValueChange={setDay}
        today={today}
        countFor={(d) => sessionsFor(d, today).length}
        countNoun="session"
        label="Timetable day"
        className="shadow-[0_1px_2px_oklch(var(--shadow-ink)/0.05),0_24px_48px_-28px_oklch(var(--shadow-ink)/0.35)]"
        footer={
          <div>
            <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3">
              <p className="text-[13px] text-ink" aria-live="polite">
                <span className="font-medium">{format(day, "EEE d MMM")}</span>
                <span className="text-ink-2">
                  {" · "}
                  {sessions.length === 0 ? "no sessions" : `${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
                  {needs ? ` · ${needs} need${needs === 1 ? "s" : ""} action` : ""}
                </span>
              </p>
              {!isToday ? (
                <button
                  type="button"
                  onClick={() => setDay(today)}
                  className="rounded-[var(--radius-control)] px-2 py-1 text-[12px] font-medium text-ink-2 underline-offset-2 transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Back to today
                </button>
              ) : null}
            </div>
            <ul className="flex min-h-[172px] flex-col gap-0.5 px-2 pb-2 pt-1">
              {shown.length === 0 ? (
                <li className="flex flex-1 flex-col items-center justify-center gap-1 py-6 text-center text-[13px] text-ink-2">
                  <CalendarDays className="size-5 text-ink-3" strokeWidth={1.5} aria-hidden />
                  No sessions on this day.
                </li>
              ) : (
                shown.map((s, i) => {
                  const st = STATUS[s.status];
                  const Icon = st.icon;
                  return (
                    <li
                      key={`${s.time}-${i}`}
                      className={cn(
                        "relative flex items-center gap-3 rounded-[var(--radius-panel)] px-2.5 py-2",
                        s.status === "needs" ? "bg-accent-soft/40" : "",
                      )}
                    >
                      {s.status === "needs" ? <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" /> : null}
                      <span className="num w-[62px] shrink-0 text-[12px] text-ink-2">{s.time}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{s.course}</span>
                        <span className="flex items-center gap-1 truncate text-[12px] text-ink-2">
                          {s.online ? (
                            <Video className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
                          ) : (
                            <MapPin className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
                          )}
                          <span className="truncate">
                            {s.kind} · {s.trainer} · {s.online ? "Online" : s.area}
                          </span>
                        </span>
                      </span>
                      <span
                        className={cn(
                          "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[12px] font-medium ring-1 ring-inset",
                          st.cls,
                        )}
                      >
                        <Icon className="size-3.5" strokeWidth={2} aria-hidden />
                        {st.label}
                      </span>
                    </li>
                  );
                })
              )}
              {sessions.length > MAX_ROWS ? (
                <li className="px-2.5 pt-0.5 text-[12px] text-ink-2">+{sessions.length - MAX_ROWS} more in the console</li>
              ) : null}
            </ul>
          </div>
        }
      />
    </section>
  );
}
