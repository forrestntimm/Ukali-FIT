# Phase 1: Auth And Release Reliability - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 stabilizes sign-in, session persistence, startup reliability, and local release mechanics across backend, admin web, and both mobile variants. The goal is not to add new product capability. The goal is to make the current onboarding and release flows predictable, fail safely, and leak less sensitive information when things go wrong.

</domain>

<decisions>
## Implementation Decisions

### Auth reliability comes before auth expansion
- First-time and returning users must stay in the correct surface-specific auth flow. Mobile auth should never bounce users to the wrong app or the website.
- Existing OTP, password, and session flows should be hardened before adding new login methods.
- Session restore should prefer graceful recovery and clear fallback behavior over brittle startup assumptions.

### Security hardening is part of reliability for this phase
- Backend auth and release work should fail closed where practical rather than silently falling back to insecure defaults.
- Abuse-prone auth paths should be throttled and normalized so repeated requests do not become an easy attack surface.
- Sensitive backend responses should be reduced to the minimum fields needed for each admin or mobile flow.
- Internal errors should not leak raw backend details to clients.

### Local release discipline stays a hard constraint
- All mobile release work must remain local-build only.
- Build outputs must be reproducible for athlete and coach/admin variants, including embedded JS bundle and required assets.
- Signing, export, and upload steps should be documented and validated in repo-visible tooling rather than held only in session memory.

### Startup and recovery should prefer safe degradation
- Mobile startup issues should degrade into controlled loading or error states rather than hard crashes when possible.
- Cached data and cached sessions are acceptable as temporary fallbacks if live refresh fails, as long as the behavior is explicit and does not cross account boundaries.

### Claude's Discretion
- Exact test file organization and naming
- Whether certain hardening checks live as unit tests, smoke tests, or release-readiness tests
- The exact helper abstractions used to reduce repeated auth/session code

</decisions>

<specifics>
## Specific Ideas

- Security and smoothness are both required. This should feel clean to users, not merely technically secure.
- The user explicitly wants the app as clean and smooth as possible, which means security fixes should avoid adding extra friction unless the risk justifies it.
- The most important current trust points are login reliability, staying signed in correctly, safe admin access, and repeatable local release mechanics.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and roadmap
- `.planning/PROJECT.md` — project constraints, especially local-only builds and brownfield operational priorities
- `.planning/REQUIREMENTS.md` — Phase 1 requirement IDs and success targets
- `.planning/ROADMAP.md` — fixed Phase 1 scope and existing plan slots
- `.planning/STATE.md` — current GSD state for this repo

### Backend auth and access control
- `backend/src/app.ts` — security middleware and CORS setup
- `backend/src/middleware/auth.ts` — bearer-token authentication flow
- `backend/src/middleware/role.ts` — admin/member authorization gate
- `backend/src/middleware/rateLimit.ts` — existing auth throttling
- `backend/src/routes/auth.ts` — bootstrap and break-glass auth path
- `backend/src/routes/users.ts` — invite, resend, password, and admin user data exposure
- `backend/src/services/authService.ts` — legacy JWT/password flow
- `backend/src/services/supabaseAuthService.ts` — Supabase auth resolution and invite behavior
- `backend/src/utils/config.ts` — callback allowlisting, secrets, and current fail-open/fail-closed behavior

### Mobile auth and startup
- `mobile/src/context/AuthContext.tsx` — shared mobile auth/session bootstrap logic
- `mobile/src/lib/supabase.ts` — mobile session persistence storage
- `mobile/src/lib/biometricCredentials.ts` — saved password and biometric storage model
- `mobile/src/lib/sessionGuard.ts` — session access safety wrapper
- `mobile/src/lib/appCrashHandler.ts` — startup crash containment path
- `mobile/tests/app-store-readiness.test.mjs` — release/auth regression coverage

### Release workflow
- `mobile/scripts/build-local-ios.sh` — local iOS build/export flow
- `mobile/scripts/validate-ios-ipa.sh` — IPA validation path
- `mobile/APP_STORE_PRECHECKLIST.md` — release expectations
- `mobile/APP_STORE_RELEASE.md` — current release notes/process

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mobile/src/context/AuthContext.tsx`: one shared auth surface for athlete and coach/admin, so fixes here can cover both variants
- `mobile/tests/app-store-readiness.test.mjs`: already used as a release/readiness guardrail and is the right place for auth/release regressions
- `mobile/scripts/build-local-ios.sh` and `mobile/scripts/validate-ios-ipa.sh`: existing local-only release path can be tightened instead of replaced

### Established Patterns
- Backend route protection consistently uses `requireAuth` plus `requireRole`, which is good for incremental hardening
- Mobile and admin web both inject bearer tokens through API client interceptors, so auth token hygiene can be improved in one place per surface
- Supabase is the primary auth provider, while legacy JWT/password is a restricted break-glass path

### Integration Points
- Any auth or payload hardening in backend will immediately affect admin web and both mobile variants
- Release validation changes need to preserve the current local-build-only workflow and Transporter/TestFlight handoff
- Session persistence changes must be compatible with SecureStore-backed mobile sessions and current biometric login behavior

</code_context>

<deferred>
## Deferred Ideas

- Full admin MFA rollout
- Expanded audit-log product surface
- Android release parity execution
- Larger redesign or UX rework outside auth/startup/release safety

</deferred>

---

*Phase: 01-auth-and-release-reliability*
*Context gathered: 2026-03-29*
