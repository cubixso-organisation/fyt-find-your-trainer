"use client";

/**
 * Adapted from "Split Login" (login-03) by Mohammad Shehadeh / Hirael on
 * 21st.dev — MIT. https://hirael.com/blocks/auth/login-03
 *
 * Restyled for the FYT console: the original drew 36 high-contrast strokes in
 * the primary colour. Here it is a quiet paper texture — ink hairlines at 2-9%
 * opacity, drifting slowly behind the sign-in aside. No accent: marigold is
 * reserved for the one booking that needs an operator.
 */
import { motion, useReducedMotion } from "motion/react";

const PATH_COUNT = 22;

/** Deterministic 0-1 spread so each stroke drifts on its own clock. */
function jitter(i: number) {
  const value = Math.sin(i + 1) * 10_000;
  return value - Math.floor(value);
}

export function FloatingPaths({ position }: { position: number }) {
  const reduceMotion = useReducedMotion();
  const paths = Array.from({ length: PATH_COUNT }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 8}C-${380 - i * 5 * position} -${189 + i * 8} -${
      312 - i * 5 * position
    } ${216 - i * 8} ${152 - i * 5 * position} ${343 - i * 8}C${616 - i * 5 * position} ${470 - i * 8} ${
      684 - i * 5 * position
    } ${875 - i * 8} ${684 - i * 5 * position} ${875 - i * 8}`,
    width: 0.5 + i * 0.035,
  }));

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        // Keep the texture ambient: it fades out before it reaches the
        // lockup at the top or the statement at the bottom.
        maskImage: "linear-gradient(to bottom, transparent 0%, #000 22%, #000 62%, transparent 88%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 22%, #000 62%, transparent 88%)",
      }}
    >
      <svg className="h-full w-full text-ink" fill="none" viewBox="0 0 696 316" preserveAspectRatio="none">
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.07 + path.id * 0.009}
            initial={{ pathLength: 0.35 }}
            animate={reduceMotion ? undefined : { pathLength: 1, pathOffset: [0, 1, 0] }}
            transition={{
              duration: 26 + jitter(path.id) * 14,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  );
}
