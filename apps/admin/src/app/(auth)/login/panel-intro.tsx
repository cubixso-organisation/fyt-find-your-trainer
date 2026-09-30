"use client";

/**
 * Copy for the sign-in side panel: one headline that arrives word by word,
 * one supporting line, and three plain capability lines revealed in a gentle
 * stagger. No cards, no data, no social proof.
 *
 * Motion is opacity + translate only (motion/react). Under
 * prefers-reduced-motion the same markup renders static and finished.
 */
import { motion } from "motion/react";
import { CalendarCheck2, ListChecks, Video, type LucideIcon } from "lucide-react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

const HEADLINE = "Every booking, handled in one place.".split(" ");
const SUPPORT = "The operations console for FYT trainers and institutes in Hyderabad.";
const POINTS: { icon: LucideIcon; text: string }[] = [
  { icon: ListChecks, text: "Bookings confirmed from one queue" },
  { icon: Video, text: "Meet links created for you" },
  { icon: CalendarCheck2, text: "Every session on the right trainer's calendar" },
];

const EASE = [0.25, 1, 0.5, 1] as const;
const WORD_STEP = 0.07;
const AFTER_HEADLINE = 0.15 + HEADLINE.length * WORD_STEP;

export function PanelIntro() {
  const reduce = usePrefersReducedMotion();
  const rise = (delay: number, y = 10) =>
    reduce ? {} : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay, ease: EASE } };

  return (
    <>
      <p className="font-display max-w-[460px] text-[44px] font-semibold leading-[1.06] tracking-[-0.025em] text-ink xl:text-[52px]">
        {HEADLINE.map((word, i) => (
          <span key={i}>
            <motion.span className="inline-block" {...rise(0.15 + i * WORD_STEP, 16)}>
              {word}
            </motion.span>
            {i < HEADLINE.length - 1 ? " " : null}
          </span>
        ))}
      </p>

      <motion.p className="mt-5 max-w-[400px] text-[16px] leading-relaxed text-ink-2" {...rise(AFTER_HEADLINE)}>
        {SUPPORT}
      </motion.p>

      <ul className="mt-9 space-y-3.5">
        {POINTS.map(({ icon: Icon, text }, i) => (
          <motion.li key={text} className="flex items-center gap-3.5 text-[15px] text-ink" {...rise(AFTER_HEADLINE + 0.15 + i * 0.1)}>
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface text-ink ring-1 ring-inset ring-line">
              <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
            </span>
            {text}
          </motion.li>
        ))}
      </ul>
    </>
  );
}
