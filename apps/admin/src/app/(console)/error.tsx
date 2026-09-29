"use client";

import { Button, EmptyState } from "@/components/ui/primitives";
import { solarIcon } from "@/components/icons/solar";

export default function ConsoleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-line bg-surface">
      <EmptyState
        icon={solarIcon("danger-triangle-bold-duotone")}
        title="This page didn't load"
        body={
          <>
            Nothing was changed. Try again; if it keeps failing, share this reference with support:{" "}
            <span className="num text-ink">{error.digest ?? "no-ref"}</span>
          </>
        }
        action={
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
