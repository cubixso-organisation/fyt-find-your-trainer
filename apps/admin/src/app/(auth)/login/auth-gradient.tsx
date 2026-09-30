"use client";

/**
 * Ambient ground for the sign-in form column: a slow WebGL mesh gradient
 * (../../../components/ui/gradient-wave.tsx) in the console's own palette.
 *
 * - Light: warm paper, cream, stone and a soft marigold, kept close in value
 *   so it reads as a warm light rather than a picture.
 * - Dark: espresso and ink with one dim marigold glow.
 * Both are the OKLCH tokens in DESIGN.md converted to sRGB hex (WebGL takes
 * RGB), with no blue or purple. The palette follows `<html data-theme>` and
 * crossfades when the theme toggles.
 *
 * Motion is tuned well below Stripe's defaults so it drifts behind the left
 * panel's paths instead of competing with them, and calmer still below `lg`,
 * where the column is the whole page. The form itself sits on a surface card
 * (see ./auth-shell.tsx); only the lockup and toggle touch this ground, and a
 * paper fade at the top keeps them legible. At `lg` a soft paper fade at the
 * inner edge lets the gradient start just past the seam.
 */
import * as React from "react";
import { GradientWave, type GradientDeform } from "@/components/ui/gradient-wave";
import { useDocumentTheme } from "./use-document-theme";

// base, then wave layers (later layers surface less often).
const PALETTE = {
  //         paper      stone      marigold   cream      bright paper
  light: ["#faf6ef", "#ebe3d8", "#f4d5a4", "#faefd6", "#fefbf6"],
  //         ink        espresso   marigold   deep ink   warm stone
  dark: ["#15110e", "#241912", "#5a3a0c", "#0e0c0a", "#2a2119"],
} as const;

const WIDE: Partial<GradientDeform> = { noiseAmp: 150, noiseFlow: 1.4, noiseSpeed: 7 };
const NARROW: Partial<GradientDeform> = { noiseAmp: 110, noiseFlow: 1, noiseSpeed: 6 };

const WIDE_QUERY = "(min-width: 1024px)";
function subscribeWide(cb: () => void) {
  const mq = matchMedia(WIDE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function AuthGradient() {
  const theme = useDocumentTheme();
  const wide = React.useSyncExternalStore(subscribeWide, () => matchMedia(WIDE_QUERY).matches, () => true);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* Still ground in theme tokens: shows before the first WebGL frame
          and stays if WebGL is unavailable. */}
      <div className="absolute inset-0 bg-paper bg-[radial-gradient(60%_45%_at_78%_22%,color-mix(in_oklab,var(--accent)_22%,transparent),transparent_70%),radial-gradient(55%_50%_at_20%_85%,color-mix(in_oklab,var(--ink)_5%,transparent),transparent_70%)]" />
      <GradientWave
        className="absolute inset-0"
        cssFallback={false}
        colors={PALETTE[theme]}
        noiseSpeed={wide ? 2.4e-6 : 1.7e-6}
        deform={wide ? WIDE : NARROW}
        maxPixelRatio={wide ? 1.5 : 1}
        smallScreenPixelRatio={1}
      />
      {/* top: paper fade under the lockup and theme toggle */}
      <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(to_bottom,var(--paper),transparent)]" />
      {/* inner edge: the gradient begins just past the seam */}
      <div className="absolute inset-y-0 left-0 hidden w-28 bg-[linear-gradient(to_right,var(--paper),transparent)] lg:block" />
    </div>
  );
}
