# Architecture

## System Shape

This repo is a three-surface brownfield system:

1. `backend/` is the API and business-logic source of truth
2. `admin/` is the browser-based operations console
3. `mobile/` is the customer/staff mobile surface with athlete and coach variants

The backend owns persistent data and most business rules. The admin and mobile surfaces are fairly thin clients that authenticate, fetch API data, and render role-specific workflows.

## Backend Architecture

- App bootstrap: `backend/src/server.ts` → `backend/src/app.ts`
- Route composition: `backend/src/routes/index.ts`
- Common middleware:
  - auth: `backend/src/middleware/auth.ts`
  - role gating: `backend/src/middleware/role.ts`
  - validation: `backend/src/middleware/validate.ts`
  - rate limiting: `backend/src/middleware/rateLimit.ts`
  - error handling: `backend/src/middleware/error.ts`
- Services hold business logic:
  - users/auth: `backend/src/services/userService.ts`, `backend/src/services/supabaseAuthService.ts`, `backend/src/services/authService.ts`
  - classes/scheduling/check-in: `backend/src/services/classService.ts`, `backend/src/services/checkInQr.ts`
  - payments: `backend/src/services/paymentService.ts`, `backend/src/services/paymentPlans.ts`
  - workouts: `backend/src/services/workoutService.ts`
  - announcements/notifications: `backend/src/services/announcementService.ts`, `backend/src/services/notificationService.ts`

This is a route → service → Prisma architecture with utility/config layers underneath.

## Admin Web Architecture

- Entry point: `admin/src/main.tsx`
- App shell and routing: `admin/src/App.tsx`
- Page-per-surface model:
  - `DashboardPage.tsx`
  - `MembersPage.tsx`
  - `PaymentsPage.tsx`
  - `WodPage.tsx`
  - `SchedulingPage.tsx`
  - `AnnouncementsPage.tsx`
  - `LoginPage.tsx`
- Shared client/session helpers:
  - `admin/src/api/client.ts`
  - `admin/src/lib/authTokenCache.ts`
  - `admin/src/lib/pageCache.ts`
  - `admin/src/lib/supabase.ts`

The admin app is essentially a routed SPA with page-local state and a small amount of shared caching.

## Mobile Architecture

- Entry point: `mobile/App.tsx`
- Global providers/guards:
  - auth provider: `mobile/src/context/AuthContext.tsx`
  - crash/error protection: `mobile/src/lib/appCrashHandler.ts`, `mobile/src/components/AppErrorBoundary.tsx`
  - loading shell: `mobile/src/components/AppLoadingScreen.tsx`
- Root navigation split:
  - athlete root: `mobile/src/app/AthleteRoot.tsx`
  - coach root: `mobile/src/app/CoachRoot.tsx`
- Screen-per-feature model:
  - athlete: `DashboardScreen.tsx`, `ClassesScreen.tsx`, `CommunityScreen.tsx`, `PaymentsScreen.tsx`, `ProfileScreen.tsx`
  - coach/admin: `AdminDashboardScreen.tsx`, `AdminMembersScreen.tsx`, `AdminClassesManageScreen.tsx`, `AdminScanScreen.tsx`, `AdminPaymentsManageScreen.tsx`, `AdminAnnouncementsManageScreen.tsx`, `AdminWodManageScreen.tsx`

The mobile app uses one shared auth/session layer and two variant-specific roots to branch into athlete vs coach/admin UX.

## Data Flow

Typical flow:

1. Surface authenticates with Supabase
2. Surface uses access token to call backend `/auth/bootstrap` or protected routes
3. Backend resolves local user and role, then performs service-layer work
4. Service layer reads/writes Prisma models
5. Surface caches/rehydrates selected data for smoother relaunches

## Cross-Cutting Architectural Themes

- Role-aware access checks are central and enforced on backend routes
- Mobile release and runtime configuration are tightly coupled to variant selection
- Performance fixes rely on cache layers in both web and mobile instead of a formal global state library
- A large share of complexity sits in auth/session behavior and local build/release mechanics rather than in novel domain modeling
