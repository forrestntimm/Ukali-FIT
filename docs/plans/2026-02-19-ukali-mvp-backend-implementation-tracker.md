# Ukali Sign-In MVP Implementation Tracker

## Goal
Implement the locked MVP auth/backend plan end-to-end for Android, iPhone, and Admin web, while keeping payments internal/admin-only and onboarding invite-only.

## Locked Decisions
- Environment topology: Dev + Prod
- Member auth: Supabase magic link + OTP fallback
- Admin auth: magic link primary + break-glass password backup
- Onboarding: admin invite only
- Migration: CSV import with strict validation; duplicate rows fail with report
- Payments: internal/admin-only with role + feature-flag enforcement
- Callbacks:
  - Dev admin: `http://localhost:5173/auth/callback`
  - Prod admin: `https://admin.ukali.app/auth/callback`
  - Mobile: `ukali://auth/callback`

## Progress Checklist

### 1) Backend Foundation
- [x] Add Supabase config/env support (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_AUD`)
- [x] Add `MEMBER_PAYMENTS_ENABLED` and `BREAK_GLASS_ADMIN_EMAILS` config support
- [x] Add Supabase auth service (token validation, invite sending)
- [x] Implement `POST /api/auth/bootstrap`
- [x] Keep `POST /api/auth/login` as break-glass fallback only
- [x] Update auth middleware to accept Supabase session tokens and legacy break-glass JWTs

### 2) Data Model
- [x] Add `supabaseUserId` to `User`
- [x] Make `passwordHash` nullable
- [x] Add `inviteSentAt`, `inviteAcceptedAt`, `lastLoginAt`
- [x] Update seed and user services for new model fields

### 3) Invite-Only Onboarding
- [x] Add `POST /api/users/invite` (admin)
- [x] Add `POST /api/users/:id/resend-invite` (admin)
- [x] Ensure invite sends Supabase magic link with proper redirect

### 4) Payments Scope Enforcement
- [x] Enforce role + feature flag for member payment endpoints
- [x] Keep admin/internal payment operations available

### 5) Classes + Error Clarity
- [x] Convert class signup error states to explicit 4xx responses and stable error codes
- [x] Ensure client-facing messages are clean and actionable

### 6) Admin App
- [x] Integrate Supabase client in admin app
- [x] Implement magic-link login flow
- [x] Implement break-glass password fallback path
- [x] Enforce admin-role check via bootstrap before app access
- [x] Add callback route handling (`/auth/callback`)

### 7) Mobile App (Android + iPhone)
- [x] Integrate Supabase client in Expo mobile app
- [x] Implement magic-link request flow
- [x] Implement OTP fallback verification flow
- [x] Implement deep-link callback handling (`ukali://auth/callback`)
- [x] Update auth/session handling to use Supabase session token for API requests

### 8) Migration Tooling
- [x] Add CSV migration script (strict validation + duplicate handling)
- [x] Emit success/error report outputs
- [x] Ensure idempotent behavior for already-linked users

### 9) Documentation & Env Examples
- [x] Update backend `.env.example`
- [x] Update mobile `.env.example`
- [x] Update admin `.env.example`
- [x] Update `DEPLOYMENT.md` with Dev/Prod auth setup and rollout guidance

### 10) Verification
- [x] Backend build passes
- [x] Admin build passes
- [x] Mobile type/start sanity check passes
- [x] Manual auth smoke test checklist documented
- [x] Full local smoke sequence executed (with documented external-config blockers)

## Manual Auth Smoke Test Checklist
- [ ] Member (iPhone): request magic link and complete sign-in via deep link.
- [ ] Member (Android): request magic link and complete sign-in via deep link.
- [x] Member (either platform): complete sign-in using OTP fallback code (API-level verification).
- [x] Non-provisioned member: login attempt shows `AUTH_ACCOUNT_NOT_PROVISIONED` behavior (API-level verification).
- [ ] Admin: magic-link login succeeds and dashboard loads.
- [x] Admin: break-glass password login works only for allowlisted email.
- [x] Non-break-glass admin email: password fallback is rejected.
- [ ] Admin: invite member and resend invite from Members page.
- [x] Member payment screens/routes remain disabled for members (API-level verification).

## Change Log
- 2026-02-19: Tracker created.
- 2026-02-19: Implemented backend/admin/mobile auth migration, invite routes, payment gating, CSV migration script, and build verification.
- 2026-02-19: Executed full local smoke sequence across backend/admin/mobile and logged pass/fail details.
- 2026-02-19: Added Supabase project URL + publishable key to local `backend/.env`, `admin/.env`, and `mobile/.env`.
- 2026-02-19: Added `SUPABASE_SERVICE_ROLE_KEY` to `backend/.env` and confirmed auth bootstrap no longer returns provider misconfiguration.
- 2026-02-19: Rechecked DB connectivity; current `DATABASE_URL` resolves to `localhost:5432` and DB-backed routes still fail due to no running local Postgres.
- 2026-02-19: Switched backend DB config to Supabase pooler URI, applied schema DDL successfully, fixed seed env loading, and verified DB-backed endpoints + break-glass admin login.
- 2026-02-19: Executed app-level auth E2E smoke (15 pass / 2 blocked / 1 fail) and documented callback/rate-limit blockers.
- 2026-02-19: Re-ran auth E2E after Supabase redirect update; mobile callback check now passes, remaining blocker is Supabase email rate limiting for invite/resend.
- 2026-02-19: Ran repeated invite/resend retries (7 attempts with backoff); all attempts hit `email rate limit exceeded`. Paused retries until February 20, 2026.
- 2026-02-20: Resumed invite/resend retry run (6 attempts). Invite remained rate-limited on 5/6 attempts; 1 attempt had invite success but resend failed with `INVITE_RESEND_FAILED` and Supabase message `Email address ... is invalid`.
- 2026-02-25: Reproduced invite/resend behavior with seeded admin login. Confirmed valid Gmail invite still returns `email rate limit exceeded`; synthetic `example.net` addresses are rejected as invalid by provider; resend fallback can surface `A user with this email address has already been registered` when OTP resend fails for existing identities.
- 2026-02-25: Patched backend invite/resend error handling to return explicit status/code mapping (`429 INVITE_RATE_LIMITED`, `422 INVITE_EMAIL_INVALID`, `409 INVITE_ALREADY_REGISTERED`) and to fallback from resend->invite only when resend indicates user-not-found.
- 2026-02-25: Removed mobile member payment action CTA and left payments screen in read-only mode to align with admin-only payment scope.

## Local Smoke Run (2026-02-19)

### Environment used
- Backend dev server on `http://127.0.0.1:4000` (restarted with `JWT_SECRET=smoke-secret` for legacy-token gate tests)
- Admin dev server on `http://127.0.0.1:5173`
- Expo Metro on `http://127.0.0.1:8081` (restarted after installing `expo-linking`)

### Passed checks
- [x] `GET /health` returns `200 {"status":"ok"}`
- [x] `POST /api/auth/bootstrap` without auth returns `401 AUTH_UNAUTHORIZED`
- [x] `POST /api/auth/bootstrap` with dummy bearer returns `500 AUTH_PROVIDER_MISCONFIGURED` when Supabase env vars are unset
- [x] `POST /api/auth/login` for non-allowlisted email returns `403 AUTH_BREAK_GLASS_ONLY`
- [x] `GET /api/users` with member token returns `403 AUTH_ROLE_FORBIDDEN`
- [x] `POST /api/payments/intent` with member token returns `403 PAYMENTS_MEMBER_DISABLED`
- [x] `GET /api/payments/me` with member token returns `403 PAYMENTS_MEMBER_DISABLED`
- [x] Admin dev pages respond at `/login` and `/auth/callback` (HTTP 200)
- [x] Metro bundles compile for iOS and Android:
  - `...AppEntry.bundle?platform=ios...` -> HTTP 200
  - `...AppEntry.bundle?platform=android...` -> HTTP 200

### Blocked checks (external configuration)
- [ ] Supabase auth end-to-end sign-in is still pending manual device/browser validation (magic link + OTP + deep links).
- [ ] Direct-host migration path remains blocked from this machine:
  - Previously: `db.xdpyaytnqxqannsxeopr.supabase.co:5432` (DNS failure)
  - Then configured: `localhost:5432` (connection refused / server not running)
  - Current status: routes succeed via Supabase pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`)
  - `DIRECT_URL` is temporarily set to the same pooler URI because direct host DNS still fails from this machine.

### Immediate follow-up before next smoke run
- [x] Replace DB host with the current Supabase project connection host (or pooled host) and verify DNS resolution.
- [x] Add remaining Supabase backend secret (`SUPABASE_SERVICE_ROLE_KEY`) to `backend/.env`.
- [x] Fix Supabase mobile redirect config (`ukali://auth/callback`) and rerun deep-link tests on iPhone/Android.
- [ ] Wait for/reset Supabase email rate limit and rerun invite + resend invite endpoint tests.
- [x] Investigate resend failure path and capture exact provider responses (`email rate limit exceeded`, `Email address ... is invalid`, and fallback `A user with this email address has already been registered`).
- [x] Resume invite/resend retry run on February 20, 2026.

## App-Level Auth E2E Smoke Run (2026-02-19)

### Summary
- Pass: `16`
- Blocked: `2`
- Fail: `0`

### Passes
- [x] Backend health endpoint (`/health`) returns `200`.
- [x] Break-glass admin password login succeeds.
- [x] Non-break-glass password login is rejected (`AUTH_BREAK_GLASS_ONLY`).
- [x] Member local user record exists after invite attempt (invite flow created/updated DB row).
- [x] Member magic-link generation succeeds via Supabase admin API.
- [x] Member deep-link redirect target is correct (`ukali://auth/callback`) after Supabase URL update.
- [x] Member magic-link verification succeeds (using returned `verification_type` + `token_hash`).
- [x] Member bootstrap succeeds after magic-link verification.
- [x] Member payments endpoint is blocked (`PAYMENTS_MEMBER_DISABLED`).
- [x] Member OTP fallback verification succeeds.
- [x] Member bootstrap succeeds after OTP fallback verification.
- [x] Admin magic-link generation succeeds.
- [x] Admin callback redirect is correct (`http://localhost:5173/auth/callback`).
- [x] Admin magic-link verification succeeds.
- [x] Admin bootstrap succeeds with `ADMIN` role.
- [x] Non-provisioned Supabase identity is blocked by bootstrap (`AUTH_ACCOUNT_NOT_PROVISIONED`).

### Blocked
- [ ] `POST /api/users/invite` currently blocked by Supabase email provider rate limiting (`INVITE_RATE_LIMITED: email rate limit exceeded`).
- [ ] `POST /api/users/:id/resend-invite` currently blocked by the same Supabase email rate limit (`INVITE_RATE_LIMITED: email rate limit exceeded`).

## Retry Run (2026-02-20)

### Summary
- Attempts run: `6`
- Consecutive clean invite+resend passes: `0`

### Attempt outcomes
- Attempt 1: `invite=201` then `resend=400` with `INVITE_RESEND_FAILED` (`Email address "...@gmail.com" is invalid`).
- Attempts 2-6: `invite=400` with `INVITE_FAILED` (`email rate limit exceeded`), so resend not attempted.
