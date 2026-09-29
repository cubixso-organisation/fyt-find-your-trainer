"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./primitives";
import { cn } from "@/lib/utils";

const scrim =
  "fixed inset-0 z-40 bg-ink/25 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out";

/** Right-side editing drawer. Preferred over centered modals for edits. */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "max-w-[520px]",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  const body = React.useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = React.useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={scrim} />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-[var(--shadow-overlay)]",
            "data-[state=open]:animate-drawer-in data-[state=closed]:animate-drawer-out",
            width,
          )}
          // The close button is the least useful place to land. Focus the
          // panel instead, so the first Tab reaches the first real control and
          // a screen reader reads the title before anything else.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const first = body.current?.querySelector<HTMLElement>(
              "input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled])",
            );
            if (first) first.focus();
            else (e.currentTarget as HTMLElement).focus();
          }}
          tabIndex={-1}
        >
          <div
            className={cn(
              "flex shrink-0 items-start justify-between gap-4 border-b px-6 py-4 transition-[border-color,box-shadow] duration-150",
              scrolled ? "border-line shadow-[var(--shadow-pinned)]" : "border-transparent",
            )}
          >
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold tracking-tight text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-[13px] text-ink-2">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">Details</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="-mr-2 shrink-0" aria-label="Close">
                <X className="size-4" strokeWidth={1.75} />
              </Button>
            </Dialog.Close>
          </div>
          <div
            ref={body}
            className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 [scrollbar-width:thin]"
            onScroll={(e) => {
              const next = e.currentTarget.scrollTop > 0;
              if (next !== scrolled) setScrolled(next);
            }}
          >
            {children}
          </div>
          {footer ? (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-sunken/60 px-6 py-3">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Small confirmation for destructive or irreversible actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  tone = "danger",
  onConfirm,
  loading,
  requireText,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  loading?: boolean;
  /** When set, the operator must type this exact text to enable confirm. */
  requireText?: string;
}) {
  const [typed, setTyped] = React.useState("");
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setTyped("");
  }
  const blocked = requireText ? typed.trim() !== requireText : false;
  const confirmId = React.useId();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={scrim} />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-[18vh] z-50 w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2",
            "rounded-[var(--radius-overlay)] border border-line bg-surface p-5 shadow-[var(--shadow-overlay)]",
            "data-[state=open]:animate-rise data-[state=closed]:animate-sink",
          )}
          // With no text gate there is nothing to type, so land on the panel
          // rather than pre-arming the destructive button under the Return key.
          onOpenAutoFocus={requireText ? undefined : (e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          tabIndex={-1}
        >
          <div className="flex gap-3.5">
            {tone === "danger" ? (
              <span
                aria-hidden
                className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[9px] bg-bad-soft text-on-bad-soft ring-1 ring-inset ring-bad/20"
              >
                <AlertTriangle className="size-[18px]" strokeWidth={2} />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-[15px] font-semibold tracking-tight text-ink">{title}</Dialog.Title>
              <Dialog.Description asChild>
                <div className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{body}</div>
              </Dialog.Description>
              {requireText ? (
                <div className="mt-4">
                  <label htmlFor={confirmId} className="block text-[13px] text-ink-2">
                    Type <span className="font-mono font-medium text-ink">{requireText}</span> to confirm
                  </label>
                  <input
                    id={confirmId}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    className={cn(
                      "mt-1.5 h-9 w-full rounded-[var(--radius-control)] border bg-surface px-3 font-mono text-sm text-ink",
                      "transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quart)]",
                      "focus-visible:outline-none focus-visible:ring-3",
                      blocked
                        ? "border-line hover:border-line-strong focus-visible:border-accent focus-visible:ring-accent/25"
                        : "border-ok focus-visible:border-ok focus-visible:ring-ok/25",
                    )}
                  />
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost">Keep as is</Button>
            </Dialog.Close>
            <Button variant={tone} onClick={onConfirm} loading={loading} disabled={blocked}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
