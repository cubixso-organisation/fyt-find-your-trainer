"use client";

/**
 * OtpInput: one box per digit for sign-in codes.
 *
 * Interaction adapted from "OTPVerification" on 21st.dev (per-digit inputs
 * that auto-advance, Backspace steps back, paste fills the code). Restyled
 * for the FYT console: paper/ink boxes, marigold focus ring, red border only
 * alongside a written error; no glass or gradients. Added: full-code paste
 * from any box, SMS/email autofill (`autocomplete="one-time-code"` on the
 * first box, which some browsers fill with all six digits at once), numeric
 * keyboard on mobile, arrow keys, and an imperative handle to clear or fill.
 *
 * The joined value is submitted through a hidden input named `name`.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface OtpInputHandle {
  focus(): void;
  clear(): void;
  fill(code: string): void;
}

export interface OtpInputProps {
  length?: number;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  /** Called on every change with the digits so far ("" for gaps). */
  onChange?: (code: string) => void;
  /** Called once every box holds a digit. */
  onComplete?: (code: string) => void;
  "aria-describedby"?: string;
  label?: string;
  className?: string;
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

export const OtpInput = React.forwardRef<OtpInputHandle, OtpInputProps>(function OtpInput(
  {
    length = 6,
    name = "code",
    disabled,
    invalid,
    autoFocus,
    onChange,
    onComplete,
    "aria-describedby": describedBy,
    label = "Verification code",
    className,
  },
  ref,
) {
  const [digits, setDigits] = React.useState<string[]>(() => Array.from({ length }, () => ""));
  const inputs = React.useRef<(HTMLInputElement | null)[]>([]);
  const hidden = React.useRef<HTMLInputElement>(null);

  const focusAt = (i: number) => {
    const el = inputs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  const commit = (next: string[]) => {
    setDigits(next);
    const code = next.join("");
    // Keep the submitted field in step right away: `onComplete` may submit the
    // form in this same tick, before React has re-rendered the hidden input.
    if (hidden.current) hidden.current.value = code;
    onChange?.(code);
    if (next.every((d) => d !== "")) onComplete?.(code);
  };

  /** Writes `chars` starting at box `from`; returns the index after the last one written. */
  const writeFrom = (from: number, chars: string) => {
    const next = [...digits];
    let i = from;
    for (const ch of chars) {
      if (i >= length) break;
      next[i] = ch;
      i += 1;
    }
    commit(next);
    return i;
  };

  React.useImperativeHandle(ref, () => ({
    focus: () => focusAt(digits.findIndex((d) => d === "") === -1 ? length - 1 : digits.findIndex((d) => d === "")),
    clear: () => {
      commit(Array.from({ length }, () => ""));
      requestAnimationFrame(() => focusAt(0));
    },
    fill: (code: string) => {
      const chars = onlyDigits(code).slice(0, length).split("");
      const next = Array.from({ length }, (_, i) => chars[i] ?? "");
      commit(next);
      requestAnimationFrame(() => focusAt(Math.min(chars.length, length - 1)));
    },
  }));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      const after = writeFrom(i, e.key);
      if (after < length) focusAt(after);
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        const next = [...digits];
        next[i] = "";
        commit(next);
      } else if (i > 0) {
        const next = [...digits];
        next[i - 1] = "";
        commit(next);
        focusAt(i - 1);
      }
      return;
    }
    if (e.key === "Delete") {
      e.preventDefault();
      const next = [...digits];
      next[i] = "";
      commit(next);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(i + 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusAt(length - 1);
    }
  };

  // Mobile keyboards (key "Unidentified") and one-time-code autofill land here.
  const onInput = (e: React.ChangeEvent<HTMLInputElement>, i: number) => {
    const old = digits[i];
    let raw = onlyDigits(e.currentTarget.value);
    if (old && raw.length > 1) {
      if (raw.startsWith(old)) raw = raw.slice(old.length);
      else if (raw.endsWith(old)) raw = raw.slice(0, -old.length);
    }
    if (raw === "") {
      const next = [...digits];
      next[i] = "";
      commit(next);
      return;
    }
    const from = raw.length >= length ? 0 : i;
    const after = writeFrom(from, raw);
    focusAt(after >= length ? length - 1 : after);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, i: number) => {
    const raw = onlyDigits(e.clipboardData.getData("text"));
    e.preventDefault();
    if (!raw) return;
    const from = raw.length >= length ? 0 : i;
    const after = writeFrom(from, raw);
    focusAt(after >= length ? length - 1 : after);
  };

  const half = Math.ceil(length / 2);

  return (
    <div role="group" aria-label={`${label}, ${length} digits`} className={cn("flex items-center gap-2", className)}>
      <input ref={hidden} type="hidden" name={name} value={digits.join("")} readOnly />
      {digits.map((d, i) => (
        <React.Fragment key={i}>
          {i === half ? <span aria-hidden className="h-px w-2.5 shrink-0 bg-line-strong" /> : null}
          <input
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={d}
            onChange={(e) => onInput(e, i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onPaste={(e) => onPaste(e, i)}
            onFocus={(e) => e.currentTarget.select()}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && i === 0}
            disabled={disabled}
            aria-label={`Digit ${i + 1} of ${length}`}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              "num h-[52px] w-full min-w-0 flex-1 rounded-[8px] border bg-surface text-center text-[20px] font-medium text-ink caret-accent",
              "transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quart)]",
              "focus:border-ink focus:outline-none focus:ring-4 focus:ring-accent/25 disabled:opacity-60",
              invalid ? "border-bad" : d ? "border-line-strong" : "border-line",
            )}
          />
        </React.Fragment>
      ))}
    </div>
  );
});
