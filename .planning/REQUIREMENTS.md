# Requirements: Ukali Gym Management Platform

**Defined:** 2026-03-29
**Core Value:** Members and staff can reliably manage attendance, schedules, and gym communication without fragile manual workarounds.

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: Athlete and coach/admin mobile users can request a one-time verification code without being redirected to the wrong surface
- [ ] **AUTH-02**: Returning users can stay signed in across app relaunches unless they explicitly sign out or the session becomes invalid
- [ ] **AUTH-03**: Admin web users can complete OTP and password login flows with role enforcement
- [ ] **AUTH-04**: Biometric and saved-password flows work after a successful mobile password login

### Classes And Scheduling

- [ ] **CLAS-01**: Athletes can view their class schedule without long blocking loads on reopen
- [ ] **CLAS-02**: Coach/admin mobile users can open the Classes tab quickly enough for daily use
- [ ] **CLAS-03**: Admin web users can open Scheduling without waiting on heavy unrelated payloads
- [ ] **CLAS-04**: Class assignment changes from admin surfaces propagate correctly to the coaching schedule

### Check-In And Attendance

- [ ] **CHKI-01**: Each athlete profile has a stable unique QR code that does not regenerate during normal profile updates
- [ ] **CHKI-02**: Admin QR scanning checks the correct athlete into the correct class
- [ ] **CHKI-03**: Checked-in attendance updates class totals and streak metrics correctly

### Payments And Operations

- [ ] **PAY-01**: Admin web and admin mobile can record payments using the same fixed gym payment plan presets
- [ ] **PAY-02**: Athlete-facing payment views show plan options and payment history in a usable format
- [ ] **PAY-03**: Admin dropdowns that target athletes only show activated/real athlete profiles where intended

### Notifications And Communication

- [ ] **NOTF-01**: Sending an announcement triggers push notifications to registered athlete and coach/admin devices
- [ ] **NOTF-02**: Mobile builds can register and refresh Expo push tokens reliably after permission is granted

### Release And Reliability

- [ ] **RELS-01**: Local iOS archive/export/signing flow remains reproducible for both variants
- [ ] **RELS-02**: Store/TestFlight builds contain the embedded JS bundle and required assets
- [ ] **RELS-03**: Crash-prone startup paths fail gracefully instead of hard-crashing where possible

## v2 Requirements

### Android Release

- **ANDR-01**: Produce Android release builds for athlete and coach/admin variants with equivalent auth and biometric behavior
- **ANDR-02**: Prepare Play Store submission flow for both Android app variants

### Billing Expansion

- **BILL-01**: Add full mobile card-payment UX when Stripe mobile integration becomes in-scope
- **BILL-02**: Add stronger membership-plan lifecycle reporting if operational demand requires it

## Out of Scope

| Feature | Reason |
|---------|--------|
| EAS cloud build automation | Explicitly excluded because this account uses local-only builds |
| Full redesign/rebrand across all surfaces | Reliability and operational flow are higher priority than visual overhaul |
| Real-time chat or community feature expansion | Not part of the current gym operations/release stabilization push |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| RELS-01 | Phase 1 | Pending |
| RELS-02 | Phase 1 | Pending |
| RELS-03 | Phase 1 | Pending |
| CLAS-01 | Phase 2 | Pending |
| CLAS-02 | Phase 2 | Pending |
| CLAS-03 | Phase 2 | Pending |
| CLAS-04 | Phase 2 | Pending |
| CHKI-01 | Phase 3 | Pending |
| CHKI-02 | Phase 3 | Pending |
| CHKI-03 | Phase 3 | Pending |
| PAY-01 | Phase 3 | Pending |
| PAY-02 | Phase 3 | Pending |
| PAY-03 | Phase 3 | Pending |
| NOTF-01 | Phase 4 | Pending |
| NOTF-02 | Phase 4 | Pending |
| ANDR-01 | Phase 4 | Pending |
| ANDR-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 after GSD brownfield initialization*
