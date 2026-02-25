# Ukali Gym Management

Production-ready gym management platform with:
- Backend API (`/backend`) - Node.js + Express + PostgreSQL (Prisma)
- Mobile app (`/mobile`) - React Native (Expo)
- Admin dashboard (`/admin`) - React + Vite

## Architecture
- Auth: Supabase Auth (magic link + OTP fallback), break-glass admin password fallback
- Payments: Stripe PaymentIntents + manual cash tracking
- Notifications: Expo push tokens + scheduled reminders
- Hosting: API on Render/Fly, Postgres on Supabase/Neon, Admin on Vercel, Mobile via Expo EAS

## Backend Setup
1. Create database + set `DATABASE_URL` in `backend/.env`.
2. Install deps and run migrations:
   - `cd backend`
   - `npm install`
   - `npm run prisma:generate`
   - `npm run prisma:migrate`
   - `npm run seed`
3. Start dev server:
   - `npm run dev`

Backend env example: `backend/.env.example`

### Core API Routes
- `POST /api/auth/bootstrap`
- `POST /api/auth/login` (break-glass admin fallback only)
- `GET /api/users/me`
- `GET /api/users` (admin)
- `POST /api/users` (admin)
- `POST /api/users/invite` (admin)
- `POST /api/users/:id/resend-invite` (admin)
- `PATCH /api/users/:id` (admin)
- `POST /api/payments/intent`
- `POST /api/payments/manual` (admin)
- `GET /api/payments/me`
- `GET /api/workouts/today`
- `POST /api/workouts` (admin)
- `GET /api/classes`
- `POST /api/classes` (admin)
- `POST /api/classes/:id/signup`
- `POST /api/classes/:id/checkin` (admin QR check-in)
- `PATCH /api/classes/:id/status` (admin)
- `GET /api/announcements`
- `POST /api/announcements` (admin)
- `POST /api/devices/register`
- `POST /api/webhooks/stripe`

## Admin Dashboard
1. `cd admin`
2. `npm install`
3. `cp .env.example .env` and set `VITE_API_URL`
4. `npm run dev`

## Mobile App (Expo)
1. `cd mobile`
2. `npm install`
3. `cp .env.example .env` and set `EXPO_PUBLIC_API_URL`
4. Run athlete app:
   - `npm run start:athlete`
5. Run coach app:
   - `npm run start:coach`

### Coach vs Athlete Builds
- Athlete binary: `npm run ios:athlete` or `npm run android:athlete`
- Coach binary: `npm run ios:coach` or `npm run android:coach`
- The app variant is driven by `EXPO_PUBLIC_APP_VARIANT` (`athlete` or `coach`)

### Stripe Mobile Payments
The mobile app currently requests a PaymentIntent but does not present a payment sheet. Integrate Stripe React Native SDK:
- Use `@stripe/stripe-react-native`
- Initialize with `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Confirm the PaymentIntent client secret returned from `POST /api/payments/intent`

## Deployment Guide
See `DEPLOYMENT.md` for hosting guidance and production settings.
