# Structure

## Top-Level Layout

- `backend/` — Express API, Prisma schema, services, tests
- `admin/` — Vite React admin dashboard
- `mobile/` — Expo React Native athlete + coach/admin app
- `docs/` — supporting documentation
- `supabase/` — Supabase-related project assets/config
- `DEPLOYMENT.md` and `README.md` — top-level operational docs

## Backend Structure

- `backend/src/app.ts` — Express app wiring
- `backend/src/server.ts` — process entry point
- `backend/src/routes/` — HTTP route modules
- `backend/src/services/` — business logic layer
- `backend/src/middleware/` — request guards and error plumbing
- `backend/src/utils/` — config, logger, Prisma client
- `backend/prisma/schema.prisma` — data model
- `backend/tests/` — node test files for backend behaviors

## Admin Structure

- `admin/src/main.tsx` — SPA bootstrap
- `admin/src/App.tsx` — route shell and auth gate
- `admin/src/pages/` — feature pages
- `admin/src/components/` — shared UI bits like `BrandedSplash.tsx`
- `admin/src/lib/` — Supabase, token cache, page cache
- `admin/src/api/` — Axios client
- `admin/src/styles/` — global CSS
- `admin/tests/` — node test files for admin behaviors

## Mobile Structure

- `mobile/App.tsx` — app bootstrap
- `mobile/src/app/` — athlete/coach root navigators
- `mobile/src/screens/` — feature screens
- `mobile/src/context/` — shared auth/session provider
- `mobile/src/lib/` — auth token cache, secure storage, QR helpers, push helpers, screen cache
- `mobile/src/config/` — runtime and variant configuration
- `mobile/src/components/` — wallpaper, error, splash/loading components
- `mobile/src/hooks/` — stale refresh helper
- `mobile/tests/` — node tests focused on release readiness and behavior guards
- `mobile/scripts/` — variant prep and local build/export helpers

## Naming Patterns

- Backend route files use resource names: `users.ts`, `payments.ts`, `classes.ts`
- Backend service files are capability-oriented: `userService.ts`, `paymentService.ts`, `notificationService.ts`
- Admin pages use `*Page.tsx`
- Mobile screens use `*Screen.tsx`
- Mobile coach/admin screens are prefixed with `Admin*`
- Mobile root navigation files are named by audience: `AthleteRoot.tsx`, `CoachRoot.tsx`

## Planning Structure

GSD planning now lives under:

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/codebase/`
- `.planning/phases/`

## Brownfield Note

This repo is organized clearly by surface, but there is no shared root package/workspace manager. That makes per-surface work straightforward, while cross-surface changes depend more on human coordination and documentation than on tooling-level workspace orchestration.
