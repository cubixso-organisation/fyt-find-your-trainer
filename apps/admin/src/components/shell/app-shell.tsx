"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import {
  ChevronsUpDown,
  ListChecks,
  Lock,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Send,
  Sun,
  UserPlus,
  UserRound,
  CornerDownLeft,
  Database,
} from "lucide-react";
import { NAV, allNavItems, type NavItem } from "./nav";
import { Avatar, Kbd } from "@/components/ui/primitives";
import { RoleBadge } from "@/components/ui/status";
import type { Permission, Role } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/components/ui/use-local-storage";
import { FytMark, FytWordmark } from "@/components/brand/fyt";
import { logout } from "@/app/(auth)/login/actions";

export interface ShellViewer {
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
}

export function AppShell({
  viewer,
  badges,
  demo,
  children,
}: {
  viewer: ShellViewer;
  badges: { bookingsAttention: number };
  demo: boolean;
  children: React.ReactNode;
}) {
  const [collapsedPref, setCollapsedPref] = useLocalStorage("tp-nav-collapsed", "0", ["0", "1"] as const);
  const collapsed = collapsedPref === "1";
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const pathname = usePathname();
  const toggleCollapsed = React.useCallback(() => setCollapsedPref(collapsed ? "0" : "1"), [collapsed, setCollapsedPref]);

  // Close the mobile menu after navigating.
  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  const perms = new Set(viewer.permissions);
  const current = allNavItems()
    .filter((i) => (i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];

  const sidebar = (
    <Sidebar
      viewer={viewer}
      perms={perms}
      badges={badges}
      collapsed={collapsed}
      pathname={pathname}
      onToggle={toggleCollapsed}
      onSearch={() => setPaletteOpen(true)}
    />
  );

  return (
    <Tooltip.Provider delayDuration={250}>
      <div className="flex min-h-[100dvh] bg-paper">
        <div
          className={cn(
            "sticky top-0 hidden h-[100dvh] shrink-0 border-r border-line bg-sunken transition-[width] duration-200 ease-[var(--ease-out-quart)] lg:block",
            collapsed ? "w-[64px]" : "w-[248px]",
          )}
        >
          {sidebar}
        </div>

        <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25 data-[state=open]:animate-fade-in lg:hidden" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[272px] border-r border-line bg-sunken shadow-[var(--shadow-overlay)] data-[state=open]:animate-fade-in lg:hidden">
              <Dialog.Title className="sr-only">Navigation</Dialog.Title>
              <Dialog.Description className="sr-only">Console sections</Dialog.Description>
              <Sidebar
                viewer={viewer}
                perms={perms}
                badges={badges}
                collapsed={false}
                pathname={pathname}
                onSearch={() => {
                  setMobileOpen(false);
                  setPaletteOpen(true);
                }}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur-sm sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid size-9 place-items-center rounded-[var(--radius-control)] text-ink-2 hover:bg-sunken hover:text-ink lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" strokeWidth={1.5} />
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px] text-ink-3">
              <span className="hidden truncate sm:inline">Console</span>
              <span className="hidden sm:inline" aria-hidden>
                /
              </span>
              <span className="truncate font-medium text-ink">{current?.label ?? "Profile"}</span>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              {demo ? (
                <span
                  title="Figures come from seeded demo records, not live Firebase data."
                  className="hidden h-7 items-center gap-1.5 rounded-[5px] border border-dashed border-line-strong px-2 text-[12px] text-ink-2 md:inline-flex"
                >
                  <Database className="size-3.5" strokeWidth={1.75} aria-hidden />
                  Demo data
                </span>
              ) : null}
              <button
                onClick={() => setPaletteOpen(true)}
                className="group hidden h-9 w-60 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[13px] text-ink-3 transition-[border-color,color,background-color] duration-150 ease-[var(--ease-out-quart)] hover:border-line-strong hover:text-ink-2 md:flex"
              >
                <Search className="size-4 transition-colors duration-150 group-hover:text-ink-2" strokeWidth={1.5} aria-hidden />
                Jump to…
                <span className="ml-auto flex gap-1">
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </span>
              </button>
              <ThemeMenu />
              <AccountMenu viewer={viewer} />
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-16 pt-7 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} perms={perms} />
      </div>
    </Tooltip.Provider>
  );
}

function Sidebar({
  viewer,
  perms,
  badges,
  collapsed,
  pathname,
  onToggle,
  onSearch,
}: {
  viewer: ShellViewer;
  perms: Set<Permission>;
  badges: { bookingsAttention: number };
  collapsed: boolean;
  pathname: string;
  onToggle?: () => void;
  onSearch: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center gap-2.5 border-b border-line", collapsed ? "justify-center px-0" : "px-4")}>
        <FytMark className="h-[30px] w-auto shrink-0 drop-shadow-[0_2px_3px_oklch(0.55_0.12_60/0.25)]" />
        {!collapsed ? (
          <div className="min-w-0 leading-tight">
            <FytWordmark className="h-[15px] w-auto" />
            <p className="mt-1 text-[11px] text-ink-3">Operator console</p>
          </div>
        ) : null}
      </div>

      <nav aria-label="Console" className="flex-1 overflow-y-auto px-2.5 py-3 [scrollbar-width:thin]">
        {collapsed ? null : (
          <button
            onClick={onSearch}
            className="mb-3 flex h-8 w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 text-[13px] text-ink-2 transition-colors hover:bg-line/50 hover:text-ink md:hidden"
          >
            <Search className="size-4" strokeWidth={1.5} /> Search
          </button>
        )}
        {NAV.map((group, gi) => {
          const items = group.items.filter((item) => {
            if (perms.has(item.permission)) return true;
            // show grantable-but-locked modules so admins know they exist
            const def = PERMISSIONS.find((p) => p.key === item.permission);
            return def?.minRole === "admin";
          });
          if (!items.length) return null;
          return (
            <div key={gi} className={cn(gi > 0 && "mt-4")}>
              {group.heading && !collapsed ? (
                <p className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{group.heading}</p>
              ) : gi > 0 && collapsed ? (
                <div className="mx-3 mb-2 border-t border-line" />
              ) : null}
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      locked={!perms.has(item.permission)}
                      active={item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/")}
                      collapsed={collapsed}
                      badge={item.badgeKey ? badges[item.badgeKey] : undefined}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className={cn("border-t border-line p-2.5", collapsed && "flex flex-col items-center gap-2")}>
        {!collapsed ? (
          <div className="mb-2 flex items-center gap-2.5 rounded-[var(--radius-control)] px-1.5 py-1">
            <Avatar name={viewer.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{viewer.name}</p>
              <RoleBadge role={viewer.role} className="mt-0.5 h-5 px-1.5 text-[11px]" />
            </div>
          </div>
        ) : null}
        {onToggle ? (
          <button
            onClick={onToggle}
            className={cn(
              "flex h-8 items-center gap-2 rounded-[var(--radius-control)] text-[13px] text-ink-3 transition-colors hover:bg-line/50 hover:text-ink",
              collapsed ? "w-9 justify-center" : "w-full px-2.5",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" strokeWidth={1.5} /> : <PanelLeftClose className="size-4" strokeWidth={1.5} />}
            {!collapsed ? (
              <>
                Collapse <span className="ml-auto flex gap-1"><Kbd>⌘</Kbd><Kbd>\</Kbd></span>
              </>
            ) : null}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
  locked,
  collapsed,
  badge,
}: {
  item: NavItem;
  active: boolean;
  locked: boolean;
  collapsed: boolean;
  badge?: number;
}) {
  const Icon = item.icon;
  const permLabel = PERMISSIONS.find((p) => p.key === item.permission)?.label;
  const inner = (
    <>
      <span className="relative">
        <Icon
          className={cn(
            "size-[18px] shrink-0 transition-[color,transform] duration-150 ease-[var(--ease-out-quart)]",
            active ? "text-[var(--accent)]" : "text-ink-3 group-hover:scale-105 group-hover:text-ink-2",
          )}
          strokeWidth={1.6}
          aria-hidden
        />
        {collapsed && badge ? <span className="absolute -right-1 -top-1 size-2 rounded-full bg-accent ring-2 ring-sunken" /> : null}
      </span>
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
      {!collapsed && locked ? <Lock className="ml-auto size-3.5 text-ink-3" strokeWidth={1.75} aria-label="Locked" /> : null}
      {!collapsed && !locked && badge ? (
        <span className="num ml-auto rounded-[4px] bg-accent px-1.5 text-[11px] font-semibold leading-5 text-accent-ink">{badge}</span>
      ) : null}
    </>
  );
  const cls = cn(
    "group relative flex h-8 items-center gap-2.5 rounded-[var(--radius-control)] text-[13.5px]",
    "transition-[background-color,color,box-shadow] duration-150 ease-[var(--ease-out-quart)]",
    collapsed ? "w-9 justify-center mx-auto" : "px-2.5",
    // The active item lifts onto --surface against the --sunken sidebar; depth
    // is the tone change plus a hairline, never a shadow.
    active
      ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--line)]"
      : "text-ink-2 hover:bg-line/50 hover:text-ink active:scale-[0.98]",
    locked && "text-ink-3 hover:bg-transparent hover:text-ink-3 active:scale-100",
  );

  const node = locked ? (
    <span className={cn(cls, "cursor-not-allowed")} aria-disabled>
      {inner}
    </span>
  ) : (
    <Link href={item.href} className={cls} aria-current={active ? "page" : undefined}>
      {inner}
    </Link>
  );

  if (!collapsed && !locked) return node;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{node}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="z-50 max-w-[240px] rounded-[var(--radius-control)] border border-line bg-raised px-2.5 py-1.5 text-[12.5px] text-ink shadow-[var(--shadow-overlay)] data-[state=delayed-open]:animate-fade-in"
        >
          {locked ? (
            <>
              <span className="font-medium">{item.label} is locked.</span>{" "}
              <span className="text-ink-2">Needs the “{permLabel}” permission. Ask a super admin.</span>
            </>
          ) : (
            item.label
          )}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

const menuContent =
  "z-50 min-w-[200px] rounded-[var(--radius-panel)] border border-line bg-raised p-1 shadow-[var(--shadow-overlay)] data-[state=open]:animate-rise";
const menuItem =
  "flex h-8 cursor-pointer select-none items-center gap-2 rounded-[5px] px-2 text-[13px] text-ink outline-none data-[highlighted]:bg-sunken";

function ThemeMenu() {
  const [theme, choose] = useLocalStorage("tp-theme", "light", ["light", "dark", "system"] as const);
  // Sync the saved choice to the document (external system), following OS changes in "system".
  React.useEffect(() => {
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  const Icon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Theme"
        className="grid size-9 place-items-center rounded-[var(--radius-control)] text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
      >
        <Icon className="size-[18px]" strokeWidth={1.5} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={menuContent}>
          {([
            ["light", "Light", Sun],
            ["dark", "Dark", Moon],
            ["system", "Match system", Monitor],
          ] as const).map(([k, label, I]) => (
            <DropdownMenu.Item key={k} className={menuItem} onSelect={() => choose(k)}>
              <I className="size-4 text-ink-2" strokeWidth={1.5} /> {label}
              {theme === k ? <span className="ml-auto size-1.5 rounded-full bg-accent" /> : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function AccountMenu({ viewer }: { viewer: ShellViewer }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center gap-2 rounded-[var(--radius-control)] py-1 pl-1 pr-2 transition-colors hover:bg-sunken">
        <Avatar name={viewer.name} className="size-7" />
        <ChevronsUpDown className="size-3.5 text-ink-3" strokeWidth={1.75} aria-hidden />
        <span className="sr-only">Account menu</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={cn(menuContent, "w-64")}>
          <div className="px-2 py-2">
            <p className="truncate text-[13px] font-medium text-ink">{viewer.name}</p>
            <p className="num truncate text-[12px] text-ink-3">{viewer.email}</p>
            <RoleBadge role={viewer.role} className="mt-2" />
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild className={menuItem}>
            <Link href="/profile">
              <UserRound className="size-4 text-ink-2" strokeWidth={1.5} /> Profile & security
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item className={cn(menuItem, "text-bad")} onSelect={() => void logout()}>
            <LogOut className="size-4" strokeWidth={1.5} /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function CommandPalette({
  open,
  onOpenChange,
  perms,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  perms: Set<Permission>;
}) {
  const router = useRouter();
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const pages = allNavItems().filter((i) => perms.has(i.permission));
  const actions: Array<{ label: string; href: string; perm: Permission; hint: string; icon: React.ElementType }> = [
    { label: "Review bookings that need action", href: "/bookings?view=attention", perm: "bookings", hint: "Bookings", icon: ListChecks },
    { label: "Add a course or project", href: "/courses?new=1", perm: "courses", hint: "Catalog", icon: Plus },
    { label: "Add an institute", href: "/institutes?new=1", perm: "institutes", hint: "Catalog", icon: Plus },
    { label: "Add a trainer, mentor or consultant", href: "/providers?new=1", perm: "providers", hint: "Catalog", icon: Plus },
    { label: "Send a broadcast", href: "/broadcasts?new=1", perm: "notifications", hint: "Audience", icon: Send },
    { label: "Invite an operator", href: "/team?invite=1", perm: "team", hint: "Team", icon: UserPlus },
  ];
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-40 bg-ink/25 animate-fade-in"
      contentClassName="fixed left-1/2 top-[14vh] z-50 w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-[var(--radius-overlay)] border border-line bg-raised shadow-[var(--shadow-overlay)] animate-rise"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} aria-hidden />
        <Command.Input
          placeholder="Jump to a page or action"
          className="h-12 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
        />
      </div>
      <Command.List className="max-h-[min(52vh,400px)] overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]">
        <Command.Empty className="flex flex-col items-center gap-1 px-3 py-10 text-center">
          <span className="text-[13px] font-medium text-ink">No match</span>
          <span className="text-[12.5px] text-ink-2">No page or action matches that.</span>
        </Command.Empty>
        <Command.Group heading="Pages" className={paletteGroup}>
          {pages.map((p) => (
            <Command.Item key={p.href} value={`page ${p.label}`} onSelect={() => go(p.href)} className={paletteItem}>
              <p.icon className={paletteIcon} strokeWidth={1.5} aria-hidden />
              {p.label}
              <CornerDownLeft className={paletteEnter} strokeWidth={1.75} aria-hidden />
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Actions" className={cn("mt-1", paletteGroup)}>
          {actions
            .filter((a) => perms.has(a.perm))
            .map((a) => (
              <Command.Item key={a.href} value={`action ${a.label}`} onSelect={() => go(a.href)} className={paletteItem}>
                <a.icon className={paletteIcon} strokeWidth={1.5} aria-hidden />
                <span className="truncate">{a.label}</span>
                <span className="ml-auto shrink-0 text-[12px] text-ink-3 group-data-[selected=true]:hidden">{a.hint}</span>
                <CornerDownLeft className={paletteEnter} strokeWidth={1.75} aria-hidden />
              </Command.Item>
            ))}
        </Command.Group>
      </Command.List>
      {/* The keys that drive the palette, where an operator can see them. */}
      <div className="flex items-center gap-4 border-t border-line bg-sunken/50 px-4 py-2 text-[11.5px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> Move
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd> Open
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Kbd>Esc</Kbd> Close
        </span>
      </div>
    </Command.Dialog>
  );
}

const paletteGroup =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-ink-3";
const paletteItem =
  "group flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-[6px] px-2.5 text-[13.5px] text-ink " +
  "transition-colors duration-100 ease-[var(--ease-out-quart)] data-[selected=true]:bg-sunken";
const paletteIcon =
  "size-4 shrink-0 text-ink-3 transition-colors duration-100 group-data-[selected=true]:text-[var(--accent)]";
const paletteEnter =
  "ml-auto hidden size-3.5 shrink-0 text-ink-3 group-data-[selected=true]:block";
