import * as React from "react";

/**
 * Third-party product marks, drawn in one colour (currentColor) so they sit
 * in a row of text without bringing a second palette into the console.
 *
 * Glyph data: Simple Icons (https://simpleicons.org), CC0 1.0.
 * Google Meet is a trademark of Google LLC; the mark is used only to identify
 * links that open in Google Meet. See /credits and NOTICE.md.
 */
const MARKS = {
  "google-meet":
    "M5.53 2.13L0 7.75h5.53zm.398 0v5.62h7.608v3.65l5.47-4.45c-.014-1.22.031-2.25-.025-3.46c-.148-1.09-1.287-1.47-2.236-1.36zM23.1 4.32c-.802.295-1.358.995-2.047 1.49c-2.506 2.05-4.982 4.12-7.468 6.19c3.025 2.59 6.04 5.18 9.065 7.76c1.218.671 1.428-.814 1.328-1.64v-13a.83.83 0 0 0-.877-.825zM.038 8.15v7.7h5.53v-7.7zm13.577 8.1H6.008v5.62c3.864-.006 7.737.011 11.58-.009c1.02-.07 1.618-1.12 1.468-2.07v-2.51l-5.47-4.68v3.65zm-13.577 0c.02 1.44-.041 2.88.033 4.31c.162.948 1.158 1.43 2.047 1.31h3.464v-5.62z",
} as const;

export type BrandMark = keyof typeof MARKS;

export function BrandIcon({
  name,
  className,
  title,
  ...rest
}: { name: BrandMark; className?: string; title?: string } & Omit<React.SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...rest}
    >
      <path d={MARKS[name]} />
    </svg>
  );
}

/** Lucide-shaped component for the Meet mark (strokeWidth is accepted and ignored). */
export function MeetIcon({ className, title }: { className?: string; strokeWidth?: number; title?: string }) {
  return <BrandIcon name="google-meet" className={className} title={title} />;
}
