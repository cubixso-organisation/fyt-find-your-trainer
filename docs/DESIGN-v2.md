# Design v2: Training & Education Platform (Phase 1, per signed contract)

Session: TRN-20260928-c20456ad · Date: 2026-09-28 · Status: DRAFT
Supersedes: docs/DESIGN-v1.md (LMS/multi-tenant design — wrong product, discarded)
Source of truth: signed agreement "Training & Education Platform — Complete Development &
Onboarding Agreement" (CUBIXSO ↔ Chandra Sekhar Puchalapalli, signed 2026-04-24/25).
Where this doc and the contract disagree, the contract wins.

## 1. Product
A one-stop **aggregator/marketplace** for Hyderabad's training ecosystem (think Naresh IT and
peers). Students and corporate employees discover institutes, courses/projects, trainers,
mentors, and consultants, then **book demo / consultation / mentorship sessions**. All
listings are created by the admin. There are no user-generated listings and no provider logins in Phase 1.

Two app user segments: **Student** and **Corporate Employee** (different onboarding and
home-feed emphasis). One web user type: **Admin** (role-based: owner, editor).

### Out of Phase 1 (contract Phase 2)
Payments, ratings & reviews submitted by users, chat, video hosting, certificates, referrals,
advanced analytics, multi-language. Any request for these goes through a Change Request (§7.5).
Note: the contract shows "ratings"/"reviews" on trainer and mentor pages (§2.5, §2.6). In
Phase 1 these are **admin-entered display values**, not user-submitted.

## 2. Stack (contract §5)
| Layer | Choice |
|---|---|
| Mobile | Flutter (Dart), Riverpod, go_router, firebase_auth, cloud_firestore, firebase_messaging, Crashlytics |
| Admin | Next.js (App Router) + shadcn/ui, Firebase client SDK for auth, Admin SDK in server actions |
| Backend | Firebase: Auth (phone OTP), Firestore, Cloud Functions (TS, 2nd gen), Storage, FCM, Cloud Scheduler |
| Meet links | Google Calendar API `events.insert` with `conferenceData.createRequest` |
| Hosting | Admin on Vercel (custom domain) |
| CI | GitHub Actions (client-owned org) |
| Design | Figma: brand kit, wireframes, prototypes. The client must approve them before development starts. |

All accounts are created in the **client's name** (§7.7, §8.1).

## 3. Repo layout
```
apps/mobile/        Flutter app
apps/admin/         Next.js admin dashboard
firebase/
  functions/        TS Cloud Functions (booking, meet, notifications, analytics)
  firestore.rules   storage.rules   firestore.indexes.json
packages/schema/    shared JSON-schema/TS types for Firestore docs (admin + functions)
docs/               design, API, deployment guide, KT notes (contract §6.3)
```

## 4. Data model (Firestore)
```
users/{uid}                 segment: student|corporate, name, phone, email?, onboarding{...},
                            profile{education[], experience[]}, interests[], fcmTokens[], createdAt
institutes/{id}             name, location{area, address, geo}, contact, categories[], specializations[],
                            gallery[] (storage paths), courseIds[], published
courses/{id}                kind: course|project, title, instituteId?, category, techStack[],
                            durationWeeks, modes[online|offline], description, featured, published
providers/{id}              type: trainer|mentor|consultant, displayName, isOrganisation (trainers in
                            institute directory are orgs, §2.3), expertise[], domain, bio, photo,
                            rating (admin-entered), reviewsText[] (admin-entered), email (for invites),
                            timezone (Asia/Kolkata default), published
availability/{providerOrCourseId}/rules/{id}   weekly rules: dayOfWeek, start, end, slotMinutes, mode
slots/{targetId_startISO}   targetType, targetId, start, end, mode, capacity(1), bookedCount, status
bookings/{id}               userId, targetType course|trainer|mentor|consultant, targetId, slotId,
                            start, end, mode, status requested|confirmed|cancelled|completed|failed,
                            meetLink?, calendarEventId?, offlineAddress?, reminderSentAt?,
                            clientRequestId (idempotency), createdAt
admins/{uid}                role owner|editor (mirrored to custom claims)
stats/daily/{yyyy-mm-dd}    registrations{student,corporate}, bookings{byType}, (function-maintained)
config/app                  featured lists, categories, techStacks, home banners
```

## 5. Key flows
1. **Login and onboarding.** Phone OTP (Firebase Auth), then a segment picker, then the student
   form (name, contact, institution, course interests, desired skills) or the corporate form
   (name, contact, current role, years of experience, stack to learn). Then profile completion,
   then the home feed.
2. **Discover.** The home feed shows featured courses, institutes, trainers and mentors. Listings
   can be filtered by category, tech stack, duration, location and specialization. Firestore
   composite indexes cover each filter combination. Free-text search: Phase 1 uses prefix search
   on a normalized `searchKeywords[]` array. Algolia is a Change Request if the client needs it.
3. **Book** (courses, trainers, mentors and consultants all use the same engine).
   - The user picks a slot and calls the callable Function `createBooking(slotId, clientRequestId)`.
   - The Function runs a Firestore **transaction**: check the slot is open and `bookedCount < capacity`, increment it, and create the booking in `requested` state.
   - For online bookings it then calls the Calendar API to create an event with a Meet conference and both attendee emails, stores `meetLink` and marks the booking `confirmed`. Offline bookings attach the address and are confirmed straight away.
   - It sends an FCM confirmation to the user and a calendar invite email to the provider.
   - If Meet creation fails: retry 3× with backoff, then mark the booking `failed`, alert the admin and release the slot. Contract target: 100% link generation on confirmation.
   - Retrying the same `clientRequestId` returns the existing booking (idempotent).
4. **Cancel.** User or admin cancels, the slot is decremented and the calendar event deleted.
5. **Reminders.** A Cloud Scheduler job runs every 5 minutes and sends FCM for bookings starting in 60 min or 15 min. Deduplicated via `reminderSentAt`.
6. **Admin** (Next.js):
   - CRUD for institutes, courses/projects, trainers, mentors and consultants, with image upload.
   - Availability rules per provider or course.
   - Booking calendar with filter, cancel and reschedule.
   - Users list with segment breakdown.
   - Analytics from `stats/daily`.
   - Platform update broadcast (FCM topic).

## 6. Security
- **Firestore rules:**
  - Catalog collections (`institutes`, `courses`, `providers`, `config`): signed-in users can read documents where `published == true`; only admin claims can write.
  - `users/{uid}`: the owner can read and write, but not `fcmTokens` of others, and not role fields.
  - `bookings`: users read their own. **No client writes**; create, cancel and update go only through Functions.
  - `slots`: read-only for clients.
  - `admins`, `stats`: admin only.
- **Admin auth:** Firebase Auth email/password (or Google) plus the custom claim `admin: owner|editor`. Only the owner can manage other admins. Next.js server actions verify the ID token before any Admin SDK call.
- **Secrets:** Google Calendar credentials are stored only in Functions via Secret Manager, never in the clients.
- **Storage rules:** only admins can write to `catalog/`, which is public-read for signed-in users. Enforce size and MIME limits.
- **Rules testing:** emulator unit tests for every collection × role in CI.

## 7. Timeline (13 weeks from 2026-09-28; contract §3)
| M | Weeks | Dates | Deliverable | Payment |
|---|---|---|---|---|
| M1 Discovery + UI/UX | 1–2 | Sep 28 – Oct 11 | Brand kit, wireframes, Figma prototypes, **client approval** | (₹50k advance: on signing) |
| M2 Backend + Auth | 3 | Oct 12 – 18 | Firebase project, OTP auth, schema, admin roles, rules | |
| M3 App core | 4–6 | Oct 19 – Nov 8 | Onboarding, listings, directory, search/filters, home | ₹25k |
| M4 Booking engine | 7–8 | Nov 9 – 22 | Slots, booking, Meet links, push | |
| M5 Admin dashboard | 9–10 | Nov 23 – Dec 6 | CRUD, calendar, analytics | |
| M6 QA + UAT | 11 | Dec 7 – 13 | E2E, cross-device, perf, UAT sign-off | ₹25k |
| M7 Deploy + handover | 12–13 | Dec 14 – 27 | Store submissions (budget for Apple review), domain, GitHub, docs, KT | Final ₹50k due 60 days after both stores are live |

## 8. Success metrics (contract §10)
Crash rate < 1% · booking completion ≥ 75% · Meet link generated for 100% of confirmed online
bookings · push delivery > 95% · admin load < 2 s · uptime 99%+ · store rating > 4.0.

## 9. Risks & open questions
1. **Meet link creation needs a real Google identity.** A plain service account cannot create
   Meet conferences. Options: (a) Google Workspace + domain-wide delegation (cleanest, costs
   ~₹150–200/user/mo), or (b) OAuth refresh token of one dedicated client Google account
   stored in Secret Manager. **Decide in week 1.** It affects the client's account setup (§8.1).
2. **Delivering the link to providers.** Providers don't log in. They get the link via calendar
   invite, so every provider needs an email address. Does the client want an SMS/WhatsApp copy
   too? (That's out of scope unless it goes through a CR.)
3. **Users log in by phone and may not have an email.** The Meet link is delivered in the app and
   by push. Should email be optional in onboarding, so users also get a calendar invite?
4. **Slot model.** Are demos 1:1 (capacity 1) or group demos for courses (capacity N)? The design
   supports both, and the admin sets capacity.
5. **Offline bookings.** Is the address all that's needed, or does the institute need to confirm
   the booking manually?
6. **Timeline start.** The contract was signed in April with a 13-week term, and work starts
   2026-09-28. Confirm the revised dates with the client in writing.
7. **The contract says both 11 and 13 weeks.** This plan uses 13, matching the cover page and §3.
8. Apple Developer enrollment takes 2–7 days. The client should apply on Day 1.

## 10. Week-1 checklist (client-dependent, contract §8.1: due within 3 days)
Dedicated Google account · Firebase project (Blaze) · Google Cloud project with Calendar API ·
Apple Developer ($) · Play Console ($) · Vercel · domain · GitHub org · brand assets ·
initial list of institutes, trainers, mentors and consultants · course categories and tech stacks.

## 11. Next steps
1. Send the client the week-1 checklist and the revised timeline (written confirmation).
2. Resolve risk #1 (Meet identity).
3. Milestone 1: brand kit, wireframes and Figma prototypes for the student and corporate flows and the admin. Get client approval.
4. After approval, run /plan-eng-review on this doc, then scaffold the repo.
