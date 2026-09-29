# Session Record

- **Project session ID:** TRN-20260928-c20456ad
- **Claude Code session UUID:** c20456ad-4203-4dc7-bc46-4b7b79c79415
- **Started:** 2026-09-28
- **Client:** Chandra Sekhar Puchalapalli (vendor: CUBIXSO Solutions Pvt Ltd)
- **Contract:** ~/Downloads/signed agreement of training project.pdf (signed 2026-04-24/25, ₹1,50,000, 13 weeks)
- **Scope:** Training marketplace — Flutter mobile app + Next.js admin + Firebase backend

## Decisions (2026-09-28)
- Follow the signed contract exactly: Flutter + Next.js + Firebase + Google Meet API
- Product = aggregator/booking marketplace (not LMS). Phase 2 items excluded.
- Starting fresh 2026-09-28; 13-week plan ends ~2026-12-27
- Earlier Expo/Supabase/multi-tenant LMS decisions REVERSED (see docs/DESIGN-v1.md, superseded)

## Status
- [x] Requirements (docs/DESIGN-v2.md, draft)
- [ ] Client written confirmation of revised timeline
- [ ] Meet link identity decision (Workspace DWD vs OAuth account)
- [ ] M1 Discovery & UI/UX (Figma) — client approval
- [ ] Eng review, then scaffold

## 2026-09-28: Admin console built (apps/admin)
- Next.js 16 operator console: owner / super admin / admin with server-enforced owner rules
- Modules: overview, bookings (list + week calendar), availability, institutes, courses, providers,
  app home & taxonomy, learners, broadcasts, analytics, team & roles, audit log, settings, ownership, profile
- Data: in-memory demo store mirroring the Firestore model; swap for Firestore adapter when client's Firebase exists
- Design context: PRODUCT.md, DESIGN.md (warm paper/ink + marigold, Geist)
- Deferred: OAuth/MFA (Firebase Auth), email invites, gallery uploads, Firestore adapter
- Note: contract M1 requires Figma approval before development; this console can serve as the reference for that review
