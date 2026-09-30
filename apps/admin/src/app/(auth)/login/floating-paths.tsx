"use client";

/**
 * Ambient motion for the sign-in panel: two layers of 36 slow bezier strokes
 * drifting along their own length.
 *
 * Source: `FloatingPaths` from the "Auth Page" component by efferd on
 * 21st.dev (https://21st.dev/@efferd/components/auth-page), itself the
 * "Background Paths" pattern popularised by Kokonut UI. Adapted for FYT:
 *  - ink strokes (`currentColor` = --ink) instead of slate, so the same
 *    component reads correctly on paper in light mode and on the dark theme;
 *    two strokes per layer are marigold, the console's one accent;
 *  - slightly lower stroke opacity, and the viewBox pinned to the top of the
 *    tall panel (the source centres it), so the strokes sweep through the
 *    open upper area; the copy below sits on a panel-coloured fade (see
 *    ./auth-shell.tsx), so no stroke crosses the text;
 *  - deterministic per-path durations (lint bans Math.random() in render,
 *    and server and client must agree);
 *  - prefers-reduced-motion: a still frame of the same paths, no animation.
 * Animation runs in motion/react on the SVG attributes; nothing re-renders
 * per frame.
 */
import { motion } from "motion/react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

const COUNT = 36;
/** Two accent strokes per layer. */
const ACCENT = new Set([11, 23]);

function pathsFor(position: number) {
  return Array.from({ length: COUNT }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
    // 20-30 s, spread by a fixed stride so neighbours never move in lockstep.
    duration: 20 + ((i * 7) % 11),
  }));
}

const LAYERS = { 1: pathsFor(1), [-1]: pathsFor(-1) } as Record<number, ReturnType<typeof pathsFor>>;

export function FloatingPaths({ position }: { position: 1 | -1 }) {
  const reduce = usePrefersReducedMotion();
  const paths = LAYERS[position];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full text-ink" viewBox="0 0 696 316" fill="none" preserveAspectRatio="xMidYMin meet">
        {paths.map((p) => {
          const accent = ACCENT.has(p.id);
          const common = {
            d: p.d,
            stroke: accent ? "var(--accent)" : "currentColor",
            strokeWidth: accent ? p.width + 0.4 : p.width,
            strokeOpacity: accent ? 0.7 : 0.08 + p.id * 0.02,
          };
          if (reduce) return <path key={p.id} {...common} />;
          return (
            <motion.path
              key={p.id}
              {...common}
              initial={{ pathLength: 0.3, opacity: 0.6 }}
              animate={{ pathLength: 1, opacity: [0.3, 0.6, 0.3], pathOffset: [0, 1, 0] }}
              transition={{ duration: p.duration, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            />
          );
        })}
      </svg>
    </div>
  );
}
