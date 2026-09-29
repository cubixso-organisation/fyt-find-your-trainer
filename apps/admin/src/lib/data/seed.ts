/**
 * Deterministic demo data for local development and client demos.
 * Every figure the console shows comes from these records, so numbers
 * stay internally consistent. The UI labels the whole console "Demo data"
 * while this store is active.
 */
import { scryptSync, randomBytes } from "node:crypto";
import type {
  Admin,
  AuditEntry,
  AvailabilityException,
  AvailabilityRule,
  Booking,
  BookingStatus,
  BookingTarget,
  Broadcast,
  Course,
  Institute,
  Learner,
  PlatformSettings,
  Provider,
} from "./types";
import { DEFAULT_ADMIN_PERMISSIONS } from "../rbac";
import { addDays, istDateKey, weekdayOf } from "../slots";

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

// mulberry32
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

const AREAS = ["Ameerpet", "Madhapur", "Kukatpally", "Gachibowli", "Dilsukhnagar", "Kondapur", "SR Nagar", "Hitech City", "Begumpet", "Miyapur"];
const CATEGORIES = ["Full Stack", "Data & AI", "Cloud & DevOps", "Testing", "ERP", "Design", "Career"];
const STACKS = ["Java", "Spring Boot", "Python", "React", "Node.js", "AWS", "Azure", "Kubernetes", "Selenium", "Power BI", "SAP FICO", "Salesforce", "Figma", "SQL", "Machine Learning"];

const FIRST = ["Sai Charan", "Harika", "Venkatesh", "Pranavi", "Rohith", "Sravani", "Nikhil", "Keerthana", "Abhiram", "Divya Teja", "Manikanta", "Lahari", "Srikanth", "Bhavya", "Vamshi", "Anusha", "Tarun", "Sahithi", "Karthik", "Meghana", "Akhil", "Hima Bindu", "Rakesh", "Tejaswini", "Yashwanth", "Niharika", "Chaitanya", "Swathi", "Pavan Kalyan", "Ramya Sri"];
const LAST = ["Reddy", "Rao", "Varma", "Goud", "Naidu", "Sharma", "Kondapalli", "Chowdary", "Yadav", "Pillai", "Bandi", "Gunda", "Muppidi", "Thota", "Kasturi"];
const COLLEGES = ["CBIT", "VNR VJIET", "JNTU Hyderabad", "Osmania University", "Vasavi College", "MGIT", "Sreenidhi", "CVR College", "Malla Reddy Engg", "GRIET"];
const COMPANIES = ["Infosys", "TCS", "Deloitte", "Cognizant", "Wipro", "Accenture", "HCLTech", "Tech Mahindra", "Capgemini", "Hexaware"];
const ROLES = ["Associate Engineer", "QA Analyst", "Senior Developer", "Support Engineer", "Business Analyst", "Consultant"];

export interface Dataset {
  admins: Admin[];
  learners: Learner[];
  institutes: Institute[];
  courses: Course[];
  providers: Provider[];
  bookings: Booking[];
  availability: AvailabilityRule[];
  availabilityExceptions: AvailabilityException[];
  broadcasts: Broadcast[];
  audit: AuditEntry[];
  settings: PlatformSettings;
}

export function buildSeed(now = Date.now()): Dataset {
  const r = rng(20260928);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
  const some = <T,>(arr: readonly T[], n: number) => {
    const copy = [...arr];
    const out: T[] = [];
    while (out.length < n && copy.length) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
    return out;
  };
  const id = (p: string, i: number) => `${p}_${(i + 1).toString(36).padStart(3, "0")}`;

  const demoPw = process.env.ADMIN_DEMO_PASSWORD || "Operator@2026";
  const admins: Admin[] = [
    { id: "adm_owner", name: "Chandra Sekhar P.", email: "owner@demo.local", role: "owner", permissions: [], status: "active", passwordHash: hashPassword(demoPw), tokenVersion: 1, createdAt: now - 60 * DAY, lastLoginAt: now - 2 * HOUR },
    { id: "adm_super", name: "Lakshmi Prasanna", email: "super@demo.local", phone: "+91 98480 31764", role: "superadmin", permissions: [], status: "active", passwordHash: hashPassword(demoPw), tokenVersion: 1, createdAt: now - 55 * DAY, lastLoginAt: now - 5 * HOUR, invitedBy: "adm_owner" },
    { id: "adm_ops", name: "Ravi Teja Muppidi", email: "admin@demo.local", phone: "+91 90002 47318", role: "admin", permissions: [...DEFAULT_ADMIN_PERMISSIONS], status: "active", passwordHash: hashPassword(demoPw), tokenVersion: 1, createdAt: now - 40 * DAY, lastLoginAt: now - 26 * HOUR, invitedBy: "adm_super" },
    { id: "adm_content", name: "Sneha Kasturi", email: "sneha@demo.local", role: "admin", permissions: ["overview", "institutes", "courses", "providers", "content"], status: "active", passwordHash: hashPassword(demoPw), tokenVersion: 1, createdAt: now - 21 * DAY, lastLoginAt: now - 3 * DAY, invitedBy: "adm_super" },
    { id: "adm_invited", name: "Arjun Thota", email: "arjun@demo.local", role: "admin", permissions: ["overview", "bookings"], status: "invited", passwordHash: hashPassword(randomBytes(12).toString("hex")), tokenVersion: 1, createdAt: now - 2 * DAY, invitedBy: "adm_super" },
  ];

  const instituteNames = ["Ameerpet CodeWorks", "Kukatpally Data Academy", "Madhapur Cloud Lab", "Gachibowli QA Institute", "SR Nagar Java Point", "Kondapur DevOps Studio", "Begumpet ERP School", "Hitech City Design Room", "Dilsukhnagar Career Hub", "Miyapur Python House", "Deccan Analytics Institute", "Charminar Skills Centre"];
  const institutes: Institute[] = instituteNames.map((name, i) => {
    const area = name.split(" ")[0] === "SR" ? "SR Nagar" : name.split(" ")[0] === "Hitech" ? "Hitech City" : AREAS.find((a) => name.startsWith(a)) ?? pick(AREAS);
    const created = now - (30 + Math.floor(r() * 30)) * DAY;
    return {
      id: id("ins", i),
      name,
      area,
      address: `${Math.floor(r() * 400) + 1}, ${pick(["Maitrivanam", "Aditya Enclave", "Cyber Towers Road", "Main Road", "KPHB Phase 3", "Vivekananda Nagar"])}, ${area}, Hyderabad`,
      phone: `+91 ${pick(["98490", "99490", "90300", "81210", "70130"])} ${Math.floor(10000 + r() * 89999)}`,
      email: `admissions@${name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 14)}.in`,
      categories: some(CATEGORIES, 2 + Math.floor(r() * 2)),
      specializations: some(STACKS, 3),
      gallery: [],
      published: i !== 10,
      featured: i < 4,
      createdAt: created,
      updatedAt: created + Math.floor(r() * 20) * DAY,
    };
  });

  const courseTitles: Array<[string, string, string[]]> = [
    ["Full Stack Java with Spring Boot", "Full Stack", ["Java", "Spring Boot", "React", "SQL"]],
    ["Python for Data Science", "Data & AI", ["Python", "SQL", "Machine Learning"]],
    ["AWS DevOps Engineer Track", "Cloud & DevOps", ["AWS", "Kubernetes"]],
    ["Selenium with Java Automation", "Testing", ["Selenium", "Java"]],
    ["MERN Stack Bootcamp", "Full Stack", ["React", "Node.js"]],
    ["Power BI and Analytics", "Data & AI", ["Power BI", "SQL"]],
    ["SAP FICO Functional", "ERP", ["SAP FICO"]],
    ["Salesforce Admin and Dev", "ERP", ["Salesforce"]],
    ["Azure Cloud Fundamentals", "Cloud & DevOps", ["Azure"]],
    ["UI/UX with Figma", "Design", ["Figma"]],
    ["Generative AI Applications", "Data & AI", ["Python", "Machine Learning"]],
    ["Placement Readiness Program", "Career", ["SQL", "Java"]],
    ["Capstone: Food Delivery App", "Full Stack", ["React", "Node.js", "SQL"]],
    ["Capstone: Retail Sales Dashboard", "Data & AI", ["Power BI", "SQL"]],
    ["Capstone: CI/CD Pipeline on EKS", "Cloud & DevOps", ["AWS", "Kubernetes"]],
    ["Capstone: Test Automation Framework", "Testing", ["Selenium", "Java"]],
  ];
  const courses: Course[] = courseTitles.map(([title, category, techStack], i) => {
    const created = now - (25 + Math.floor(r() * 30)) * DAY;
    const kind = title.startsWith("Capstone") ? "project" : "course";
    return {
      id: id("crs", i),
      kind,
      title,
      instituteId: kind === "course" ? pick(institutes).id : undefined,
      category,
      techStack,
      durationWeeks: kind === "project" ? 4 + Math.floor(r() * 4) : 8 + Math.floor(r() * 16),
      modes: r() > 0.35 ? ["online", "offline"] : ["online"],
      description: `${title}: instructor-led, hands-on, with weekly assignments and interview preparation.`,
      published: i !== 11,
      featured: i < 5,
      createdAt: created,
      updatedAt: created + Math.floor(r() * 10) * DAY,
    };
  });

  const providerSeed: Array<[Provider["type"], string, boolean, string, string[]]> = [
    ["trainer", "Srinivas Kondapalli", false, "Java architect, 14 years in product engineering", ["Java", "Spring Boot", "Microservices"]],
    ["trainer", "Aparna Varma", false, "Data scientist, ex-analytics lead", ["Python", "Machine Learning", "SQL"]],
    ["trainer", "Kiran Goud", false, "DevOps engineer, AWS certified professional", ["AWS", "Kubernetes", "Terraform"]],
    ["trainer", "Byte Forge Trainings", true, "Corporate training partner for IT services firms", ["React", "Node.js", "Testing"]],
    ["trainer", "Nalini Pillai", false, "QA lead, automation frameworks", ["Selenium", "Java", "API testing"]],
    ["trainer", "Mahesh Bandi", false, "SAP FICO consultant, 11 implementations", ["SAP FICO"]],
    ["mentor", "Raghavendra Naidu", false, "VP Engineering at a Hyderabad fintech", ["Engineering leadership", "System design"]],
    ["mentor", "Deepthi Chowdary", false, "Director of Data, global retail GCC", ["Data careers", "Analytics"]],
    ["mentor", "Harsha Vardhan Rao", false, "Principal engineer, cloud platforms", ["Cloud architecture", "Career growth"]],
    ["consultant", "NextStep Careers", true, "Job consultation and interview coaching", ["Resume review", "Mock interviews"]],
    ["consultant", "Abroad Pathways", true, "Higher education consultancy: MS in US, UK, Germany", ["MS admissions", "SOP review"]],
    ["consultant", "Pooja Sharma", false, "Career consultant for career switchers", ["Career switch", "Job search"]],
  ];
  const providers: Provider[] = providerSeed.map(([type, name, isOrganisation, headline, expertise], i) => {
    const created = now - (28 + Math.floor(r() * 25)) * DAY;
    return {
      id: id("prv", i),
      type,
      name,
      isOrganisation,
      headline,
      expertise,
      email: `${name.toLowerCase().split(" ")[0]}@${isOrganisation ? name.toLowerCase().replace(/[^a-z]/g, "") + ".in" : "gmail.com"}`,
      yearsExperience: 5 + Math.floor(r() * 16),
      rating: Math.round((4 + r() * 0.9) * 10) / 10,
      published: i !== 5,
      featured: i === 0 || i === 6 || i === 9,
      createdAt: created,
      updatedAt: created + Math.floor(r() * 12) * DAY,
    };
  });

  const learners: Learner[] = [];
  for (let i = 0; i < 262; i++) {
    const segment = r() < 0.64 ? "student" : "corporate";
    // registrations grow steadily over ~11 weeks since launch
    const ageDays = Math.floor(Math.pow(r(), 1.25) * 78);
    const created = now - ageDays * DAY - Math.floor(r() * 20) * HOUR;
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    learners.push({
      id: id("lrn", i),
      name,
      phone: `+91 ${pick(["9", "8", "7", "6"])}${Math.floor(1000 + r() * 8999)} ${Math.floor(10000 + r() * 89999)}`,
      email: r() > 0.3 ? `${name.toLowerCase().replace(/[^a-z]/g, ".")}${Math.floor(r() * 90)}@gmail.com` : undefined,
      segment,
      area: pick(AREAS),
      institution: segment === "student" ? pick(COLLEGES) : undefined,
      company: segment === "corporate" ? pick(COMPANIES) : undefined,
      currentRole: segment === "corporate" ? pick(ROLES) : undefined,
      yearsExperience: segment === "corporate" ? 1 + Math.floor(r() * 9) : undefined,
      interests: some(STACKS, 2 + Math.floor(r() * 2)),
      onboarded: r() > 0.12,
      createdAt: created,
      lastActiveAt: Math.min(now, created + Math.floor(r() * (now - created))),
      blocked: r() < 0.01,
    });
  }

  const targets: Array<{ type: BookingTarget; id: string; mode: Booking["mode"][] }> = [
    ...courses.filter((c) => c.published).map((c) => ({ type: "course" as const, id: c.id, mode: c.modes })),
    ...providers.filter((p) => p.published).map((p) => ({ type: p.type, id: p.id, mode: ["online"] as Booking["mode"][] })),
  ];
  const weights = targets.map((_, i) => 1 / (1 + i * 0.18)); // some listings pull more demand
  const wsum = weights.reduce((a, b) => a + b, 0);
  const pickTarget = () => {
    let x = r() * wsum;
    for (let i = 0; i < targets.length; i++) if ((x -= weights[i]) <= 0) return targets[i];
    return targets[0];
  };

  const bookings: Booking[] = [];
  const refChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const onboarded = learners.filter((l) => l.onboarded && !l.blocked);
  for (let i = 0; i < 420; i++) {
    const learner = pick(onboarded);
    const t = pickTarget();
    const mode = pick(t.mode);
    // slot between ~9 weeks ago and 10 days ahead, weighted to recent weeks
    const dayOffset = 10 - Math.floor(Math.pow(r(), 1.35) * 72);
    const d = new Date(now + dayOffset * DAY);
    const slotHour = 9 + Math.floor(r() * 10);
    const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), slotHour - 5, r() > 0.5 ? 30 : 0) - 0;
    const end = start + (t.type === "course" ? 60 : 45) * 60_000;
    if (start < learner.createdAt) continue; // can't book before signing up
    const created = Math.max(learner.createdAt, start - (1 + Math.floor(r() * 6)) * DAY);
    let status: BookingStatus;
    if (start > now) {
      const x = r();
      status = x < 0.72 ? "confirmed" : x < 0.9 ? "requested" : x < 0.96 ? "cancelled" : "meet_failed";
      if (status === "meet_failed" && mode === "offline") status = "confirmed";
    } else {
      const x = r();
      status = x < 0.74 ? "completed" : x < 0.86 ? "no_show" : "cancelled";
    }
    const ref = Array.from({ length: 4 }, () => refChars[Math.floor(r() * refChars.length)]).join("");
    const inst = t.type === "course" ? institutes.find((x) => x.id === courses.find((c) => c.id === t.id)?.instituteId) : undefined;
    bookings.push({
      id: id("bkg", i),
      ref: `BK-${ref}`,
      learnerId: learner.id,
      targetType: t.type,
      targetId: t.id,
      start,
      end,
      mode,
      status,
      meetLink: mode === "online" && status !== "meet_failed" && status !== "requested" ? `https://meet.google.com/${ref.toLowerCase()}-${Math.floor(r() * 9000 + 1000)}-abc` : undefined,
      offlineAddress: mode === "offline" ? inst?.address ?? "Ameerpet, Hyderabad" : undefined,
      cancelledReason: status === "cancelled" ? pick(["Learner rescheduled", "Trainer unavailable", "Duplicate booking", "Learner not reachable"]) : undefined,
      createdAt: created,
      updatedAt: created,
    });
  }
  bookings.sort((a, b) => a.start - b.start);

  const availability: AvailabilityRule[] = [];
  let ai = 0;
  for (const t of targets.slice(0, 18)) {
    const days = t.type === "mentor" ? [6] : t.type === "consultant" ? [1, 3, 5] : [1, 2, 3, 4, 5];
    for (const wd of days) {
      availability.push({
        id: id("av", ai++),
        targetType: t.type,
        targetId: t.id,
        weekday: wd,
        startMinute: t.type === "mentor" ? 10 * 60 : 9 * 60 + 30,
        endMinute: t.type === "mentor" ? 13 * 60 : 18 * 60,
        slotMinutes: t.type === "course" ? 60 : 45,
        mode: t.mode[0],
        capacity: t.type === "course" ? 5 : 1,
      });
    }
  }

  // A few date exceptions in the next fortnight, placed on weekdays where the
  // listing actually has weekly windows so the slot preview shows their effect.
  const today = istDateKey(now);
  const next = (weekday: number, after = 1) => {
    let d = addDays(today, after);
    while (weekdayOf(d) !== weekday) d = addDays(d, 1);
    return d;
  };
  const exc = (i: number, e: Omit<AvailabilityException, "id" | "createdBy" | "createdAt">): AvailabilityException => ({
    ...e,
    id: id("avx", i),
    createdBy: "adm_ops",
    createdAt: now - (i + 1) * DAY,
  });
  const javaCourse = courses[0];
  const srinivas = providers[0];
  const mentor = providers[6];
  const availabilityExceptions: AvailabilityException[] = [
    exc(0, { targetType: "trainer", targetId: srinivas.id, date: next(3, 2), kind: "blocked", reason: "On leave: family function" }),
    exc(1, { targetType: "trainer", targetId: srinivas.id, date: next(1, 1), kind: "blocked", startMinute: 14 * 60, endMinute: 16 * 60 + 30, reason: "Client workshop in Gachibowli" }),
    exc(2, { targetType: "trainer", targetId: srinivas.id, date: next(6, 1), kind: "extra", startMinute: 10 * 60, endMinute: 12 * 60 + 15, slotMinutes: 45, mode: "online", capacity: 1, reason: "Saturday catch-up slots" }),
    exc(3, { targetType: "course", targetId: javaCourse.id, date: next(5, 3), kind: "blocked", reason: "Institute closed for the festival" }),
    exc(4, { targetType: "course", targetId: javaCourse.id, date: next(6, 1), kind: "extra", startMinute: 11 * 60, endMinute: 13 * 60, slotMinutes: 60, mode: javaCourse.modes.includes("offline") ? "offline" : "online", capacity: 8, reason: "Weekend walk-in demo" }),
    exc(5, { targetType: "mentor", targetId: mentor.id, date: next(0, 4), kind: "extra", startMinute: 17 * 60, endMinute: 18 * 60 + 30, slotMinutes: 45, mode: "online", capacity: 1, reason: "Sunday evening mentorship hour" }),
  ];

  const broadcasts: Broadcast[] = [
    { id: "bc_001", title: "New AWS DevOps batch", body: "Free demo sessions this Saturday at Madhapur Cloud Lab. Book a slot in the app.", audience: "all", status: "sent", sentAt: now - 9 * DAY, reach: 131, createdBy: "adm_super", createdAt: now - 9 * DAY },
    { id: "bc_002", title: "Mentor hours with engineering leaders", body: "Saturday mentorship slots are open. 45 minutes, one on one.", audience: "corporate", status: "sent", sentAt: now - 4 * DAY, reach: 52, createdBy: "adm_super", createdAt: now - 4 * DAY },
    { id: "bc_003", title: "Placement readiness week", body: "Mock interviews and resume reviews with NextStep Careers.", audience: "student", status: "scheduled", scheduledFor: now + 2 * DAY, createdBy: "adm_super", createdAt: now - 1 * DAY },
  ];

  const audit: AuditEntry[] = [];
  const actors = admins.filter((a) => a.status === "active");
  const actions: Array<[string, AuditEntry["severity"], (i: number) => string]> = [
    ["booking.confirm", "info", () => pick(bookings).ref],
    ["booking.reschedule", "notice", () => pick(bookings).ref],
    ["course.update", "info", () => pick(courses).title],
    ["institute.update", "info", () => pick(institutes).name],
    ["provider.publish", "notice", () => pick(providers).name],
    ["availability.update", "info", () => pick(providers).name],
    ["auth.login", "info", () => "Console"],
  ];
  for (let i = 0; i < 60; i++) {
    const a = pick(actors);
    const [action, severity, target] = pick(actions);
    audit.push({ id: id("aud", i), at: now - Math.floor(r() * 14 * DAY), actorId: a.id, actorName: a.name, actorRole: a.role, action, target: target(i), severity });
  }
  audit.push({ id: "aud_team1", at: now - 2 * DAY, actorId: "adm_super", actorName: "Lakshmi Prasanna", actorRole: "superadmin", action: "team.invite", target: "Arjun Thota (Admin)", severity: "notice" });
  audit.push({ id: "aud_team2", at: now - 21 * DAY, actorId: "adm_super", actorName: "Lakshmi Prasanna", actorRole: "superadmin", action: "team.permissions", target: "Sneha Kasturi", detail: "Granted: content", severity: "critical" });
  audit.sort((a, b) => b.at - a.at);

  const settings: PlatformSettings = {
    platformName: "FYT: Find Your Trainer",
    supportEmail: "support@demo.local",
    bookingLeadHours: 4,
    cancellationWindowHours: 2,
    reminderMinutes: [60, 15],
    meetProvider: "oauth_account",
    maintenanceMode: false,
    categories: CATEGORIES,
    techStacks: STACKS,
    homeFeatured: {
      institutes: institutes.filter((x) => x.featured).map((x) => x.id),
      courses: courses.filter((x) => x.featured).map((x) => x.id),
      providers: providers.filter((x) => x.featured).map((x) => x.id),
    },
  };

  return { admins, learners, institutes, courses, providers, bookings, availability, availabilityExceptions, broadcasts, audit, settings };
}
