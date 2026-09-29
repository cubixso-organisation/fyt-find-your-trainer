/**
 * Domain types. They mirror the Firestore model in docs/DESIGN-v2.md so the
 * in-memory demo store can be swapped for a Firestore adapter without
 * touching pages.
 */
import type { Role } from "../rbac";

export type ID = string;

export type AdminStatus = "active" | "invited" | "disabled";

export interface Admin {
  id: ID;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  permissions: string[];
  status: AdminStatus;
  passwordHash: string;
  tokenVersion: number;
  createdAt: number;
  lastLoginAt?: number;
  invitedBy?: ID;
}

export type Segment = "student" | "corporate";

export interface Learner {
  id: ID;
  name: string;
  phone: string;
  email?: string;
  segment: Segment;
  area: string;
  // student
  institution?: string;
  // corporate
  company?: string;
  currentRole?: string;
  yearsExperience?: number;
  interests: string[];
  onboarded: boolean;
  createdAt: number;
  lastActiveAt: number;
  blocked: boolean;
}

export interface Institute {
  id: ID;
  name: string;
  area: string;
  address: string;
  phone: string;
  email: string;
  categories: string[];
  specializations: string[];
  galleryCount: number;
  published: boolean;
  featured: boolean;
  createdAt: number;
  updatedAt: number;
}

export type CourseKind = "course" | "project";
export type Mode = "online" | "offline";

export interface Course {
  id: ID;
  kind: CourseKind;
  title: string;
  instituteId?: ID;
  category: string;
  techStack: string[];
  durationWeeks: number;
  modes: Mode[];
  description: string;
  published: boolean;
  featured: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ProviderType = "trainer" | "mentor" | "consultant";

export interface Provider {
  id: ID;
  type: ProviderType;
  name: string;
  isOrganisation: boolean;
  headline: string;
  expertise: string[];
  email: string;
  yearsExperience: number;
  /** Admin-entered display rating (user reviews are Phase 2). */
  rating?: number;
  published: boolean;
  featured: boolean;
  createdAt: number;
  updatedAt: number;
}

export type BookingTarget = "course" | "trainer" | "mentor" | "consultant";
export type BookingStatus = "requested" | "confirmed" | "completed" | "cancelled" | "no_show" | "meet_failed";

export interface Booking {
  id: ID;
  ref: string; // human reference, e.g. BK-4F2K
  learnerId: ID;
  targetType: BookingTarget;
  targetId: ID;
  start: number;
  end: number;
  mode: Mode;
  status: BookingStatus;
  meetLink?: string;
  offlineAddress?: string;
  note?: string;
  cancelledReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AvailabilityRule {
  id: ID;
  targetType: BookingTarget;
  targetId: ID;
  weekday: number; // 0 = Sunday
  startMinute: number; // minutes from midnight IST
  endMinute: number;
  slotMinutes: number;
  mode: Mode;
  capacity: number;
}

export interface Broadcast {
  id: ID;
  title: string;
  body: string;
  audience: "all" | Segment;
  status: "sent" | "scheduled" | "draft";
  scheduledFor?: number;
  sentAt?: number;
  reach?: number;
  createdBy: ID;
  createdAt: number;
}

export interface AuditEntry {
  id: ID;
  at: number;
  actorId: ID;
  actorName: string;
  actorRole: Role;
  action: string; // e.g. "booking.cancel"
  target?: string; // human label
  detail?: string;
  severity: "info" | "notice" | "critical";
}

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  bookingLeadHours: number;
  cancellationWindowHours: number;
  reminderMinutes: number[];
  meetProvider: "google_workspace" | "oauth_account";
  maintenanceMode: boolean;
  categories: string[];
  techStacks: string[];
  homeFeatured: { institutes: ID[]; courses: ID[]; providers: ID[] };
}
