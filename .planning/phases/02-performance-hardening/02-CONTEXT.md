# Phase 2: Performance Hardening - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 focuses on the most visible performance pain across athlete mobile, coach/admin mobile, and admin web. The goal is not a full architecture rewrite. The goal is to identify and trim the slowest payloads, make the most-used screens paint immediately with meaningful UI, and keep scheduling/classes views from blocking on unrelated work.

</domain>

<decisions>
## Implementation Decisions

### Visible responsiveness matters more than theoretical purity
- The main target is user-perceived speed on cold open, tab switch, and first page load.
- Fast first paint with background refresh is preferred over blank loading screens waiting for perfect data.
- Performance work should favor smaller payloads, scoped queries, cache reuse, and prefetching over large new dependencies or state-management rewrites.

### Backend payload cost should be reduced before over-optimizing clients
- If a view is slow because it fetches too much data, the payload should be trimmed at the source.
- Scheduling, classes, and admin user-targeting flows should avoid loading fields that the active screen does not render.
- Performance changes should preserve correctness for class assignment, attendance, and payment state.

### Mobile and web should use the same performance philosophy
- Warm-cache first paint is acceptable if stale windows are explicit and bounded.
- Prefetching is good when it supports a specific high-traffic screen instead of blindly fan-out fetching on startup.
- Rehydrated data should never hide the need for a refresh forever; stale checks must remain visible in code.

### Claude's Discretion
- Exact TTL values for caches and prefetched payloads
- Which screens should prefetch versus just reuse shared caches
- Whether a particular screen needs a summary route, lighter query params, or client-side render reduction

</decisions>

<specifics>
## Specific Ideas

- The user has repeatedly called out slow loads with concrete thresholds: 10 to 17 seconds is not acceptable, and the target feel is around 1 to 2 seconds or immediate first paint.
- The biggest recurring pain points have been:
  - coach/admin mobile `Classes`
  - admin web `Scheduling`
  - mobile cold-open tab loading
  - payments and classes-related admin views
- This phase should prefer instrumentable, test-backed improvements over cosmetic claims of speed.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and roadmap
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`

### Backend performance hotspots
- `backend/src/routes/classes.ts`
- `backend/src/routes/scheduling.ts`
- `backend/src/routes/users.ts`
- `backend/src/services/classService.ts`
- `backend/src/services/userService.ts`

### Mobile performance surfaces
- `mobile/src/app/AthleteRoot.tsx`
- `mobile/src/app/CoachRoot.tsx`
- `mobile/src/lib/screenCache.ts`
- `mobile/src/hooks/useStaleFocusRefresh.ts`
- `mobile/src/screens/ClassesScreen.tsx`
- `mobile/src/screens/AdminClassesManageScreen.tsx`
- `mobile/src/screens/AdminDashboardScreen.tsx`
- `mobile/src/screens/PaymentsScreen.tsx`
- `mobile/tests/app-store-readiness.test.mjs`

### Admin web performance surfaces
- `admin/src/App.tsx`
- `admin/src/api/client.ts`
- `admin/src/lib/pageCache.ts`
- `admin/src/pages/DashboardPage.tsx`
- `admin/src/pages/MembersPage.tsx`
- `admin/src/pages/PaymentsPage.tsx`
- `admin/src/pages/SchedulingPage.tsx`
- `admin/tests/performance-cache.test.mjs`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mobile/src/lib/screenCache.ts` already provides persistent and in-memory cache helpers
- `admin/src/lib/pageCache.ts` already provides page-level cache helpers for admin web
- `mobile/tests/app-store-readiness.test.mjs` and `admin/tests/performance-cache.test.mjs` are good places to lock in performance guardrails

### Established Patterns
- Mobile performance fixes already use bounded stale windows and screen-level prefetch instead of a global state library
- Admin web performance fixes already share cache keys like `admin-users`, `admin-coaches`, and scheduling windows
- Backend already has summary-style routes and lightweight params in some places, so Phase 2 should extend that pattern rather than invent a new one

### Integration Points
- Backend payload changes affect both admin web and coach mobile views immediately
- Mobile root prefetch logic can help or hurt startup time, so it needs to stay narrowly scoped
- Admin web rendering cost is a mix of network payload size, cache reuse, and how much UI is mounted eagerly

</code_context>

<deferred>
## Deferred Ideas

- Full backend query instrumentation / tracing stack
- Replacing current cache helpers with a new global client-state library
- Visual redesign work unrelated to performance

</deferred>

---

*Phase: 02-performance-hardening*
*Context gathered: 2026-03-30*
