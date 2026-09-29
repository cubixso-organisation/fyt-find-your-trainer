/**
 * Built on "Split Login" (login-03) by Mohammad Shehadeh / Hirael, from
 * 21st.dev — MIT. https://hirael.com/blocks/auth/login-03
 *
 * Kept from the source: the split `aside` / `main` shell, the drifting
 * `FloatingPaths` backdrop, the fade-to-surface overlay, the soft radial
 * wash behind the form column, and the staggered entrance.
 *
 * Changed for FYT: shadcn primitives swapped for the console's own
 * Button / Field / Input; the serif display type dropped for the console
 * scale (no display sizes); the GitHub OAuth button replaced by the real
 * email + password server action; and — because the console shows no social
 * proof — the testimonial slot replaced by the schedule illustration and a
 * plain statement of what the console does.
 */
import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { DATA_SOURCE } from "@/lib/data/store";
import { FytMark, FytWordmark } from "@/components/brand/fyt";
import { FloatingPaths } from "./floating-paths";
import { LoginForm } from "./login-form";
import { ScheduleArt } from "./schedule-art";

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

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-paper lg:grid lg:grid-cols-[minmax(0,1.04fr)_minmax(0,1fr)]">
      {/* ---------- Aside: what the console is for ---------- */}
      <aside className="relative hidden h-full flex-col overflow-hidden border-r border-line bg-sunken px-10 py-11 lg:flex">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 60%, var(--sunken) 100%)" }}
        />

        <Lockup className="animate-rise relative z-10 flex items-center gap-3" />

        <figure className="animate-rise relative z-10 my-auto w-full max-w-[600px]" style={rise(80)}>
          <div className="overflow-hidden rounded-[var(--radius-overlay)] border border-line bg-surface shadow-[var(--shadow-overlay)]">
            <div className="flex items-center justify-between border-b border-line bg-sunken/70 px-4 py-2.5">
              <span className="flex items-center gap-2 text-[12px] font-medium text-ink">
                <CalendarClock className="size-3.5 text-ink-3" strokeWidth={1.75} aria-hidden />
                Trainer schedule
              </span>
              <span className="num text-[11px] text-ink-2">09:00 – 16:00</span>
            </div>
            <div className="px-4 pb-4 pt-3.5">
              <ScheduleArt className="h-auto w-full" />
            </div>
          </div>
          <figcaption className="mt-3.5 flex items-center gap-2.5 text-[12.5px] text-ink-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-[3px] bg-accent" />
            Marigold marks the one booking that needs an operator.
          </figcaption>
        </figure>

        <div className="animate-rise relative z-10 max-w-[560px]" style={rise(140)}>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-2">Operator console</p>
          <p className="mt-2.5 text-xl font-semibold leading-snug tracking-tight text-ink">
            Every demo booked in the FYT app lands here: confirmed, linked to Meet, and on the right trainer&apos;s
            calendar.
          </p>
          <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">
            Bookings, trainers, institutes and payouts for Hyderabad — one queue, one place.
          </p>
        </div>
      </aside>

      {/* ---------- Main: sign in ---------- */}
      <div className="relative flex min-h-[100dvh] flex-col justify-center px-5 py-14 sm:px-10 lg:min-h-0 lg:px-14">
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div
            className="absolute right-0 top-0 h-[760px] w-[520px] -translate-y-1/3 translate-x-1/4 rounded-full"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, var(--accent) 7%, transparent) 0%, transparent 72%)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 h-[640px] w-[460px] -translate-x-1/3 translate-y-1/3 rounded-full"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, var(--ink) 5%, transparent) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[392px]">
          <Lockup className="animate-rise mb-9 flex items-center gap-3 lg:hidden" />

          <header className="animate-rise">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-2">FYT operator console</p>
            <h1 className="mt-2.5 text-[30px] font-semibold leading-[1.12] tracking-tight text-ink">Sign in</h1>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-2">
              For the FYT operations team. Learners book from the FYT mobile app.
            </p>
          </header>

          <LoginForm next={next} />

          <div className="animate-rise mt-8 space-y-2 border-t border-line pt-5 text-[13px] leading-relaxed text-ink-2" style={rise(210)}>
            <p>Operator accounts are created by invitation. If you need access, ask a super admin.</p>
            <p>Sessions end after 35 minutes without activity.</p>
          </div>

          {DATA_SOURCE === "demo" ? (
            <div
              className="animate-rise mt-6 rounded-[var(--radius-panel)] border border-dashed border-line-strong bg-sunken/60 p-3.5 text-[12.5px] leading-relaxed text-ink-2"
              style={rise(260)}
            >
              <p className="font-medium text-ink">Demo data is active</p>
              <p className="mt-1">
                Try <span className="num text-ink">owner@demo.local</span>, <span className="num text-ink">super@demo.local</span>{" "}
                or <span className="num text-ink">admin@demo.local</span> with password{" "}
                <span className="num text-ink">Operator@2026</span> to see each role.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
