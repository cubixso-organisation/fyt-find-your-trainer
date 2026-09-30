/**
 * Shared shell for both sign-in steps (/login and /login/verify), so step 2
 * feels like the same page.
 *
 * Structure follows the "Auth Page" component by efferd on 21st.dev
 * (https://21st.dev/@efferd/components/auth-page): a split layout with a
 * muted left panel carrying animated floating paths and a bottom-up fade,
 * and a centred auth column on the right over soft radial washes. Adapted:
 * FYT lockup instead of a generic logo; the testimonial quote is replaced by
 * a headline and three plain capability lines (the console allows no social
 * proof); no "Home" button (there is no public site); ink and marigold
 * instead of slate. The left panel is hidden below `lg`, as in the source.
 * The right column's radial washes became a slow WebGL mesh gradient
 * (./auth-gradient.tsx), and the form moved onto a surface card over it.
 */
import { FytMark, FytWordmark } from "@/components/brand/fyt";
import { AuthGradient } from "./auth-gradient";
import { FloatingPaths } from "./floating-paths";
import { PanelIntro } from "./panel-intro";
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
  return (
    <main className="relative isolate min-h-dvh bg-paper lg:grid lg:grid-cols-2">
      {/* ---------- Left: motion + a short introduction (lg and up) ---------- */}
      <aside className="relative hidden h-dvh flex-col overflow-hidden border-r border-line bg-[var(--auth-panel)] p-10 [--auth-panel:color-mix(in_oklab,var(--sunken)_60%,var(--paper))] lg:sticky lg:top-0 lg:flex xl:p-14">
        <div className="absolute inset-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>

        <div className="relative z-10 self-start">
          {/* the same ground, soft-edged, behind the lockup */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-16 -inset-y-10 -z-10 bg-[radial-gradient(closest-side,var(--auth-panel)_62%,transparent)]"
          />
          <Lockup className="animate-rise flex items-center gap-3" />
        </div>

        <div className="relative z-10 mt-auto">
          {/* Panel-coloured ground that fades in above the copy and runs to
              the panel's edges, so no stroke ever crosses the text. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-14 -bottom-14 -top-36 -z-10 bg-[linear-gradient(to_bottom,transparent,var(--auth-panel)_7.5rem)]"
          />
          <PanelIntro />
        </div>
      </aside>

      {/* ---------- Right: the auth column ---------- */}
      <div className="relative flex min-h-dvh flex-col overflow-hidden px-4 py-5 sm:px-8">
        {/* A slow mesh gradient in paper and marigold (./auth-gradient.tsx)
            replaces the source's radial washes. The form never sits on it
            directly: it rests on a surface card. */}
        <AuthGradient />

        <div className="flex items-center justify-between">
          <Lockup className="animate-rise flex items-center gap-3 lg:invisible" />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-6 sm:py-8">
          <div
            className="animate-rise w-full max-w-[464px] rounded-[var(--radius-overlay)] border border-line bg-surface px-5 py-6 shadow-[var(--shadow-overlay)] sm:px-8 sm:py-8"
            style={{ animationDelay: "40ms", animationFillMode: "both" }}
          >
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
