# Plan 02-01 Summary

## Outcome

Completed the backend payload-trimming slice for Phase 2 by replacing several heavy general-purpose user and class fetches with lightweight contracts targeted at the slow admin and coach surfaces.

## What Changed

### Backend

- Added `listMemberOptions()` in [backend/src/services/userService.ts](/Users/forresttimm/Documents/Ukali%20sign%20in%20app/backend/src/services/userService.ts) for lightweight athlete picker data.
- Added `getMemberDashboardStats()` in [backend/src/services/userService.ts](/Users/forresttimm/Documents/Ukali%20sign%20in%20app/backend/src/services/userService.ts) for summary dashboard counts without loading the full users index.
- Exposed `GET /users/member-options` and `GET /users/stats` in [backend/src/routes/users.ts](/Users/forresttimm/Documents/Ukali%20sign%20in%20app/backend/src/routes/users.ts).
- Kept coach/mobile summary usage on the existing class summary route and reused it for more coach surfaces.

### Admin Web

- Switched [admin/src/pages/DashboardPage.tsx](/Users/forresttimm/Documents/Ukali%20sign%20in%20app/admin/src/pages/DashboardPage.tsx) to `GET /users/stats`.
- Switched [admin/src/pages/PaymentsPage.tsx](/Users/forresttimm/Documents/Ukali%20sign%20in%20app/admin/src/pages/PaymentsPage.tsx) to `GET /users/member-options`.
- Added/updated regression checks in [admin/tests/performance-cache.test.mjs](/Users/forresttimm/Documents/Ukali%20sign%20in%20app/admin/tests/performance-cache.test.mjs).

### Mobile

- Switched [mobile/src/screens/AdminDashboardScreen.tsx](/Users/forresttimm/Documents/Ukali%20sign%20in%20app/mobile/src/screens/AdminDashboardScreen.tsx) to the summary classes payload.
- Switched [mobile/src/screens/AdminPaymentsManageScreen.tsx](/Users/forresttimm/Documents/Ukali%20sign%20in%20app/mobile/src/screens/AdminPaymentsManageScreen.tsx) to `GET /users/member-options`.
- Switched [mobile/src/screens/AdminScanScreen.tsx](/Users/forresttimm/Documents/Ukali%20sign%20in%20app/mobile/src/screens/AdminScanScreen.tsx) to the summary classes payload for class selection before loading the selected roster.
- Added/updated regression checks in [mobile/tests/app-store-readiness.test.mjs](/Users/forresttimm/Documents/Ukali%20sign%20in%20app/mobile/tests/app-store-readiness.test.mjs).

### Tests

- Added [backend/tests/performance-payloads.test.mjs](/Users/forresttimm/Documents/Ukali%20sign%20in%20app/backend/tests/performance-payloads.test.mjs) to lock in the lighter payload contracts.

## Verification

- `cd backend && node --test tests/performance-payloads.test.mjs tests/auth-hardening.test.mjs tests/payment-plans.test.mjs tests/notification-and-cron.test.mjs`
- `cd backend && npm run build`
- `cd admin && node --test tests/performance-cache.test.mjs`
- `cd admin && npm run build`
- `cd mobile && node --test tests/app-store-readiness.test.mjs`
- `cd mobile && npx tsc --noEmit`

## Result

The slow classes/scheduling/admin-targeting flows no longer need to load the full admin users payload just to render stats or athlete selectors, and the coach mobile surfaces now reuse the lightweight class summary path more consistently.
