# Plan 01-02 Summary

## Outcome

Completed the release-reliability slice for Phase 1.

This execution removed the remaining ambiguity between local builds, IPA validation, and release documentation so the repo now presents one repeatable local-only iOS shipping path for both variants.

## Changes Shipped

### 1. Top-level release commands now route to the local build path

- `eas:build:ios:athlete` now delegates to the local athlete archive/export helper.
- `eas:build:ios:coach` now delegates to the local coach/admin archive/export helper.
- Submit commands now require an explicit absolute `IPA_PATH` and remain path-based, non-interactive, and no-wait.

Files:
- `mobile/package.json`

### 2. IPA validation now checks release metadata discipline

- Validation still enforces embedded `main.jsbundle` and `assets/`.
- Validation now also inspects the embedded `Info.plist`.
- Stable IPA filenames under `local-builds/` must match the embedded version and build number.

Files:
- `mobile/scripts/validate-ios-ipa.sh`

### 3. Local build helper now protects stable IPA reuse mistakes

- Local builds now refuse to overwrite an existing stable IPA for the same build number unless `ALLOW_OVERWRITE_LOCAL_IPA=1` is set intentionally.
- The stable copied IPA is revalidated after copy so the repo-visible upload artifact is the validated artifact.

Files:
- `mobile/scripts/build-local-ios.sh`

### 4. Release docs now match the real local-only workflow

- Docs now point builds to the local helper commands.
- Docs now require explicit IPA validation.
- Docs now describe Transporter as the primary upload path.
- Docs now document optional path-based `eas submit` usage with `IPA_PATH=...`.
- Docs now record stable IPA path instead of cloud build IDs/URLs.

Files:
- `mobile/APP_STORE_PRECHECKLIST.md`
- `mobile/APP_STORE_RELEASE.md`

## Verification

Commands run:

```bash
cd mobile && node --test tests/app-store-readiness.test.mjs
cd mobile && ./scripts/validate-ios-ipa.sh "$(ls -t local-builds/*.ipa 2>/dev/null | head -n 1)"
cd mobile && rg -n "local|Transporter|build number|validate-ios-ipa|cloud" APP_STORE_PRECHECKLIST.md APP_STORE_RELEASE.md package.json
```

Result:
- Release-readiness regression suite passed
- Latest local IPA validated successfully
- Release docs and package scripts now visibly align on the local-only workflow

## New Test Coverage

Expanded:
- `mobile/tests/app-store-readiness.test.mjs`

The release-readiness suite now locks in:
- top-level iOS build commands stay local-only
- submit commands require explicit absolute IPA paths
- IPA validator checks embedded version/build metadata
- release docs and package scripts stay aligned on local-only build and Transporter-friendly upload behavior

## Scope Notes

- This plan standardized the repo-visible release process but did not create a new build.
- Existing local IPA artifacts remain valid inputs to the updated validator.
- Android release-path hardening remains outside this slice.

## Follow-On Work

Best next execution target:
- `01-03-PLAN.md` for startup crash and recovery hardening
