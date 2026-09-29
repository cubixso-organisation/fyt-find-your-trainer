"use client";

import * as React from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void) {
  const mq = matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Hydration-safe `prefers-reduced-motion`: false on the server and during
 * hydration, then the real value — so server and client markup always agree.
 */
export function usePrefersReducedMotion() {
  return React.useSyncExternalStore(subscribe, () => matchMedia(QUERY).matches, () => false);
}
