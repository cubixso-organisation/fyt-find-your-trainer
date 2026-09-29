import { solarIcon } from "@/components/icons/solar";
import type { Permission } from "@/lib/rbac";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission: Permission;
  badgeKey?: "bookingsAttention";
}

export interface NavGroup {
  heading?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { items: [{ href: "/", label: "Overview", icon: solarIcon("widget-5-bold-duotone"), permission: "overview" }] },
  {
    heading: "Operations",
    items: [
      { href: "/bookings", label: "Bookings", icon: solarIcon("calendar-mark-bold-duotone"), permission: "bookings", badgeKey: "bookingsAttention" },
      { href: "/availability", label: "Availability", icon: solarIcon("clock-circle-bold-duotone"), permission: "availability" },
    ],
  },
  {
    heading: "Catalog",
    items: [
      { href: "/institutes", label: "Institutes", icon: solarIcon("buildings-2-bold-duotone"), permission: "institutes" },
      { href: "/courses", label: "Courses & projects", icon: solarIcon("notebook-bookmark-bold-duotone"), permission: "courses" },
      { href: "/providers", label: "Trainers & mentors", icon: solarIcon("square-academic-cap-bold-duotone"), permission: "providers" },
      { href: "/content", label: "App home & taxonomy", icon: solarIcon("smartphone-2-bold-duotone"), permission: "content" },
    ],
  },
  {
    heading: "Audience",
    items: [
      { href: "/learners", label: "Learners", icon: solarIcon("users-group-rounded-bold-duotone"), permission: "learners" },
      { href: "/broadcasts", label: "Broadcasts", icon: solarIcon("bell-bing-bold-duotone"), permission: "notifications" },
      { href: "/analytics", label: "Analytics", icon: solarIcon("chart-2-bold-duotone"), permission: "analytics" },
    ],
  },
  {
    heading: "Administration",
    items: [
      { href: "/team", label: "Team & roles", icon: solarIcon("shield-user-bold-duotone"), permission: "team" },
      { href: "/audit", label: "Audit log", icon: solarIcon("clipboard-list-bold-duotone"), permission: "audit" },
      { href: "/settings", label: "Platform settings", icon: solarIcon("settings-bold-duotone"), permission: "settings" },
      { href: "/ownership", label: "Ownership", icon: solarIcon("crown-bold-duotone"), permission: "owner" },
    ],
  },
];

export function allNavItems() {
  return NAV.flatMap((g) => g.items);
}
