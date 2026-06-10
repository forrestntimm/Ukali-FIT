# Conventions

## General Style

- Most product code is written in TypeScript
- Frontend files prefer React function components
- API handlers are thin and defer to services
- Validation is typically done near route boundaries with Zod
- Utility/config concerns are pushed into `utils/` or `lib/`

## Backend Conventions

- Route handlers live in `backend/src/routes/*.ts`
- Business logic lives in `backend/src/services/*.ts`
- Role checks are enforced explicitly with middleware such as:
  - `backend/src/middleware/auth.ts`
  - `backend/src/middleware/role.ts`
- Prisma selections are often explicit and fairly verbose in `backend/src/services/userService.ts`
- Errors commonly throw `new Error(...)` inside services and are normalized by route/error middleware

## Admin Web Conventions

- App routing and auth gate live together in `admin/src/App.tsx`
- Pages tend to own their own fetch/state logic rather than using a global store
- Shared session/performance helpers live in:
  - `admin/src/api/client.ts`
  - `admin/src/lib/authTokenCache.ts`
  - `admin/src/lib/pageCache.ts`
- Styling is handled by project-authored CSS variables and classes in `admin/src/styles/global.css`

## Mobile Conventions

- Shared auth/session behavior is centralized in `mobile/src/context/AuthContext.tsx`
- Navigation is split by variant root instead of a single deeply-conditional tree
- Performance improvements use cache helpers rather than Redux/Zustand-style global state
- Release/readiness behavior is protected by file-content tests in `mobile/tests/app-store-readiness.test.mjs`
- Mobile UI uses `theme` values from `mobile/src/theme.ts`

## Logging And Diagnostics

- Non-fatal warnings often use `console.warn` in config/runtime helpers
- Some runtime errors are logged with `console.error`, especially push registration or prefetch failures
- Crash hardening exists in `mobile/src/lib/appCrashHandler.ts`

## Release Conventions

- Local iOS builds are scripted, not manually clicked together
- Variant prep is always run before building through `mobile/scripts/run-variant.sh`
- Stable output copies are stored in `mobile/local-builds/`
- The repo carries explicit local-build-only rules in project and global agent instructions

## Documentation Convention

- Operational intent has been captured heavily through tests and chat-driven fixes
- Prior to this pass, repo-level GSD planning artifacts were missing even though the workflow preference existed

## Important Behavioral Convention

- Brownfield fixes tend to favor targeted hardening over sweeping rewrites
- The product is being evolved while in active use, so the codebase prioritizes practical patches and release safety over architectural purity
