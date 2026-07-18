# Roadmap: Ukali Gym Management Platform

## Overview

This brownfield roadmap is focused on stabilizing the product that already exists: auth needs to be predictable, slow screens need to feel immediate, core gym operations need to stay correct, and release workflows need to stay reliable while Android expansion comes into scope.

## Phases

- [x] **Phase 1: Auth And Release Reliability** - stabilize sign-in flows, session persistence, crash resistance, and local release workflows
- [x] **Phase 2: Performance Hardening** - reduce slow loads across mobile tabs and admin web pages
- [x] **Phase 3: Gym Operations Correctness** - tighten classes, check-in, payments, and scheduling behavior
- [ ] **Phase 4: Notification And Android Expansion** - harden push notifications and prepare Android release parity

## Phase Details

### Phase 1: Auth And Release Reliability
**Goal**: Make authentication and release mechanics dependable enough that onboarding and shipping are no longer fragile.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, RELS-01, RELS-02, RELS-03
**Success Criteria** (what must be TRUE):
  1. First-time and returning users can complete the intended login flow for each surface without being redirected to the wrong product surface.
  2. Mobile users stay signed in across relaunches unless they explicitly sign out or the session is genuinely invalid.
  3. Local variant builds for athlete and coach/admin can be archived and exported consistently.
**Plans**: TBD

Plans:
- [x] 01-01: Audit and harden shared auth/session flows across backend, mobile, and admin web
- [x] 01-02: Standardize local release/build validation across athlete and coach/admin apps
- [x] 01-03: Reduce startup crash risk and improve startup recovery behavior

### Phase 2: Performance Hardening
**Goal**: Cut down the slowest screen and tab loads across mobile and admin web.
**Depends on**: Phase 1
**Requirements**: CLAS-01, CLAS-02, CLAS-03, CLAS-04
**Success Criteria** (what must be TRUE):
  1. The most-used tabs and pages render meaningful UI immediately instead of blocking on heavy startup work.
  2. Scheduling and classes views use lighter payloads, caching, or prefetching where appropriate.
  3. Performance fixes are verified against both the admin web surface and the coach/athlete mobile surfaces.
**Plans**: TBD

Plans:
- [x] 02-01: Profile backend payload hotspots and trim oversized responses
- [x] 02-02: Tighten mobile tab/page caching and prefetch behavior
- [x] 02-03: Tighten admin web page caching and view rendering cost

### Phase 3: Gym Operations Correctness
**Goal**: Make the day-to-day operating flows trustworthy for staff and members.
**Depends on**: Phase 2
**Requirements**: CHKI-01, CHKI-02, CHKI-03, PAY-01, PAY-02, PAY-03
**Success Criteria** (what must be TRUE):
  1. QR check-in identifies the right athlete and updates attendance metrics correctly.
  2. Payment plan presets are consistent between admin web, admin mobile, and athlete views.
  3. Scheduling and member/payment targeting show the right users and data.
**Plans**: TBD

Plans:
- [x] 03-01: Validate and harden QR/check-in/counter flows end to end
- [x] 03-02: Align payment plan logic and athlete filtering across surfaces
- [x] 03-03: Verify scheduling and class assignment correctness across web and mobile

### Phase 4: Notification And Android Expansion
**Goal**: Extend reliability to push communications and Android release readiness.
**Depends on**: Phase 3
**Requirements**: NOTF-01, NOTF-02, ANDR-01, ANDR-02
**Success Criteria** (what must be TRUE):
  1. Announcements reach registered mobile devices reliably.
  2. Notification registration does not silently fail after permissions are granted.
  3. Android release work can begin from a stable, documented baseline.
**Plans**: TBD

Plans:
- [ ] 04-01: Verify push-notification registration and send flows across both mobile variants
- [ ] 04-02: Prepare Android build/test/release parity work

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth And Release Reliability | 3/3 | Complete | 2026-03-30 |
| 2. Performance Hardening | 3/3 | Complete | 2026-03-30 |
| 3. Gym Operations Correctness | 3/3 | Complete | 2026-07-17 |
| 4. Notification And Android Expansion | 0/2 | Not started | - |
