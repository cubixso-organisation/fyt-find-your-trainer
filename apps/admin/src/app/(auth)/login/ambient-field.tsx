"use client";

/**
 * Ambient backdrop for the sign-in page: a hairline dot field in ink, faded
 * out toward the edges, plus one low-opacity marigold glow that trails the
 * cursor on a spring. Pointer tracking writes motion values only, so nothing
 * re-renders per frame. Under reduced motion, or on touch screens, the glow
 * rests in place and the page is otherwise identical.
 */
import * as React from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "motion/react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

export function AmbientField() {
  const reduce = usePrefersReducedMotion();
  const x = useMotionValue(72);
  const y = useMotionValue(28);
  const sx = useSpring(x, { stiffness: 60, damping: 20, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 60, damping: 20, mass: 0.6 });
  const glow = useMotionTemplate`radial-gradient(520px circle at ${sx}% ${sy}%, color-mix(in oklch, var(--accent) 13%, transparent), transparent 70%)`;

  React.useEffect(() => {
    if (reduce) return;
    if (!matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      x.set((e.clientX / window.innerWidth) * 100);
      y.set((e.clientY / window.innerHeight) * 100);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, x, y]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Dot field */}
      <div
        className="absolute inset-0 opacity-70 dark:opacity-60"
        style={{
          backgroundImage: "radial-gradient(color-mix(in oklch, var(--ink) 16%, transparent) 1px, transparent 1.2px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(120% 90% at 50% 40%, #000 30%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(120% 90% at 50% 40%, #000 30%, transparent 85%)",
        }}
      />
      {/* Cursor glow */}
      <motion.div className="absolute inset-0" style={{ background: glow }} />
      {/* Paper vignette to settle the edges */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(140% 100% at 50% 0%, transparent 55%, color-mix(in oklch, var(--paper) 80%, transparent) 100%)" }}
      />
    </div>
  );
}
