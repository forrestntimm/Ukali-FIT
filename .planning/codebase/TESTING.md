# Testing

## Test Shape

This repo uses lightweight per-surface `node --test` coverage rather than a single unified test runner. The tests are primarily behavior guards and readiness checks for known fragile paths.

## Backend Tests

Files:

- `backend/tests/checkin-flow.test.js`
- `backend/tests/notification-and-cron.test.mjs`
- `backend/tests/payment-plans.test.mjs`

Coverage themes:

- QR/check-in and attendance metrics
- announcement and cron behavior
- payment plan logic

Typical verification:

- `cd backend && node --test tests/*.test.*`
- `cd backend && npm run build`

## Admin Tests

Files:

- `admin/tests/athlete-profile-filter.test.mjs`
- `admin/tests/auth-navigation.test.mjs`
- `admin/tests/auth-token.test.mjs`
- `admin/tests/branded-splash.test.mjs`
- `admin/tests/member-invite-redirect.test.mjs`
- `admin/tests/payment-plans.test.mjs`
- `admin/tests/performance-cache.test.mjs`
- `admin/tests/rate-limit.test.mjs`

Coverage themes:

- auth navigation/token behavior
- payment plan rendering
- page cache/performance guards
- invite redirect correctness
- branded splash behavior

Typical verification:

- `cd admin && node --test tests/*.test.mjs`
- `cd admin && npm run build`

## Mobile Tests

Files:

- `mobile/tests/app-store-readiness.test.mjs`
- `mobile/tests/coach-login-and-sync.test.mjs`
- `mobile/tests/ios-bundle-fallback.test.mjs`
- `mobile/tests/payment-plans.test.mjs`

Coverage themes:

- release/build/readiness guarantees
- auth/session behavior
- QR payload and login semantics
- variant setup and iOS packaging guards
- payment plan UX assumptions

Typical verification:

- `cd mobile && node --test tests/app-store-readiness.test.mjs tests/payment-plans.test.mjs`
- `cd mobile && npx tsc --noEmit`
- local archive/export scripts for true release verification

## Testing Gaps

- There is no obvious end-to-end browser automation suite for admin web
- There is no obvious device-level E2E test suite for mobile user journeys
- A lot of confidence still depends on targeted regression tests plus manual TestFlight verification
- Performance targets are guarded indirectly through code-shape tests rather than measured runtime benchmarks

## Brownfield Takeaway

The repo has a strong habit of adding regression tests after painful failures, especially around auth, build/release, QR, and payment logic. That is useful, but there is still room for broader scenario-level testing once the current stabilization work settles down.
