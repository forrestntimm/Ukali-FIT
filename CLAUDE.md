## Build & Release

### CRITICAL: Local Builds Only

Never use EAS cloud builds in this project. Cloud builds are pay-as-you-go on this account.

Always use local builds:
- `cd "/Users/forresttimm/Documents/Ukali sign in app/mobile" && npm run eas:build:local:ios:athlete`
- `cd "/Users/forresttimm/Documents/Ukali sign in app/mobile" && npm run eas:build:local:ios:coach`

Always submit by explicit artifact path:
- `eas submit --platform ios --profile athlete-production --path /absolute/path/to/app.ipa --non-interactive --no-wait`
- `eas submit --platform ios --profile coach-production --path /absolute/path/to/app.ipa --non-interactive --no-wait`

Never use:
- `eas build --platform ios`
- `eas build --platform ios --profile athlete-production`
- `eas build --platform ios --profile coach-production`
- `eas submit --latest`
- `eas submit --id <build-id>`
