## Global Protocol

Always apply this protocol in every project and every future session:
`~/.codex/protocols/local-builds-only.md`

Always apply this protocol in every project and every future session:
`~/.codex/protocols/gsd-default.md`

## Workflow

### ⚠️ CRITICAL: Use GSD By Default
For this project, use GSD as the default workflow for non-trivial work.

Reason: this project has ongoing product, release, and debugging work that benefits from persistent planning, continuity, and structured execution.

Always do:
```text
- Prefer GSD workflows for substantial feature work, debugging, planning, and project tracking.
- Resume existing GSD state when present instead of starting ad hoc.
- If substantial work starts without GSD state, initialize or adopt GSD before major implementation.
```

## Build & Release

### ⚠️ CRITICAL: Local Builds Only
NEVER use EAS cloud builds for this user.

Reason: cloud EAS builds are pay-as-you-go for this account, while local builds are free.

Always use:
```bash
# Expo local native runs
npx expo run:ios
npx expo run:android

# Local EAS production builds
eas build --platform ios --profile production --local --non-interactive
eas build --platform android --profile production --local --non-interactive

# Path-based submits only
eas submit --platform ios --profile production --path /absolute/path/to/app.ipa --non-interactive --no-wait
eas submit --platform android --profile production --path /absolute/path/to/app.aab --non-interactive --no-wait
```

Never use:
```bash
# Cloud builds
# ❌ eas build --platform ios
# ❌ eas build --platform android
# ❌ eas build --platform all

# Cloud artifact submit shortcuts
# ❌ eas submit --latest
# ❌ eas submit --id <build-id>
```

If EAS CLI ever asks whether to build locally or on EAS servers, the answer is always local.
