import * as React from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- Button ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type ButtonSize = "sm" | "md" | "lg" | "icon";

// Depth is surface tone plus a 1px line, so a raised button gets its weight
// from an inset top highlight rather than a drop shadow.
const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-paper border border-ink shadow-[inset_0_1px_0_oklch(1_0_0/0.12)] " +
    "hover:bg-ink/88 hover:border-ink/88 active:bg-ink",
  secondary:
    "bg-surface text-ink border border-line hover:border-line-strong hover:bg-sunken active:bg-line/60",
  ghost: "text-ink-2 border border-transparent hover:text-ink hover:bg-sunken active:bg-line/50",
  danger:
    "bg-bad text-paper border border-bad shadow-[inset_0_1px_0_oklch(1_0_0/0.16)] " +
    "hover:bg-bad/90 hover:border-bad/90",
  accent:
    "bg-accent text-accent-ink border border-accent shadow-[inset_0_1px_0_oklch(1_0_0/0.22)] hover:brightness-[1.04]",
};
const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
  icon: "h-9 w-9 justify-center",
};

// Transform and opacity only, 150ms, and only on a state change.
const buttonMotion =
  "transition-[background-color,border-color,color,opacity,transform] duration-150 ease-[var(--ease-out-quart)] " +
  "active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100";

/** Class string for links that look like buttons. */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded-[var(--radius-control)] font-medium",
    buttonMotion,
    variantClass[variant],
    sizeClass[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "group/btn inline-flex select-none items-center whitespace-nowrap rounded-[var(--radius-control)] font-medium",
        buttonMotion,
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 shrink-0 animate-spin" strokeWidth={1.75} aria-hidden /> : null}
      {children}
    </button>
  );
});

/* ---------- Form controls ---------- */

const controlBase =
  "w-full rounded-[var(--radius-control)] border border-line bg-surface text-ink placeholder:text-ink-3 " +
  "shadow-[inset_0_1px_0_oklch(var(--shadow-ink)/0.03)] " +
  "transition-[border-color,box-shadow,background-color] duration-150 ease-[var(--ease-out-quart)] " +
  "hover:border-line-strong " +
  "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/25 " +
  "aria-[invalid=true]:border-bad aria-[invalid=true]:focus-visible:border-bad aria-[invalid=true]:focus-visible:ring-bad/25 " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-sunken disabled:hover:border-line";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(controlBase, "h-9 px-3 text-sm", className)} {...rest} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(controlBase, "min-h-24 px-3 py-2 text-sm leading-relaxed", className)} {...rest} />;
  },
);

// --ink-3 resolves to near the same grey in both themes, so one data URI is
// correct for light and dark. Rounded caps to match the lucide icon set.
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        controlBase,
        "h-9 appearance-none bg-[length:15px] bg-[right_10px_center] bg-no-repeat pl-3 pr-9 text-sm",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23878078' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  optional,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between text-[13px] font-medium text-ink">
        {label}
        {optional ? <span className="text-xs font-normal text-ink-3">Optional</span> : null}
      </label>
      {children}
      {/* Never colour alone: the error carries an icon as well as the red. */}
      {error ? (
        <p id={`${htmlFor}-error`} className="flex items-start gap-1.5 text-[13px] text-bad">
          <AlertCircle className="mt-[2px] size-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-[13px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  id,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border",
        "transition-[background-color,border-color] duration-150 ease-[var(--ease-out-quart)]",
        checked ? "border-ink bg-ink" : "border-line-strong bg-sunken hover:border-ink/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <span
        className={cn(
          "h-3.5 w-3.5 rounded-full bg-paper transition-transform duration-200 ease-[var(--ease-out-quart)]",
          checked ? "translate-x-[18px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

/**
 * The native control is kept — it carries the label, the keyboard and the form
 * value — and the box next to it is drawn so the tick can animate and the
 * mixed state can be shown. `indeterminate` exists only on the DOM node, so it
 * is written there rather than rendered.
 */
export function Checkbox({
  className,
  indeterminate,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { indeterminate?: boolean }) {
  const filled = !!rest.checked || !!indeterminate;

  return (
    <span className={cn("relative inline-grid size-4 shrink-0 place-items-center align-middle", className)}>
      <input
        // A ref callback, not an effect: this module has no "use client" of
        // its own, so it has to stay renderable wherever it is imported.
        ref={(node) => {
          if (node) node.indeterminate = !!indeterminate;
        }}
        type="checkbox"
        className="peer absolute inset-[-4px] size-6 cursor-pointer appearance-none rounded-[6px] outline-none disabled:cursor-not-allowed"
        {...rest}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none relative grid size-4 place-items-center overflow-hidden rounded-[4px] border",
          "transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out-quart)]",
          filled ? "border-ink bg-ink" : "border-line-strong bg-surface",
          "peer-hover:border-ink/70 peer-active:scale-90",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          "peer-disabled:opacity-45",
        )}
      >
        {indeterminate ? (
          <span className="block h-[2px] w-[8px] rounded-full bg-paper" />
        ) : (
          <svg
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "block size-full text-paper transition-[stroke-dashoffset,opacity] duration-150 ease-[var(--ease-out-quart)]",
              rest.checked ? "opacity-100 [stroke-dashoffset:0]" : "opacity-0 [stroke-dashoffset:11]",
            )}
            style={{ strokeDasharray: 11 }}
          >
            {/* Centred on 7,7 and dropped 0.2: a check's long arm pulls the eye up. */}
            <polyline points="3.9 7.35 6.05 9.55 9.9 4.8" />
          </svg>
        )}
      </span>
    </span>
  );
}

/* ---------- Display ---------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-[var(--radius-control)] bg-[linear-gradient(90deg,var(--sunken),var(--line),var(--sunken))] bg-[length:200%_100%] animate-shimmer",
        className,
      )}
    />
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line border-b-line-strong bg-surface px-1 font-mono text-[10.5px] leading-none text-ink-3">
      {children}
    </kbd>
  );
}

export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("rounded-[var(--radius-panel)] border border-line bg-surface", className)} {...rest}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    // Wraps instead of squeezing: when the actions don't fit beside the title
    // they drop to their own line, so the title never collapses to a sliver.
    <header className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line px-5 py-3.5", className)}>
      <div className="min-w-[min(100%,14rem)] flex-1">
        <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">{eyebrow}</div> : null}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-[65ch] text-sm text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: React.ElementType;
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3.5 px-6 py-12 sm:items-center sm:text-center", className)}>
      <div className="grid size-12 place-items-center rounded-[12px] bg-accent-soft text-on-accent-soft ring-1 ring-inset ring-accent/30">
        <Icon className="size-6" strokeWidth={1.5} aria-hidden />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 max-w-[46ch] text-[13px] leading-relaxed text-ink-2">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  // stable hue per name, low chroma so avatars never compete with status color
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span
      aria-hidden
      className={cn("inline-grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold", className)}
      style={{ background: `oklch(0.9 0.04 ${h})`, color: `oklch(0.35 0.06 ${h})` }}
    >
      {initials}
    </span>
  );
}
