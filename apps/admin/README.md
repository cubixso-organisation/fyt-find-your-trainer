# Operator Console (admin)

Next.js 16 console for the Training & Education Platform. See `../../docs/DESIGN-v2.md` for the product design, `../../PRODUCT.md` and `../../DESIGN.md` for the design context.

## Run

```bash
npm install
PORT=3100 npm run dev
```

Demo accounts (seeded, dev only). All use the password `Operator@2026`, which you can override with `ADMIN_DEMO_PASSWORD`:

| Email | Role |
|---|---|
| owner@demo.local | Owner |
| super@demo.local | Super admin |
| admin@demo.local | Admin (default modules) |
| sneha@demo.local | Admin (catalog + content) |

Set `ADMIN_SESSION_SECRET` (32+ chars) in any non-dev environment; the app refuses to start in production without it.

## Roles and owner rules

Defined in `src/lib/rbac.ts` and enforced on the server by the proxy, the page guards and every server action.

- **Owner:** exactly one. Holds every permission. Can't be demoted, disabled or edited by anyone. Only the owner can:
  - manage super admins
  - transfer ownership (re-authentication plus a typed confirmation)
  - sign every operator out
  - toggle maintenance mode
- **Super admin:** can use every operational module, Team & roles, settings and the audit log. Manages admins only.
- **Admin:** limited to the modules granted to them. Sensitive modules (learners, broadcasts, analytics, home content) start switched off.
- **Everyone:** nobody can change their own role or permissions.
- **Session invalidation:** a role change, being disabled, or "sign out everywhere" bumps the admin's `tokenVersion`, which ends every session they have open.
- **Audit:** every mutation writes an audit entry.

## Sessions

Sessions use a signed HMAC cookie (`src/lib/session.ts`) with a 35-minute idle window that slides on activity. The cookie claims are only used for fast gating; the server re-reads the live admin record on every request. Login is throttled to 5 failures, then a 15-minute lock.

OAuth, MFA and email invites are planned. The login action and `getViewer()` are the only places that need to change to move to Firebase Auth with custom claims.

## Data

`src/lib/data/store.ts` is an in-memory store seeded with deterministic demo data (`seed.ts`). The header shows **Demo data** while it is active. Types mirror the Firestore model in DESIGN-v2. To go live:
- replace `db()` reads and writes with a Firestore adapter;
- keep the server actions as they are, because the validation, rules and audit logging live there.

## Structure

```
src/
  proxy.ts                 route guard + idle-window refresh
  lib/rbac.ts              roles, permissions, owner rules
  lib/session.ts           signed session tokens
  lib/auth.ts              getViewer / requirePermission / assertPermission
  lib/data/                types, seed, store, derived queries
  components/shell/        sidebar, top bar, ⌘K palette, theme, account
  components/ui/           primitives, DataTable, Drawer, ConfirmDialog, status pills
  components/charts/       validated chart kit (dataviz method)
  app/(auth)/              login, accept-invite
  app/(console)/           overview, bookings, availability, institutes, courses,
                           providers, content, learners, broadcasts, analytics,
                           team, audit, settings, ownership, profile
```

## Notes

- The repo lives on an external SSD, so `turbopackFileSystemCacheForDev` is off (see `next.config.ts`). The first compile of each route is slow.
