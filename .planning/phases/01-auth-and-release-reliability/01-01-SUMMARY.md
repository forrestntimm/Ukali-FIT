# Plan 01-01 Summary

## Outcome

Completed the first auth and security hardening slice for Phase 1.

This execution tightened the backend's default security posture without changing the intended daily user flows for mobile login, OTP, password setup, biometric login, or session restore.

## Changes Shipped

### 1. CORS now fails closed

- Removed the fail-open `CORS_ORIGIN || "*"` behavior from backend config.
- Production now denies browser origins unless `CORS_ORIGIN` is explicitly configured.
- Development keeps a narrow localhost-only allowlist so local admin/mobile web surfaces still work.

Files:
- `backend/src/utils/config.ts`

### 2. Added dedicated auth abuse throttling

- Added `otpLimiter` for invite / OTP / resend-style routes.
- Added `passwordLimiter` for password-sensitive routes.
- Applied them to:
  - `POST /users/invite`
  - `POST /users/:id/resend-invite`
  - `POST /users/me/password`

Files:
- `backend/src/middleware/rateLimit.ts`
- `backend/src/routes/users.ts`

### 3. Stopped leaking raw internal server errors

- 500-class errors now return a generic `"Internal server error"` client message.
- 4xx errors still return actionable client-facing messages.

Files:
- `backend/src/middleware/error.ts`

### 4. Reduced sensitive admin response payloads where not needed

- Invite creation no longer returns the full user object.
- Web access approval no longer returns the full target user object.
- These routes now return operational success payloads only.

Files:
- `backend/src/routes/users.ts`

## Verification

Commands run:

```bash
cd backend && node --test tests/auth-hardening.test.mjs
cd backend && node --test tests/auth-hardening.test.mjs tests/payment-plans.test.mjs tests/notification-and-cron.test.mjs
cd backend && npm run build
cd mobile && npx tsc --noEmit
cd mobile && node --test tests/app-store-readiness.test.mjs
```

Result:
- Backend auth hardening tests passed
- Broader backend regression tests passed
- Backend build passed
- Mobile typecheck passed
- Mobile app-store readiness tests passed

## New Test Coverage

Added:
- `backend/tests/auth-hardening.test.mjs`

This locks in:
- fail-closed CORS expectations
- presence of OTP/password limiters
- limiter wiring on abuse-prone auth routes
- masked 500-level error responses
- minimal invite / approval response shapes

## Scope Notes

- This plan intentionally focused on high-value hardening with low product disruption.
- MFA, audit logging, and QR rotation were left for later work because they change operational behavior and need their own explicit plan.
- No local/cloud build workflow changes were needed for this slice.

## Follow-On Work

Best next execution target:
- `01-02-PLAN.md` for local release reliability

Later security expansion:
- admin MFA
- sensitive action audit log
- QR rotation / reissue flow
