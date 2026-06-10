# App Store Precheck Checklist

Use this before every new iOS/TestFlight submission for the Ukali apps.

This checklist is written for this workspace on March 20, 2026.

- Athlete app bundle ID: `com.forresttimm.ukalifit`
- Coach/admin app bundle ID: `com.forresttimm.ukaliadmin`
- Expo project: `@forrestntimm/ukali-gym`

Important Apple requirement dates:

- Since April 24, 2025, Apple requires uploads to App Store Connect to be built with Xcode 16 or later using the iOS 18 SDK or later.
- Starting April 28, 2026, Apple will require Xcode 26 or later using the iOS 26 SDK or later.

References:

- [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)
- [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Apple upload previews and screenshots help](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots)

## 1. Apple account and App Store Connect

Confirm all of these are true before building:

- Apple Developer membership is active.
- App Store Connect access works for the account doing the upload.
- `Business > Agreements` shows `Free Apps Agreement` as `Active`.
- `Business > Agreements` shows `Paid Apps Agreement` as `Active`.
- `Bank Accounts` are active if Apple requires them for the account.
- `Tax Forms` are active.
- EU trader / DSA compliance is completed if Apple shows that banner.
- No `Action Required`, `Pending User Info`, or `Incomplete` banners are visible in App Store Connect.
- Both app records already exist in App Store Connect.

App records expected in App Store Connect:

- Athlete app record using `com.forresttimm.ukalifit`
- Coach/admin app record using `com.forresttimm.ukaliadmin`

## 2. Local repo state

- Work from `/Users/forresttimm/Documents/Ukali sign in app/mobile`
- `npm install` completes successfully
- `patch-package` runs during install and applies `expo-device@5.9.4`
- No accidental config drift was introduced for the wrong app variant

Run:

```bash
cd "/Users/forresttimm/Documents/Ukali sign in app/mobile"
npm install
```

Expected:

- install succeeds
- output includes `Applying patches...`
- output includes `expo-device@5.9.4 ✔`

## 3. Build configuration sanity check

Confirm these files are correct:

- [eas.json](/Users/forresttimm/Documents/Ukali sign in app/mobile/eas.json)
- [app.config.ts](/Users/forresttimm/Documents/Ukali sign in app/mobile/app.config.ts)
- [.easignore](/Users/forresttimm/Documents/Ukali sign in app/mobile/.easignore)

Required conditions:

- `athlete-production` exists
- `coach-production` exists
- both production profiles use `distribution: "store"`
- both production profiles use `ios.image: "macos-sequoia-15.6-xcode-16.4"`
- `.easignore` contains `ios` and `android`
- Expo project ID is present
- bundle IDs match Apple exactly

Current expected bundle IDs:

- athlete: `com.forresttimm.ukalifit`
- coach/admin: `com.forresttimm.ukaliadmin`

Current expected Expo project ID:

- `e7d45f6a-4623-4cab-b778-02863de7e781`

## 4. Environment variables

Verify these values exist and point to production-safe services:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_ADMIN_APP_URL`
- `EXPO_PUBLIC_EAS_PROJECT_ID`
- `APP_VERSION`
- `IOS_BUILD_NUMBER_ATHLETE`
- `IOS_BUILD_NUMBER_COACH`
- `ANDROID_VERSION_CODE_ATHLETE`
- `ANDROID_VERSION_CODE_COACH`

Rules:

- `APP_VERSION` should be the release version you want users to see
- iOS build numbers must increase every upload
- Android version codes must increase every upload
- do not reuse an old iOS build number for the same bundle ID

## 5. Variant separation check

Make sure the athlete and coach/admin variants are not bleeding into each other.

Athlete app should resolve to:

- app name: `Ukali Fit`
- scheme: `ukali`
- bundle ID: `com.forresttimm.ukalifit`

Coach/admin app should resolve to:

- app name: `Ukali Admin`
- scheme: `ukali-coach`
- bundle ID: `com.forresttimm.ukaliadmin`

Run:

```bash
cd "/Users/forresttimm/Documents/Ukali sign in app/mobile"
APP_VARIANT=athlete EXPO_PUBLIC_APP_VARIANT=athlete npx expo config --json > /tmp/ukali-athlete-config.json
APP_VARIANT=coach EXPO_PUBLIC_APP_VARIANT=coach npx expo config --json > /tmp/ukali-coach-config.json
```

Then check:

- athlete config contains `com.forresttimm.ukalifit`
- coach config contains `com.forresttimm.ukaliadmin`
- athlete config name is `Ukali Fit`
- coach config name is `Ukali Admin`

## 6. Automated preflight checks

Run these every time before building:

```bash
cd "/Users/forresttimm/Documents/Ukali sign in app/mobile"
node --test tests/*.test.mjs
npx tsc --noEmit
```

These checks currently validate:

- EAS production profiles exist
- App Store bundle IDs are correct
- push registration uses a real Expo project ID
- `.easignore` protects cloud builds from native variant drift
- `expo-device` patch persists at install time
- iOS debug fallback bundle logic exists
- mobile auth and sync regression checks pass

Do not submit if either command fails.

## 7. Native and dependency risk review

Before building, confirm none of these changed unexpectedly:

- Expo SDK version
- React Native version
- `expo-device`
- `expo-notifications`
- `expo-camera`
- `expo-image-picker`
- iOS native patch files in `patches/`
- Xcode image in `eas.json`

If any of those changed:

- rerun all tests
- rebuild one app first
- upload to TestFlight before attempting both apps

## 8. Push notifications

Confirm push prerequisites for the app being submitted:

- Apple Push Notifications key exists
- push capability is enabled for the app ID
- `expo-notifications` plugin is still present in [app.config.ts](/Users/forresttimm/Documents/Ukali sign in app/mobile/app.config.ts)
- push token registration still passes the Expo project ID

For athlete app:

- announcements notification flow is expected
- payment reminder flow is expected

For coach/admin app:

- workout upload notification flow is expected
- coaching schedule notification flow is expected

## 9. Privacy, permissions, and legal

Confirm App Store metadata and app behavior still match:

- camera permission text is accurate
- photo library permission text is accurate
- notification permission usage is accurate
- privacy policy URL exists and is reachable
- support URL exists and is reachable
- export compliance answers are still correct
- if encrypted networking behavior changed, recheck `usesNonExemptEncryption`

Current code expectation:

- `usesNonExemptEncryption: false` remains correct in [app.config.ts](/Users/forresttimm/Documents/Ukali sign in app/mobile/app.config.ts)

Pause and re-evaluate if:

- you added third-party analytics or ad SDKs
- you added new device permissions
- you added new login or data collection behavior

## 10. Assets and App Store metadata

For each app record, confirm these exist and are current:

- app icon
- app name
- subtitle
- description
- keywords
- support URL
- privacy policy URL
- marketing URL if used
- age rating answers
- content rights answers if required

Screenshots:

- at least 1 screenshot exists
- no more than 10 screenshots per required device size and locale
- highest-resolution screenshots are uploaded
- screenshots match the current UI
- screenshots do not show debug UI, unfinished flows, fake errors, or placeholder text

Recommended iPhone coverage:

- provide the highest required iPhone screenshot size Apple accepts, then let Apple scale where allowed
- recheck current accepted screenshot sizes before each real submission because Apple updates device classes over time

## 11. Functional smoke test before build

Do one clean manual pass for the app you are submitting.

Athlete app smoke test:

- open app
- login works
- dashboard loads
- classes load
- profile loads
- announcements load
- no admin-only UI appears

Coach/admin app smoke test:

- open app
- login works
- dashboard loads
- members view loads
- payments view loads
- announcements manager loads
- WOD manager loads
- no athlete-only UI appears where it should not

If the build is for a release with a specific change, test that exact flow.

## 12. Build execution

Athlete build:

```bash
cd "/Users/forresttimm/Documents/Ukali sign in app/mobile"
npm run eas:build:local:ios:athlete
```

Coach/admin build:

```bash
cd "/Users/forresttimm/Documents/Ukali sign in app/mobile"
npm run eas:build:local:ios:coach
```

Confirm during the build:

- correct bundle identifier is shown
- correct Apple team is shown
- correct provisioning profile is shown
- push notifications are set up if prompted

If the build fails:

- inspect the local Xcode / shell output
- inspect Xcode logs before retrying
- do not immediately retry without understanding the failure

## 13. Artifact validation after build

When the `.ipa` is ready:

- confirm the build number is the intended new number
- run the validator against the stable IPA copy in `local-builds/`

Athlete example:

```bash
cd "/Users/forresttimm/Documents/Ukali sign in app/mobile"
bash scripts/validate-ios-ipa.sh "/absolute/path/to/UkaliFit-1.0.0-build40-local.ipa"
```

Coach/admin example:

```bash
cd "/Users/forresttimm/Documents/Ukali sign in app/mobile"
bash scripts/validate-ios-ipa.sh "/absolute/path/to/UkaliAdmin-1.0.0-build40-local.ipa"
```

If using Transporter:

- make sure you are uploading the latest IPA, not an older one sitting in Downloads
- confirm the uploaded build uses the required Apple SDK level
- prefer the stable copy from `mobile/local-builds/`, not the raw export directory

## 14. App Store Connect / TestFlight upload checks

After upload:

- build appears in App Store Connect
- build enters processing
- build completes processing
- no export compliance or missing metadata blockers appear
- internal testers can be added
- release notes for TestFlight are present

If the build does not appear:

- check Transporter or path-based EAS submit errors
- check App Store Connect account readiness again
- check SDK requirement compliance again

## 15. Final release gate before external testing or review

Before enabling external TestFlight or submitting for App Review:

- screenshots are current
- app description matches actual behavior
- all legal URLs are live
- notification use is described accurately
- account/login paths are reviewable by Apple
- no debug menus, red screens, or developer-only toggles are reachable
- release notes are written

## 16. Ukali-specific known traps

Do not forget these project-specific failure points:

- `.easignore` must keep `ios` and `android` out of cloud builds or variant bundle IDs can bleed together
- `expo-device@5.9.4` must remain patched or local Xcode 16.4 archives can fail with `cannot find 'TARGET_OS_SIMULATOR' in scope`
- Apple may auto-create an app record name variant like `Ukali Fit (ff1285)` if the display name is already taken during first creation
- athlete uploads must not use old locally built IPAs made with the iOS 17.5 SDK
- every upload must use a fresh build number
- do not overwrite an existing stable IPA for the same build number unless you intentionally mean to replace it

## 17. Submission log template

Record these for every release:

- date
- app variant
- git commit hash
- app version
- iOS build number
- stable IPA path
- upload method: `Transporter` or path-based `eas submit`
- App Store Connect result
- TestFlight processing result
- follow-up issues if any

This prevents guessing later about which exact binary was uploaded.
