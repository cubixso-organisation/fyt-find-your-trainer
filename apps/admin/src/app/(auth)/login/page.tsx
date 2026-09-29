/**
 * FYT operator console: sign in.
 *
 * Split layout: a live product showcase on the left (./operator-queue), the
 * sign-in card on the right, over an ambient dot field with a cursor-following
 * marigold glow (./ambient-field).
 *
 * The split shell began as "Split Login" (login-03) by Mohammad Shehadeh /
 * Hirael on 21st.dev (MIT, https://hirael.com/blocks/auth/login-03); its
 * floating-path backdrop and static schedule art are replaced here. The tilt
 * and spotlight on the showcase follow the structure of ibelick's "Tilt"
 * (motion-primitives, MIT) as described on 21st.dev. No code was retrieved
 * for it; see operator-queue.tsx.
 *
 * No social proof: the aside shows the product (fictional demo bookings,
 * badged "Demo"), not claims about it.
 */
import type { Metadata } from "next";
import { CalendarCheck, CalendarPlus, Timer, UserPlus, Video } from "lucide-react";
import { DATA_SOURCE } from "@/lib/data/store";
import { FytMark, FytWordmark } from "@/components/brand/fyt";
import { AmbientField } from "./ambient-field";
import { LoginForm } from "./login-form";
import { OperatorQueue } from "./operator-queue";
import { ThemeToggle } from "./theme-toggle";

export const metadata: Metadata = { title: "Sign in" };

/** Staggered entrance, reusing the console's 200ms `rise`. */
const rise = (delayMs: number) => ({ animationDelay: `${delayMs}ms`, animationFillMode: "both" as const });

function Lockup({ className }: { className?: string }) {
  return (
    <div className={className}>
      <FytMark className="h-10 w-auto drop-shadow-[0_3px_4px_oklch(0.55_0.12_60/0.25)]" />
      <div className="leading-tight">
        <FytWordmark className="h-[18px] w-auto" />
        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink-2">Find your trainer</p>
      </div>
    </div>
  );
}

const STEPS = [
  { icon: CalendarCheck, title: "Confirm in one step", body: "Bookings from the app queue up for an operator." },
  { icon: Video, title: "Meet link created", body: "Every online session gets its Google Meet link." },
  { icon: CalendarPlus, title: "On the right calendar", body: "The session lands with the trainer who runs it." },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <section className="relative isolate min-h-[100dvh] overflow-x-clip bg-paper lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      <AmbientField />

      {/* ---------- Aside: the product, live ---------- */}
      <aside className="relative z-10 hidden min-h-[100dvh] flex-col border-r border-line bg-sunken/55 px-12 py-10 lg:flex xl:px-16">
        <Lockup className="animate-rise flex items-center gap-3" />

        <div className="my-auto w-full max-w-[560px] py-10">
          <div className="animate-rise" style={rise(60)}>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-[11.5px] font-medium text-ink-2 shadow-[0_1px_2px_oklch(var(--shadow-ink)/0.05)]">
              <span aria-hidden className="size-1.5 rounded-full bg-accent" />
              Operator console
            </p>
            <h2 className="mt-4 max-w-[520px] text-[32px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink xl:text-[36px]">
              Every booking from the app, confirmed and on Meet.
            </h2>
            <p className="mt-3 max-w-[480px] text-[14px] leading-relaxed text-ink-2">
              Bookings, trainers, institutes and payouts for Hyderabad. One queue, one place.
            </p>
          </div>

          <figure className="animate-rise mt-11 pr-5" style={rise(140)}>
            <OperatorQueue />
            <figcaption className="mt-10 flex items-center gap-2.5 text-[12.5px] text-ink-2">
              <span aria-hidden className="size-2.5 shrink-0 rounded-[3px] bg-accent" />
              Marigold marks the booking that needs an operator. Hover the card to pause.
            </figcaption>
          </figure>
        </div>

        <ol className="animate-rise grid max-w-[640px] grid-cols-3 gap-5 border-t border-line pt-6" style={rise(220)}>
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-[8px] bg-surface text-ink ring-1 ring-inset ring-line">
                  <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="num text-[11px] text-ink-3">0{i + 1}</span>
              </div>
              <p className="mt-2.5 text-[13px] font-medium text-ink">{title}</p>
              <p className="mt-1 text-[12px] leading-snug text-ink-2">{body}</p>
            </li>
          ))}
        </ol>
      </aside>

      {/* ---------- Main: sign in ---------- */}
      <div className="relative z-10 flex min-h-[100dvh] flex-col px-4 py-5 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between">
          <Lockup className="animate-rise flex items-center gap-3 lg:invisible" />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-8 sm:py-12">
          <div className="animate-rise relative w-full max-w-[430px]" style={rise(40)}>
            {/* Soft marigold halo behind the card */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-10 -z-10 rounded-[40px] opacity-80"
              style={{
                background:
                  "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--accent) 14%, transparent), transparent 75%)",
              }}
            />
            <div className="rounded-[18px] border border-line bg-surface/90 p-6 shadow-[0_1px_2px_oklch(var(--shadow-ink)/0.05),0_24px_60px_-28px_oklch(var(--shadow-ink)/0.35)] backdrop-blur-xl sm:p-9">
              <header>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-2">FYT operator console</p>
                <h1 className="mt-2.5 text-[28px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink">Sign in</h1>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  For the FYT operations team. Learners book from the FYT mobile app.
                </p>
              </header>

              <LoginForm next={next} demo={DATA_SOURCE === "demo"} />

              <ul className="animate-rise mt-7 space-y-2.5 border-t border-line pt-5 text-[12.5px] leading-snug text-ink-2" style={rise(280)}>
                <li className="flex items-start gap-2.5">
                  <UserPlus className="mt-px size-3.5 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
                  Operator accounts are created by invitation. If you need access, ask a super admin.
                </li>
                <li className="flex items-start gap-2.5">
                  <Timer className="mt-px size-3.5 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
                  Sessions end after 35 minutes without activity.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
