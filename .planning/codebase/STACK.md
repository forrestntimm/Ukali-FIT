# Stack

## Overview

Ukali is a multi-surface TypeScript/JavaScript product with a Node backend, a React web admin SPA, and an Expo React Native mobile app. The repo is not a monorepo workspace in the npm sense; each surface manages its own dependencies and scripts under its own directory.

## Backend Stack

- Runtime: Node.js
- Language: TypeScript
- HTTP framework: Express in `backend/src/app.ts`
- ORM/database access: Prisma in `backend/src/utils/prisma.ts`
- Database schema: `backend/prisma/schema.prisma`
- Auth provider integration: Supabase in `backend/src/services/supabaseAuthService.ts`
- Payments: Stripe in `backend/src/services/paymentService.ts`
- Push delivery: Expo Server SDK in `backend/src/services/notificationService.ts`
- Validation: Zod in route files such as `backend/src/routes/users.ts`

## Admin Web Stack

- Runtime/build tool: Vite in `admin/package.json`
- UI library: React 18
- Routing: `react-router-dom` in `admin/src/App.tsx`
- HTTP client: Axios in `admin/src/api/client.ts`
- Auth/session: Supabase client in `admin/src/lib/supabase.ts`
- Styling: hand-authored global CSS in `admin/src/styles/global.css`

## Mobile Stack

- Runtime/build tool: Expo SDK 50 in `mobile/package.json`
- Framework: React Native 0.73 with Hermes
- Navigation: React Navigation in `mobile/src/app/AthleteRoot.tsx` and `mobile/src/app/CoachRoot.tsx`
- Auth/session: Supabase client in `mobile/src/lib/supabase.ts`
- Device storage: `expo-secure-store` and `@react-native-async-storage/async-storage`
- Notifications: `expo-notifications` in `mobile/src/lib/pushNotifications.ts`
- Camera/QR scanning: `expo-camera` and `ZXingObjC` through native deps

## Variant-Build Stack

- Athlete/coach variants are switched by scripts in:
  - `mobile/scripts/run-variant.sh`
  - `mobile/scripts/build-local-ios.sh`
  - `mobile/scripts/require-variant.sh`
- Release export config lives in `mobile/scripts/ExportOptions-app-store.plist`
- IPA validation lives in `mobile/scripts/validate-ios-ipa.sh`

## Configuration Surface

- Backend env template: `backend/.env.example`
- Admin env comes from Vite `import.meta.env` in `admin/src/lib/supabase.ts`
- Mobile runtime config is validated in `mobile/src/config/runtimeConfig.ts`
- App variant config is handled in `mobile/src/config/appVariant.ts`

## Testing Stack

- Backend tests: plain `node --test` files in `backend/tests`
- Admin tests: plain `node --test` files in `admin/tests`
- Mobile tests: plain `node --test` files in `mobile/tests`
- Type checks/builds:
  - `backend`: `npm run build`
  - `admin`: `npm run build`
  - `mobile`: `npx tsc --noEmit`

## Notable Brownfield Reality

- There is no root `package.json`, `turbo.json`, or `pnpm-workspace.yaml`.
- Each surface is operated independently from its own directory.
- Release operations are currently strongly centered around local iOS builds and TestFlight uploads.
