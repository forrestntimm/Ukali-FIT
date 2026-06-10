# Ukali Gym Management Platform

## What This Is

Ukali is a gym management platform with three connected surfaces: a backend API, a web admin dashboard, and a dual-variant Expo mobile app for athletes and coaches/admins. It manages member onboarding, class scheduling, QR-based check-in, announcements, workout tracking, and payment records for a real gym operation.

## Core Value

Members and staff can reliably manage attendance, schedules, and gym communication without fragile manual workarounds.

## Requirements

### Validated

- ✓ Multi-surface product exists across `/backend`, `/admin`, and `/mobile` — existing brownfield capability
- ✓ Members and admins can authenticate with Supabase-backed flows — existing brownfield capability
- ✓ Admins can manage users, payments, workouts, classes, schedules, and announcements — existing brownfield capability
- ✓ Athlete and coach mobile variants ship from a single Expo codebase — existing brownfield capability
- ✓ QR-based class check-in feeds attendance metrics and streak logic — existing brownfield capability

### Active

- [ ] Make mobile and web auth flows reliable for first-time and returning users
- [ ] Reduce slow-loading screens and tabs across admin web and both mobile variants
- [ ] Keep local release/build workflows stable and repeatable for iOS and upcoming Android releases
- [ ] Tighten announcement, payment, scheduling, and check-in flows so daily gym operations are dependable

### Out of Scope

- Full EAS cloud build workflow — excluded because this account uses local-only builds to avoid paid cloud usage
- Fully automated in-app Stripe payment sheet on mobile — deferred because current shipped flow is manual cash tracking plus backend intent support
- Large-scale product redesign — excluded while the priority is operational reliability and release stability

## Context

This repo is a brownfield codebase with active production use and frequent release work. The backend is a TypeScript Express API with Prisma and Supabase-backed auth. The admin site is a Vite React SPA deployed to Vercel. The mobile app is Expo/React Native and produces athlete and coach/admin binaries from one source tree with variant scripts under `mobile/scripts/`.

Recent work has focused on login reliability, splash/loading consistency, class/scheduling performance, QR check-in correctness, payment plan presets, and push notifications for announcements. Current work is still highly release-oriented, especially around local iOS build reliability and app startup speed.

## Constraints

- **Build workflow**: Local builds only — cloud EAS builds are blocked for cost reasons
- **Architecture**: One repo, three deployable surfaces — changes often span backend, web admin, and mobile together
- **Auth**: Supabase-backed auth with role checks — admin and member access must stay distinct
- **Operational reliability**: Gym staff need daily workflows to work under real-world conditions — regressions in schedules, payments, or check-in are high-friction
- **Performance**: Slow-loading mobile tabs and admin web pages are current pain points and must be treated as active product issues

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep athlete and coach/admin mobile apps in one Expo project with variant switching | Shared code reduces duplication while still allowing separate binaries | ✓ Good |
| Use local-only mobile builds and path-based submission | Avoid paid cloud builds and keep release control on the Mac | ✓ Good |
| Use Supabase for user auth/session flows across mobile and web | Reduces auth infrastructure burden and supports OTP/password/session flows | ⚠️ Revisit |
| Treat performance and auth stability as first-class roadmap work | Real users are already feeling latency and login friction | — Pending |

---
*Last updated: 2026-03-29 after GSD brownfield initialization*
