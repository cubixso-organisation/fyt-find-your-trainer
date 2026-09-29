"use client";

import * as React from "react";

type Theme = "light" | "dark";

function subscribe(cb: () => void) {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** The theme actually applied to `<html data-theme>`, kept live. */
export function useDocumentTheme(): Theme {
  return React.useSyncExternalStore(subscribe, read, () => "light");
}
