# Concerns

## 1. Auth Surface Complexity

Auth logic is split across backend, admin web, and mobile, with Supabase flows behaving differently by surface.

Key files:

- `backend/src/services/supabaseAuthService.ts`
- `admin/src/pages/LoginPage.tsx`
- `mobile/src/context/AuthContext.tsx`
- `mobile/src/lib/supabase.ts`

Why this matters:

- Wrong callback or OTP configuration can send users to the wrong surface
- Role checks must stay correct for admin vs member experiences
- Mobile session restore and first-time onboarding are already known pain points

## 2. Release Pipeline Fragility

The local build pipeline has become a critical part of product delivery.

Key files:

- `mobile/scripts/build-local-ios.sh`
- `mobile/scripts/run-variant.sh`
- `mobile/tests/app-store-readiness.test.mjs`

Why this matters:

- A large share of operational confidence depends on local archive/export behavior
- Variant prep, bundle embedding, provisioning, and signing are all failure-prone
- Build reliability issues directly block shipping

## 3. Performance Still Feels Product-Critical

Slow screens and tabs have been a recurring issue across both mobile and admin web.

Key files:

- `mobile/src/screens/AdminClassesManageScreen.tsx`
- `mobile/src/screens/ClassesScreen.tsx`
- `mobile/src/app/CoachRoot.tsx`
- `admin/src/pages/SchedulingPage.tsx`
- `admin/src/lib/pageCache.ts`
- `mobile/src/lib/screenCache.ts`

Why this matters:

- The gym use case is operational and time-sensitive
- Users are already reporting 10-17 second waits in real flows
- Code-shape optimizations exist, but measured runtime performance still needs continued attention

## 4. Brownfield Operational Coupling

Many changes span all three surfaces and the backend simultaneously.

Examples:

- payments touch `backend`, `admin`, and `mobile`
- announcements touch `backend`, push registration, and mobile handling
- classes/scheduling/check-in touch backend logic plus both admin and mobile surfaces

Why this matters:

- A “small” fix often has cross-surface consequences
- Coordination cost is real even without a formal workspace tool

## 5. Testing Is Strong On Regressions, Lighter On Full Flows

The project has good targeted regression coverage but limited full-journey automation.

Risk:

- New issues can still emerge from interactions between auth, backend responses, and UI state
- Performance expectations are not yet enforced with runtime measurements

## 6. Configuration Risk

Several areas fail loudly or warn when env/config values are missing.

Examples:

- `backend/src/utils/config.ts`
- `admin/src/lib/supabase.ts`
- `mobile/src/config/runtimeConfig.ts`
- `mobile/src/lib/pushNotifications.ts`

Why this matters:

- Deployments and store builds can appear fine while being partially broken by missing config
- Brownfield production behavior depends on keeping multiple env surfaces aligned
