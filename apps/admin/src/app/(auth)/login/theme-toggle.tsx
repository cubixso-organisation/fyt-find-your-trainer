"use client";

/**
 * Light / dark switch for the sign-in page. Same contract as the console's
 * ThemeMenu: the choice lives in localStorage under `tp-theme` and is applied
 * to `<html data-theme>`; the root layout's inline script reads it before
 * paint. A saved "system" choice is honoured until the operator flips it here.
 */
import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useLocalStorage } from "@/components/ui/use-local-storage";
import { useDocumentTheme } from "./use-document-theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [, choose] = useLocalStorage("tp-theme", "light", ["light", "dark", "system"] as const);
  const theme = useDocumentTheme();
  const dark = theme === "dark";

  const flip = React.useCallback(() => {
    const nextTheme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    choose(nextTheme);
  }, [dark, choose]);

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={
        "group relative grid size-9 place-items-center overflow-hidden rounded-full border border-line bg-surface/80 text-ink-2 " +
        "shadow-[0_1px_2px_oklch(var(--shadow-ink)/0.06)] backdrop-blur transition-[color,border-color,transform] duration-150 " +
        "ease-[var(--ease-out-quart)] hover:border-line-strong hover:text-ink active:scale-95 " +
        (className ?? "")
      }
    >
      <Sun
        aria-hidden
        strokeWidth={1.75}
        className={
          "absolute size-[17px] transition-[transform,opacity] duration-300 ease-[var(--ease-out-quart)] " +
          (dark ? "-rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100")
        }
      />
      <Moon
        aria-hidden
        strokeWidth={1.75}
        className={
          "absolute size-[16px] transition-[transform,opacity] duration-300 ease-[var(--ease-out-quart)] " +
          (dark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0")
        }
      />
    </button>
  );
}
