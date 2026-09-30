"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy, Info, LogOut, Minus, UserPlus} from "lucide-react";
import type { Admin } from "@/lib/data/types";
import { ALWAYS_GRANTED, DEFAULT_ADMIN_PERMISSIONS, ROLE_LABEL, canManage, type Permission, type Role } from "@/lib/rbac";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar, Button, Checkbox, Field, Input, Panel, PanelHeader } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/choice";
import { ConfirmDialog, Drawer } from "@/components/ui/overlays";
import { AdminStatusPill, RoleBadge } from "@/components/ui/status";
import { useServerAction } from "@/components/ui/use-action";
import { cn, relTime } from "@/lib/utils";
import { changeRole, inviteOperator, removeInvite, revokeSessions, setOperatorStatus, updatePermissions } from "./actions";
import { solarIcon } from "@/components/icons/solar";

type Operator = Omit<Admin, "passwordHash" | "tokenVersion"> & { invitedByName?: string };
interface PermDef {
  key: Permission;
  label: string;
  description: string;
  minRole: Role;
  sensitive: boolean;
}

export function TeamClient({
  operators,
  viewer,
  assignable,
  permissionDefs,
  openInvite,
  now,
}: {
  operators: Operator[];
  viewer: { id: string; role: Role };
  assignable: Role[];
  permissionDefs: PermDef[];
  openInvite: boolean;
  now: number;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = React.useState(openInvite);
  const open = operators.find((o) => o.id === openId) ?? null;
  const grantable = permissionDefs.filter((p) => p.minRole === "admin");

  const counts = {
    owner: operators.filter((o) => o.role === "owner").length,
    superadmin: operators.filter((o) => o.role === "superadmin" && o.status !== "disabled").length,
    admin: operators.filter((o) => o.role === "admin" && o.status !== "disabled").length,
  };

  const columns: Column<Operator>[] = [
    {
      key: "name",
      header: "Operator",
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={r.name} />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {r.name}
              {r.id === viewer.id ? <span className="ml-1.5 text-[12px] font-normal text-ink-3">(you)</span> : null}
            </p>
            <p className="num truncate text-[12px] text-ink-3">{r.email}</p>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Role", sortValue: (r) => ({ owner: 0, superadmin: 1, admin: 2 })[r.role], cell: (r) => <RoleBadge role={r.role} /> },
    {
      key: "access",
      header: "Access",
      hideBelow: "md",
      cell: (r) =>
        r.role === "admin" ? (
          <span className="text-ink-2">
            <span className="num text-ink">{r.permissions.length}</span> of {grantable.length} modules
          </span>
        ) : (
          <span className="text-ink-2">{r.role === "owner" ? "Everything" : "All operations + team"}</span>
        ),
    },
    { key: "status", header: "Status", sortValue: (r) => r.status, cell: (r) => <AdminStatusPill status={r.status} /> },
    {
      key: "last",
      header: "Last sign-in",
      hideBelow: "lg",
      sortValue: (r) => r.lastLoginAt ?? 0,
      cell: (r) => <span className="text-[12.5px] text-ink-2">{r.lastLoginAt ? relTime(r.lastLoginAt, now) : "Never"}</span>,
    },
    { key: "by", header: "Invited by", hideBelow: "xl", cell: (r) => <span className="text-[12.5px] text-ink-3">{r.invitedByName ?? "Platform setup"}</span> },
  ];

  return (
    <>
      <section aria-label="Roles" className="mb-6 grid grid-cols-1 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface md:grid-cols-3">
        <RoleCell
          icon={solarIcon("crown-bold-duotone")}
          role="Owner"
          count={counts.owner}
          body="The client. Holds every permission and can't be demoted or disabled by anyone. Manages super admins and can transfer ownership."
          you={viewer.role === "owner"}
        />
        <RoleCell
          icon={solarIcon("shield-user-bold-duotone")}
          role="Super admin"
          count={counts.superadmin}
          body="Runs operations. Invites admins, sets their permissions, edits platform settings and reads the audit log. Can't touch other super admins."
          you={viewer.role === "superadmin"}
          className="border-t border-line md:border-l md:border-t-0"
        />
        <RoleCell
          icon={solarIcon("user-rounded-bold-duotone")}
          role="Admin"
          count={counts.admin}
          body="Staff. Sees only the modules granted to them. Personal data, broadcasts and analytics start switched off."
          you={viewer.role === "admin"}
          className="border-t border-line md:border-l md:border-t-0"
        />
      </section>

      <DataTable
        caption="Operators"
        rows={operators}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
        search={(r) => `${r.name} ${r.email}`}
        searchPlaceholder="Search name or email"
        filters={[
          { key: "role", label: "Role", options: (["owner", "superadmin", "admin"] as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] })), test: (r, v) => r.role === v },
          { key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "invited", label: "Invite pending" }, { value: "disabled", label: "Disabled" }], test: (r, v) => r.status === v },
        ]}
        toolbar={
          assignable.length ? (
            <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-4" strokeWidth={1.75} /> Invite operator
            </Button>
          ) : null
        }
        empty={{ icon: solarIcon("users-group-rounded-bold-duotone"), title: "No operators", body: "Invite the people who will run the console." }}
      />

      <PermissionMatrix defs={permissionDefs} />

      <OperatorDrawer operator={open} viewer={viewer} assignable={assignable} grantable={grantable} onClose={() => setOpenId(null)} />
      <InviteDrawer open={inviteOpen} onOpenChange={setInviteOpen} assignable={assignable} grantable={grantable} />
    </>
  );
}

function RoleCell({ icon: Icon, role, count, body, you, className }: { icon: React.ElementType; role: string; count: number; body: string; you: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 px-5 py-4", className)}>
      <div className="flex items-center gap-2">
        <Icon className="size-5 text-[var(--accent)]" strokeWidth={1.6} aria-hidden />
        <p className="text-[13.5px] font-semibold text-ink">{role}</p>
        <span className="num text-[12.5px] text-ink-3">{count}</span>
        {you ? <span className="ml-auto rounded-[4px] bg-accent-soft px-1.5 text-[11px] font-medium leading-5 text-accent-ink">Your role</span> : null}
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}

function PermissionMatrix({ defs }: { defs: PermDef[] }) {
  const cell = (d: PermDef, role: Role) => {
    if (role === "owner") return <Yes />;
    if (role === "superadmin") return d.minRole === "owner" ? <No /> : <Yes />;
    if (d.key === ALWAYS_GRANTED) return <Yes />;
    if (d.minRole !== "admin") return <No />;
    return <span className="text-[12px] text-ink-2">{d.sensitive ? "If granted" : "Default on"}</span>;
  };
  return (
    <Panel className="mt-6">
      <PanelHeader icon={solarIcon("shield-check-bold-duotone")} title="What each role can do" description="Enforced on the server for every page and action, not just hidden in the menu." />
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Permission matrix</caption>
          <thead className="bg-sunken/70 text-left text-[12px] text-ink-2">
            <tr>
              <th scope="col" className="px-5 py-2.5 font-medium">Module</th>
              <th scope="col" className="w-28 px-3 py-2.5 text-center font-medium">Owner</th>
              <th scope="col" className="w-28 px-3 py-2.5 text-center font-medium">Super admin</th>
              <th scope="col" className="w-28 px-3 py-2.5 text-center font-medium">Admin</th>
            </tr>
          </thead>
          <tbody>
            {defs.map((d) => (
              <tr key={d.key} className="border-t border-line">
                <th scope="row" className="px-5 py-2.5 text-left font-normal">
                  <p className="font-medium text-ink">{d.label}</p>
                  <p className="text-[12px] text-ink-3">{d.description}</p>
                </th>
                <td className="px-3 text-center">{cell(d, "owner")}</td>
                <td className="px-3 text-center">{cell(d, "superadmin")}</td>
                <td className="px-3 text-center">{cell(d, "admin")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const Yes = () => <Check className="mx-auto size-4 text-ok" strokeWidth={2.25} aria-label="Yes" />;
const No = () => <Minus className="mx-auto size-4 text-ink-3" strokeWidth={2} aria-label="No" />;

function PermissionPicker({ grantable, value, onChange, disabled }: { grantable: PermDef[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <ul className="divide-y divide-line rounded-[var(--radius-panel)] border border-line">
      {grantable.map((p) => {
        const fixed = p.key === ALWAYS_GRANTED;
        const on = fixed || value.includes(p.key);
        return (
          <li key={p.key}>
            <label className={cn("flex items-start gap-3 px-4 py-2.5", !(disabled || fixed) && "cursor-pointer hover:bg-sunken/50")}>
              <Checkbox
                className="mt-0.5"
                checked={on}
                disabled={disabled || fixed}
                onChange={() => onChange(on ? value.filter((x) => x !== p.key) : [...value, p.key])}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                  {p.label}
                  {fixed ? <span className="text-[11.5px] font-normal text-ink-3">Always on</span> : null}
                  {p.sensitive ? <span className="rounded-[4px] bg-warn-soft px-1.5 text-[11px] font-medium leading-[18px] text-warn">Sensitive</span> : null}
                </span>
                <span className="block text-[12.5px] text-ink-2">{p.description}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function OperatorDrawer({
  operator: o,
  viewer,
  assignable,
  grantable,
  onClose,
}: {
  operator: Operator | null;
  viewer: { id: string; role: Role };
  assignable: Role[];
  grantable: PermDef[];
  onClose: () => void;
}) {
  const { pending, run } = useServerAction();
  const [perms, setPerms] = React.useState<string[]>(o?.permissions ?? []);
  const [role, setRole] = React.useState<Role>(o?.role ?? "admin");
  const [confirm, setConfirm] = React.useState<null | "disable" | "role" | "withdraw">(null);
  const [base, setBase] = React.useState(o);
  if (base !== o) {
    setBase(o);
    if (o) {
      setPerms(o.permissions);
      setRole(o.role);
    }
  }
  if (!o) return <Drawer open={false} onOpenChange={() => {}} title="">{null}</Drawer>;

  const manageable = canManage(viewer, o);
  const why =
    o.id === viewer.id
      ? "This is your own account. Another super admin or the owner has to change your access."
      : o.role === "owner"
        ? "The owner can't be changed by anyone. Ownership only moves when the owner transfers it."
        : !manageable
          ? `Only the owner can manage ${ROLE_LABEL[o.role].toLowerCase()}s.`
          : null;
  const permsDirty = o.role === "admin" && [...perms].sort().join() !== [...o.permissions].sort().join();

  return (
    <Drawer
      icon={solarIcon("shield-user-bold-duotone")}
      open
      onOpenChange={(v) => !v && onClose()}
      title={o.name}
      description={<span className="num">{o.email}</span>}
      width="max-w-[580px]"
      footer={
        manageable ? (
          <>
            {o.status === "invited" ? (
              <Button variant="ghost" className="mr-auto text-bad hover:text-bad" onClick={() => setConfirm("withdraw")}>Withdraw invite</Button>
            ) : o.status === "active" ? (
              <Button variant="ghost" className="mr-auto text-bad hover:text-bad" onClick={() => setConfirm("disable")}>Disable access</Button>
            ) : (
              <Button variant="ghost" className="mr-auto" loading={pending === "enable"} onClick={() => run("enable", () => setOperatorStatus({ id: o.id, status: "active" }))}>
                Restore access
              </Button>
            )}
            {o.role === "admin" ? (
              <Button variant="primary" disabled={!permsDirty} loading={pending === "perms"} onClick={() => run("perms", () => updatePermissions({ id: o.id, permissions: perms }))}>
                Save permissions
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <RoleBadge role={o.role} />
          <AdminStatusPill status={o.status} />
          <span className="text-[12.5px] text-ink-3">
            {o.lastLoginAt ? `Last signed in ${relTime(o.lastLoginAt)}` : "Hasn't signed in yet"}
          </span>
        </div>

        {why ? (
          <div className="flex items-start gap-2.5 rounded-[var(--radius-control)] bg-sunken px-3.5 py-3 text-[13px] text-ink-2">
            <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <p>{why}</p>
          </div>
        ) : null}

        {manageable && assignable.length > 1 ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-[13.5px] font-semibold text-ink">Role</h3>
            <div className="flex items-center gap-3">
              <Segmented label="Role" value={role as "superadmin" | "admin"} onChange={(v) => setRole(v)} options={assignable.map((r) => ({ value: r as "superadmin" | "admin", label: ROLE_LABEL[r] }))} />
              {role !== o.role ? (
                <Button size="sm" variant="primary" onClick={() => setConfirm("role")}>
                  Apply role
                </Button>
              ) : null}
            </div>
            <p className="text-[12.5px] text-ink-3">Changing a role signs them out so the new access applies immediately.</p>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <h3 className="text-[13.5px] font-semibold text-ink">Module access</h3>
          {o.role === "admin" ? (
            <PermissionPicker grantable={grantable} value={perms} onChange={setPerms} disabled={!manageable} />
          ) : (
            <p className="text-[13px] text-ink-2">
              {o.role === "owner" ? "The owner holds every permission, including ownership controls." : "Super admins hold every operational module plus team, settings and the audit log."}
            </p>
          )}
        </section>

        {manageable && o.status === "active" ? (
          <section className="flex items-center justify-between gap-4 rounded-[var(--radius-panel)] border border-line px-4 py-3">
            <div>
              <p className="text-[13.5px] font-medium text-ink">Sign out everywhere</p>
              <p className="text-[12.5px] text-ink-2">Ends every open session. Use this if a laptop was lost or shared.</p>
            </div>
            <Button size="sm" loading={pending === "revoke"} onClick={() => run("revoke", () => revokeSessions(o.id))}>
              <LogOut className="size-3.5" strokeWidth={1.75} /> Sign out
            </Button>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirm === "disable"}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Disable ${o.name}?`}
        body="They are signed out right away and can't sign in until access is restored. Their past actions stay in the audit log."
        confirmLabel="Disable access"
        loading={pending === "disable"}
        onConfirm={async () => {
          await run("disable", () => setOperatorStatus({ id: o.id, status: "disabled" }));
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm === "withdraw"}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Withdraw the invite for ${o.email}?`}
        body="The invite link stops working. You can invite them again later."
        confirmLabel="Withdraw invite"
        loading={pending === "withdraw"}
        onConfirm={async () => {
          const r = await run("withdraw", () => removeInvite(o.id));
          setConfirm(null);
          if (r.ok) onClose();
        }}
      />
      <ConfirmDialog
        open={confirm === "role"}
        onOpenChange={(v) => !v && setConfirm(null)}
        tone="primary"
        title={`Make ${o.name} ${ROLE_LABEL[role].toLowerCase()}?`}
        body={
          role === "superadmin"
            ? "Super admins can invite admins, change their permissions, edit platform settings and read the audit log."
            : "They lose team, settings and audit access. Module access resets to Overview only; grant what they need afterwards."
        }
        confirmLabel="Change role"
        loading={pending === "role"}
        onConfirm={async () => {
          await run("role", () => changeRole({ id: o.id, role: role as "superadmin" | "admin" }));
          setConfirm(null);
        }}
      />
    </Drawer>
  );
}

function InviteDrawer({ open, onOpenChange, assignable, grantable }: { open: boolean; onOpenChange: (v: boolean) => void; assignable: Role[]; grantable: PermDef[] }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"superadmin" | "admin">("admin");
  const [perms, setPerms] = React.useState<string[]>([...DEFAULT_ADMIN_PERMISSIONS]);
  const [link, setLink] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setRole("admin");
    setPerms([...DEFAULT_ADMIN_PERMISSIONS]);
    setLink(null);
  };

  return (
    <Drawer
      icon={solarIcon("user-plus-rounded-bold-duotone")}
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
      title="Invite an operator"
      description="They set their own password from the invite link."
      width="max-w-[580px]"
      footer={
        link ? (
          <Button variant="primary" onClick={() => { onOpenChange(false); reset(); }}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={pending}
              onClick={async () => {
                setPending(true);
                const r = await inviteOperator({ name, email, role, permissions: perms });
                setPending(false);
                if (r.ok) {
                  toast.success(r.message ?? "Invite created");
                  setLink(r.inviteUrl ? `${window.location.origin}${r.inviteUrl}` : null);
                } else toast.error(r.error);
              }}
            >
              Create invite
            </Button>
          </>
        )
      }
    >
      {link ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-[var(--radius-panel)] border border-line bg-ok-soft/50 px-4 py-3">
            <p className="text-[13.5px] font-medium text-ink">Invite created for {email}</p>
            <p className="mt-1 text-[12.5px] text-ink-2">
              Email delivery switches on with Firebase. For now, send this link yourself. It is shown once.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input readOnly value={link} className="num text-[12.5px]" onFocus={(e) => e.currentTarget.select()} />
            <Button onClick={() => { void navigator.clipboard.writeText(link); toast.success("Invite link copied"); }}>
              <Copy className="size-4" strokeWidth={1.75} /> Copy
            </Button>
          </div>
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="iname">
              <Input id="iname" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Work email" htmlFor="iemail">
              <Input id="iemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          {assignable.length > 1 ? (
            <Field label="Role" htmlFor="irole" hint={role === "superadmin" ? "Only the owner can invite super admins." : undefined}>
              <Segmented label="Role" value={role} onChange={setRole} options={assignable.map((r) => ({ value: r as "superadmin" | "admin", label: ROLE_LABEL[r] }))} />
            </Field>
          ) : null}
          {role === "admin" ? (
            <Field label="Module access" htmlFor="iperms" hint="Sensitive modules start off. Grant only what their job needs.">
              <PermissionPicker grantable={grantable} value={perms} onChange={setPerms} />
            </Field>
          ) : (
            <p className="rounded-[var(--radius-control)] bg-sunken px-3.5 py-3 text-[13px] text-ink-2">
              Super admins get every operational module, team management, settings and the audit log.
            </p>
          )}
        </form>
      )}
    </Drawer>
  );
}
