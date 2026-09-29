"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Runs a server action, toasts the outcome, refreshes server data on success. */
export function useServerAction() {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();
  const run = React.useCallback(
    async (key: string, fn: () => Promise<Result>) => {
      setPending(key);
      try {
        const r = await fn();
        if (r.ok) {
          toast.success(r.message ?? "Saved");
          startTransition(() => router.refresh());
        } else toast.error(r.error);
        return r;
      } catch {
        toast.error("Couldn't reach the server. Check your connection; nothing was changed.");
        return { ok: false, error: "network" } as Result;
      } finally {
        setPending(null);
      }
    },
    [router],
  );
  return { pending, run };
}
