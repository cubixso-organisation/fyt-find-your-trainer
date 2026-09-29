"use client";

import * as React from "react";

const EVENT = "tp-local-storage";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * A localStorage value as external state (useSyncExternalStore), so reading
 * saved preferences never needs setState inside an effect and never causes a
 * hydration mismatch: the server snapshot is always `fallback`.
 */
export function useLocalStorage<T extends string>(key: string, fallback: T, allowed?: readonly T[]) {
  const subscribe = React.useCallback((cb: () => void) => {
    const onStorage = (e: StorageEvent) => e.key === key && cb();
    const onLocal = (e: Event) => (e as CustomEvent<string>).detail === key && cb();
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT, onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT, onLocal);
    };
  }, [key]);
  const raw = React.useSyncExternalStore(subscribe, () => read(key), () => null);
  const value = (raw !== null && (!allowed || allowed.includes(raw as T)) ? raw : fallback) as T;
  const set = React.useCallback(
    (v: T) => {
      try {
        localStorage.setItem(key, v);
      } catch {}
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    },
    [key],
  );
  return [value, set] as const;
}
