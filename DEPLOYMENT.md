# Deployment Guide

## Recommended Hosting
- API: Render or Fly.io
- Database: Supabase or Neon (PostgreSQL)
- Admin dashboard: Vercel
- Mobile: Expo EAS build + store releases

## Backend (Render/Fly)
1. Provision PostgreSQL and set `DATABASE_URL`.
2. Configure environment:
   - `JWT_SECRET` (break-glass admin fallback token signing only)
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_AUD`
   - `ADMIN_CALLBACK_URL`, `MOBILE_CALLBACK_URL`
   - `MEMBER_PAYMENTS_ENABLED=false`
   - `BREAK_GLASS_ADMIN_EMAILS`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `EXPO_ACCESS_TOKEN`
3. Run Prisma migrations:
   - `npm run prisma:deploy`
4. Start command:
   - `npm run start`
5. Add Stripe webhook endpoint:
   - `https://<api-domain>/api/webhooks/stripe`

## Admin Dashboard (Vercel)
1. Set `VITE_API_URL` to the API base URL.
2. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_CALLBACK_URL`, `VITE_BREAK_GLASS_ADMIN_EMAILS`.
3. Deploy.

## Mobile (Expo EAS)
1. Set `EXPO_PUBLIC_API_URL` in EAS secrets.
2. Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_MAGIC_LINK_REDIRECT_URL=ukali://auth/callback`.
3. Configure `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. Build via `eas build` and submit to stores.

## Supabase Auth Setup
1. Create separate projects for `ukali-dev` and `ukali-prod`.
2. Enable email magic link and OTP.
3. Keep password login enabled only for break-glass admins.
4. Disable open sign-up (invite-only onboarding).
5. Configure redirect URLs:
   - Dev admin: `http://localhost:5173/auth/callback`
   - Prod admin: `https://admin.ukali.app/auth/callback`
   - Mobile: `ukali://auth/callback`

## Existing User Invite Migration
1. Prepare CSV with columns:
   - `email,name,phone,role,membership_start,next_payment_due,payment_status`
2. Run dry-run:
   - `npm run migrate:invites -- --file=./members.csv --dry-run`
3. Run live migration:
   - `npm run migrate:invites -- --file=./members.csv`
4. Inspect generated report in `backend/reports/`.

## Rollout Safety Gate
- Use phased rollout for auth migration.
- Roll back if:
  - auth error rate is greater than 2% for 15 minutes, or
  - login success drops below 95%.

## Production Notes
- Enforce HTTPS and set CORS origin.
- Rotate `JWT_SECRET`.
- Use a background job runner (BullMQ/Cloud Scheduler) for reminders if needed.
- Configure log aggregation (e.g., Sentry + Grafana).
