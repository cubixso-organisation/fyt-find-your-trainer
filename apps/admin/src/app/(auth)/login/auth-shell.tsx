/**
 * Shared shell for both sign-in steps (/login and /login/verify), so step 2
 * feels like the same page.
 *
 * Structure follows the "Auth Page" component by efferd on 21st.dev
 * (https://21st.dev/@efferd/components/auth-page): a split layout with a
 * muted left panel carrying animated floating paths and a bottom-up fade,
 * and a centred auth column on the right over soft radial washes. Adapted:
 * FYT lockup instead of a generic logo; the testimonial quote is replaced by
 * the demo session timetable (the console allows no social proof); no "Home"
 * button (there is no public site); ink and marigold instead of slate. The
 * left panel is hidden below `lg`, as in the source.
 */
import { FytMark, FytWordmark } from "@/components/brand/fyt";
import { istDateKey } from "@/lib/slots";
import { requestTime } from "@/lib/clock";
import { FloatingPaths } from "./floating-paths";
import { LoginTimetable } from "./login-timetable";
import { ThemeToggle } from "./theme-toggle";

function Lockup({ className }: { className?: string }) {
  return (
    <div className={className}>
      <FytMark className="h-9 w-auto drop-shadow-[0_3px_4px_oklch(0.55_0.12_60/0.25)]" />
      <div className="leading-tight">
        <FytWordmark className="h-[17px] w-auto" />
        <p className="mt-1 text-[12px] uppercase tracking-[0.16em] text-ink-2">Find your trainer</p>
      </div>
    </div>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  // IST calendar day of this request; the client calendar renders from it,
  // so server and client markup agree.
  const todayKey = istDateKey(requestTime());

  return (
    <main className="relative isolate min-h-dvh bg-paper lg:grid lg:grid-cols-2">
      {/* ---------- Left: motion + timetable (lg and up) ---------- */}
      <aside className="relative hidden h-dvh flex-col overflow-hidden border-r border-line bg-sunken/60 p-10 lg:sticky lg:top-0 lg:flex">
        <div className="absolute inset-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>
        {/* bottom-up fade so the timetable sits on a calm ground */}
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_40%,color-mix(in_oklch,var(--paper)_75%,transparent))]" />

        <Lockup className="animate-rise relative z-10 flex items-center gap-3" />

        <div className="animate-rise relative z-10 mt-auto w-full max-w-[480px]" style={{ animationDelay: "80ms", animationFillMode: "both" }}>
          <p className="font-display max-w-[420px] text-[24px] font-semibold leading-[1.2] tracking-tight text-ink">
            Every booking from the app, confirmed and on the right calendar.
          </p>
          <p className="mb-6 mt-2 max-w-[420px] text-[14px] leading-relaxed text-ink-2">
            Bookings, trainers, institutes and payouts for Hyderabad, in one queue.
          </p>
          <LoginTimetable todayKey={todayKey} />
        </div>
      </aside>

      {/* ---------- Right: the auth column ---------- */}
      <div className="relative flex min-h-dvh flex-col overflow-hidden px-4 py-5 sm:px-8">
        {/* one soft radial wash in ink, top right (the source layers three
            rotated ones; a single background paints without extra layers) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_55%_at_85%_0%,color-mix(in_oklch,var(--ink)_5%,transparent),transparent_70%)]"
        />

        <div className="flex items-center justify-between">
          <Lockup className="animate-rise flex items-center gap-3 lg:invisible" />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-6 sm:py-8">
          <div className="animate-rise w-full max-w-[400px]" style={{ animationDelay: "40ms", animationFillMode: "both" }}>
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
