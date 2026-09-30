"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crown, LogOut, Wrench } from "lucide-react";
import { solarIcon } from "@/components/icons/solar";
import { Button, Field, Input, Panel, PanelHeader, Select } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { useServerAction } from "@/components/ui/use-action";
import { setMaintenance, signOutEveryone, transferOwnership } from "./actions";

export function OwnershipClient({
  ownerName,
  candidates,
  activeOperators,
  maintenance,
}: {
  ownerName: string;
  candidates: Array<{ id: string; name: string; email: string }>;
  activeOperators: number;
  maintenance: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [toId, setToId] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmText, setConfirmText] = React.useState("");
  const [transferring, setTransferring] = React.useState(false);
  const [dialog, setDialog] = React.useState<null | "signout" | "maintenance">(null);

  return (
    <div className="flex max-w-[860px] flex-col gap-6">
      <Panel>
        <PanelHeader icon={solarIcon("crown-bold-duotone")} title="Current owner" />
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent-ink">
            <Crown className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <p className="text-[14px] font-medium text-ink">{ownerName}</p>
            <p className="text-[12.5px] text-ink-2">There is exactly one owner. Nobody else can change this account&apos;s role, permissions or status.</p>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader icon={solarIcon("transfer-horizontal-bold-duotone")} title="Transfer ownership" description="Hand the platform to another person, for example when the business changes hands." />
        <div className="flex flex-col gap-4 px-5 py-5">
          {candidates.length === 0 ? (
            <p className="text-[13px] text-ink-2">Ownership can only go to an active super admin. Promote someone to super admin in Team & roles first.</p>
          ) : (
            <>
              <ol className="list-decimal space-y-1 pl-5 text-[13px] text-ink-2">
                <li>The person you choose becomes the owner.</li>
                <li>You become a super admin.</li>
                <li>You are both signed out so the change applies immediately.</li>
              </ol>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="New owner" htmlFor="to">
                  <Select id="to" value={toId} onChange={(e) => setToId(e.target.value)}>
                    <option value="">Choose a super admin…</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Your password" htmlFor="pw" hint="Re-enter it to prove it's you.">
                  <Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
              </div>
              <Field label="Type TRANSFER to confirm" htmlFor="ct">
                <Input id="ct" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="num max-w-[240px]" autoComplete="off" />
              </Field>
              <div>
                <Button
                  variant="danger"
                  disabled={!toId || !password || confirmText.trim() !== "TRANSFER"}
                  loading={transferring}
                  onClick={async () => {
                    setTransferring(true);
                    const r = await transferOwnership({ toId, password, confirmText });
                    setTransferring(false);
                    if (r.ok) {
                      toast.success(r.message);
                      router.push("/login");
                    } else toast.error(r.error);
                  }}
                >
                  <Crown className="size-4" strokeWidth={1.75} /> Transfer ownership
                </Button>
              </div>
            </>
          )}
        </div>
      </Panel>

      <Panel className="border-bad/30">
        <PanelHeader icon={solarIcon("danger-triangle-bold-duotone")} title="Danger zone" />
        <div className="divide-y divide-line">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13.5px] font-medium text-ink">Sign out every operator</p>
              <p className="text-[12.5px] text-ink-2">Signs out {activeOperators} other active operator{activeOperators === 1 ? "" : "s"} on every device. Use after a suspected password leak.</p>
            </div>
            <Button variant="secondary" className="text-bad" onClick={() => setDialog("signout")}>
              <LogOut className="size-4" strokeWidth={1.75} /> Sign everyone out
            </Button>
          </div>
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                Maintenance mode
                {maintenance ? <span className="rounded-[4px] bg-warn-soft px-1.5 text-[11px] font-medium leading-5 text-warn">On</span> : null}
              </p>
              <p className="text-[12.5px] text-ink-2">The app shows a maintenance notice and stops taking new bookings. Existing bookings are kept.</p>
            </div>
            <Button variant="secondary" className={maintenance ? "" : "text-bad"} onClick={() => setDialog("maintenance")}>
              <Wrench className="size-4" strokeWidth={1.75} /> {maintenance ? "Turn off" : "Turn on"}
            </Button>
          </div>
        </div>
      </Panel>

      <ConfirmDialog
        open={dialog === "signout"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Sign out every operator?"
        body="Everyone except you has to sign in again. Work in progress in their open forms is lost."
        confirmLabel="Sign everyone out"
        requireText="SIGN OUT"
        loading={pending === "signout"}
        onConfirm={async () => {
          await run("signout", signOutEveryone);
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === "maintenance"}
        onOpenChange={(v) => !v && setDialog(null)}
        title={maintenance ? "Turn maintenance mode off?" : "Turn maintenance mode on?"}
        body={maintenance ? "Learners can book again as soon as you confirm." : "Learners see a maintenance notice and can't make new bookings until you turn it off."}
        confirmLabel={maintenance ? "Turn off" : "Turn on"}
        tone={maintenance ? "primary" : "danger"}
        loading={pending === "maint"}
        onConfirm={async () => {
          await run("maint", () => setMaintenance(!maintenance));
          setDialog(null);
        }}
      />
    </div>
  );
}
