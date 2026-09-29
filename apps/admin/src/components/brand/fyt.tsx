import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * FYT brand. Source of truth: brand/logo/*.svg
 * Mark: a map pin ("Find") split by a Y ("Your": two paths meeting) into three
 * faceted planes. Below ~24px use `flat` so the Y cut stays legible.
 */
const PIN = "M50 114 C 38 100 12 74 12 48 A38 38 0 0 1 88 48 C 88 74 62 100 50 114 Z";
const Y = "M32.5 29.5 L50 50 L67.5 29.5 M50 50 V79";

export function FytMark({ className, flat, title = "FYT" }: { className?: string; flat?: boolean; title?: string }) {
  const id = React.useId().replace(/:/g, "");
  if (flat) {
    return (
      <svg viewBox="0 0 100 120" className={className} role="img" aria-label={title}>
        <defs>
          <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="120">
            <path d={PIN} fill="#fff" />
            <path d={Y} stroke="#000" strokeWidth="10.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </mask>
        </defs>
        <path d={PIN} fill="#E39B12" mask={`url(#${id}m)`} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 120" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD36B" />
          <stop offset="1" stopColor="#F2AE2A" />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F0A61C" />
          <stop offset="1" stopColor="#D98A08" />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C47300" />
          <stop offset="1" stopColor="#9A5500" />
        </linearGradient>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="120">
          <path d={PIN} fill="#fff" />
          <path d={Y} stroke="#000" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </mask>
      </defs>
      <g mask={`url(#${id}m)`}>
        <polygon points="50,50 -1,-10 101,-10" fill={`url(#${id}t)`} />
        <polygon points="50,50 -1,-10 -10,-10 -10,130 50,130" fill={`url(#${id}l)`} />
        <polygon points="50,50 101,-10 110,-10 110,130 50,130" fill={`url(#${id}r)`} />
      </g>
    </svg>
  );
}

/** Monoline FYT wordmark; the Y carries the marigold accent. Ink follows currentColor. */
export function FytWordmark({ className }: { className?: string }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg viewBox="-2 -2 146 72" className={cn("text-ink", className)} role="img" aria-label="FYT">
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6B632" />
          <stop offset="1" stopColor="#C47300" />
        </linearGradient>
      </defs>
      <path d="M6 6 V62 M6 6 H38 M6 33 H32 M98 6 H136 M117 6 V62" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M52 6 L69 31 L86 6 M69 31 V62" stroke={`url(#${id}w)`} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function FytLockup({ className, markClassName = "h-8 w-auto", wordClassName = "h-5 w-auto" }: { className?: string; markClassName?: string; wordClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <FytMark className={markClassName} />
      <FytWordmark className={wordClassName} />
    </span>
  );
}
