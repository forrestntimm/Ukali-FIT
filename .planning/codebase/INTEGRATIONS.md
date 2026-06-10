# Integrations

## Core External Services

### Supabase

- Used for auth/session management across backend, admin web, and mobile
- Backend integration:
  - `backend/src/services/supabaseAuthService.ts`
  - `backend/src/utils/config.ts`
- Admin web integration:
  - `admin/src/lib/supabase.ts`
  - `admin/src/pages/LoginPage.tsx`
- Mobile integration:
  - `mobile/src/lib/supabase.ts`
  - `mobile/src/context/AuthContext.tsx`

### PostgreSQL via Prisma

- Primary app data store through Prisma
- Schema file: `backend/prisma/schema.prisma`
- Prisma client wiring: `backend/src/utils/prisma.ts`
- Seed scripts:
  - `backend/prisma/seed.ts`
  - `backend/prisma/seed.js`

### Stripe

- Used for payment intent and webhook processing
- Backend service: `backend/src/services/paymentService.ts`
- Webhook endpoint: `backend/src/routes/webhooks.ts`
- Current brownfield behavior includes manual payment tracking plus Stripe backend hooks

### Expo Push Notifications

- Device registration endpoint: `backend/src/routes/devices.ts`
- Push send orchestration: `backend/src/services/notificationService.ts`
- Mobile token registration helper: `mobile/src/lib/pushNotifications.ts`
- Push handler setup: `mobile/App.tsx`

## Deployment Integrations

### Vercel

- Admin web deploy config: `admin/vercel.json`
- Backend deploy config also exists: `backend/vercel.json`
- Brownfield note: chat history indicates active Vercel production deploys for the admin site and backend

### Apple / TestFlight

- Local iOS build/archive/export path lives in `mobile/scripts/build-local-ios.sh`
- Variant build outputs are copied into `mobile/local-builds/`
- This repo explicitly avoids EAS cloud builds and uses local export + Transporter upload

## Internal Surface Integrations

### Admin Web ↔ Backend

- Admin web uses `admin/src/api/client.ts` for authenticated API calls
- Main functional integrations:
  - `/auth/bootstrap`
  - `/users`
  - `/payments`
  - `/workouts`
  - `/classes`
  - `/scheduling`
  - `/announcements`

### Mobile ↔ Backend

- Mobile API client: `mobile/src/api/client.ts`
- QR check-in flow depends on:
  - athlete QR payload generation in `mobile/src/lib/checkInQr.ts`
  - backend parsing/check-in logic in `backend/src/services/checkInQr.ts` and `backend/src/services/classService.ts`

### Scheduling ↔ Classes

- Scheduling routes: `backend/src/routes/scheduling.ts`
- Class routes: `backend/src/routes/classes.ts`
- Admin web scheduling page: `admin/src/pages/SchedulingPage.tsx`
- Coach mobile classes page: `mobile/src/screens/AdminClassesManageScreen.tsx`

## Invite / Login Callback Surface

- Admin web callback:
  - `admin/src/lib/supabase.ts`
  - `backend/.env.example` → `ADMIN_CALLBACK_URL`
- Mobile callback:
  - `mobile/src/lib/supabase.ts`
  - `backend/.env.example` → `MOBILE_CALLBACK_URL`
- This area is operationally sensitive because wrong-surface redirects create real login failures.
