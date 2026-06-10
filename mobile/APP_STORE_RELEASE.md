# App Store Release Guide

Before every release, run the full preflight in [APP_STORE_PRECHECKLIST.md](/Users/forresttimm/Documents/Ukali sign in app/mobile/APP_STORE_PRECHECKLIST.md).

This mobile workspace ships two iOS apps from one Expo project:

- `Ukali Fit` athlete app
- `Ukali Admin` coach/admin app

Each app has its own bundle identifier and its own App Store Connect record.

## 1. Required accounts

- Apple Developer Program membership
- Expo account with access to the EAS project
- App Store Connect access for both app records

## 2. Required environment variables

Set these before building:

```bash
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EXPO_PUBLIC_ADMIN_APP_URL=https://ukalifitadmin.com
EXPO_PUBLIC_EAS_PROJECT_ID=
APP_VERSION=1.0.0
IOS_BUILD_NUMBER_ATHLETE=1
IOS_BUILD_NUMBER_COACH=1
ANDROID_VERSION_CODE_ATHLETE=1
ANDROID_VERSION_CODE_COACH=1
```

## 3. First-time Expo setup

```bash
cd mobile
npx eas-cli login
npx eas-cli build:configure
```

If `build:configure` asks to link an Expo project, use the same project for both variants and save the project ID into `EXPO_PUBLIC_EAS_PROJECT_ID`.

## 4. Create App Store Connect records

Create two iOS apps in App Store Connect:

- `Ukali Fit`
  - bundle ID: `com.forresttimm.ukalifit`
- `Ukali Admin`
  - bundle ID: `com.forresttimm.ukaliadmin`

## 5. Build for iOS locally

Athlete app:

```bash
cd mobile
npm run eas:build:local:ios:athlete
```

Coach/admin app:

```bash
cd mobile
npm run eas:build:local:ios:coach
```

Each build writes a stable IPA into `mobile/local-builds/` using the format:

- `UkaliFit-<version>-build<build>-local.ipa`
- `UkaliAdmin-<version>-build<build>-local.ipa`

The local build helper validates the exported IPA before and after copying it into `local-builds/`.

## 6. Validate the artifact before upload

Athlete example:

```bash
cd mobile
bash scripts/validate-ios-ipa.sh "/absolute/path/to/UkaliFit-1.0.0-build40-local.ipa"
```

Coach/admin example:

```bash
cd mobile
bash scripts/validate-ios-ipa.sh "/absolute/path/to/UkaliAdmin-1.0.0-build40-local.ipa"
```

## 7. Upload to App Store Connect

Primary path: Transporter

- Open Transporter
- Drag the validated IPA from `mobile/local-builds/`
- Deliver the upload

Optional CLI path if you need it:

Athlete app:

```bash
cd mobile
IPA_PATH=/absolute/path/to/UkaliFit-1.0.0-build40-local.ipa npm run eas:submit:ios:athlete
```

Coach/admin app:

```bash
cd mobile
IPA_PATH=/absolute/path/to/UkaliAdmin-1.0.0-build40-local.ipa npm run eas:submit:ios:coach
```

Both submit scripts are path-based only and non-interactive. They do not fetch artifacts from the cloud.

## 8. Final App Store checklist

- App name, subtitle, description, keywords
- Privacy policy URL
- Support URL
- Screenshots for required iPhone sizes
- App icon
- Age rating
- Export compliance answers
- Notification usage explanation
- TestFlight internal test before App Review submission

## 9. Important notes

- Push notifications require a valid Expo project ID in `EXPO_PUBLIC_EAS_PROJECT_ID`.
- Production iOS submits still use the EAS `athlete-production` and `coach-production` profiles in [eas.json](/Users/forresttimm/Documents/Ukali sign in app/mobile/eas.json), but builds themselves stay local-only.
- Build numbers must increase on every App Store upload.
- Do not overwrite an existing stable IPA for the same build number unless you intentionally set `ALLOW_OVERWRITE_LOCAL_IPA=1`.
