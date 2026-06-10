#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: bash scripts/build-local-ios.sh <athlete|coach>" >&2
  exit 1
fi

variant="$1"
if [[ "$variant" != "athlete" && "$variant" != "coach" ]]; then
  echo "Invalid variant: $variant (expected athlete or coach)" >&2
  exit 1
fi

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export_options_plist="${project_root}/scripts/ExportOptions-app-store.plist"
ipa_validator="${project_root}/scripts/validate-ios-ipa.sh"
development_team="${APPLE_DEVELOPMENT_TEAM:-JPJ5ZDYGLP}"
profile_uuid="${IOS_PROVISIONING_PROFILE_UUID:-}"
profile_specifier="${IOS_PROVISIONING_PROFILE_SPECIFIER:-}"
code_sign_identity="${IOS_CODE_SIGN_IDENTITY:-Apple Distribution}"
export_options_path="$export_options_plist"
entitlements_override_path=""

case "$variant" in
  athlete)
    export APP_VARIANT="athlete"
    export EXPO_PUBLIC_APP_VARIANT="athlete"
    export EXPO_PUBLIC_MAGIC_LINK_REDIRECT_URL="ukali://auth/callback"
    ;;
  coach)
    export APP_VARIANT="coach"
    export EXPO_PUBLIC_APP_VARIANT="coach"
    export EXPO_PUBLIC_MAGIC_LINK_REDIRECT_URL="ukali-coach://auth/callback"
    ;;
esac

cd "$project_root"

bash scripts/run-variant.sh "$variant" prep-ios
npx pod-install --non-interactive
# pod install can regenerate Expo updates env files, so reapply variant-specific
# iOS prep afterwards to keep .xcode.env.updates and Xcode script fixes in place.
bash scripts/run-variant.sh "$variant" prep-ios

project_name="$(find ios -maxdepth 1 -type d -name '*.xcodeproj' -exec basename {} .xcodeproj \; | head -n 1)"
if [[ -z "$project_name" ]]; then
  echo "Could not find generated Xcode project under ios/" >&2
  exit 1
fi

workspace_path="${project_root}/ios/${project_name}.xcworkspace"
info_plist_path="${project_root}/ios/${project_name}/Info.plist"
if [[ ! -d "$workspace_path" ]]; then
  echo "Missing CocoaPods workspace: $workspace_path" >&2
  exit 1
fi
if [[ ! -f "$info_plist_path" ]]; then
  echo "Missing Info.plist: $info_plist_path" >&2
  exit 1
fi

resolved_config_json="$(npx expo config --json)"
resolved_version="$(printf '%s' "$resolved_config_json" | jq -r '.version // empty')"
resolved_build_number="$(printf '%s' "$resolved_config_json" | jq -r '.ios.buildNumber // empty')"

if [[ -n "$resolved_version" ]]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $resolved_version" "$info_plist_path"
fi

if [[ -n "$resolved_build_number" ]]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $resolved_build_number" "$info_plist_path"
fi

version="$(
  /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$info_plist_path"
)"
build_number="$(
  /usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$info_plist_path"
)"
bundle_identifier="$(
  /usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$info_plist_path"
)"
if [[ "$bundle_identifier" == '$('*')' ]]; then
  bundle_identifier="$(
    xcodebuild \
      -workspace "$workspace_path" \
      -scheme "$project_name" \
      -showBuildSettings 2>/dev/null | \
      awk -F' = ' '/^[[:space:]]*PRODUCT_BUNDLE_IDENTIFIER = / { print $2; exit }'
  )"
fi
if [[ -z "$bundle_identifier" || "$bundle_identifier" == '$('*')' ]]; then
  echo "Could not resolve PRODUCT_BUNDLE_IDENTIFIER for $project_name" >&2
  exit 1
fi
default_entitlements_path="${project_root}/ios/${project_name}/${project_name}.entitlements"

timestamp="$(date +%s)"
archive_path="${project_root}/ios/build/${project_name}-${timestamp}.xcarchive"
export_dir="${project_root}/ios/build/export-${project_name}-${timestamp}"
mkdir -p "${project_root}/ios/build" "${project_root}/local-builds"
rm -rf "$archive_path" "$export_dir"

echo "Archiving ${project_name} (${version} build ${build_number})..."
signing_args=(
  CODE_SIGN_STYLE=Automatic
  DEVELOPMENT_TEAM="$development_team"
  -allowProvisioningUpdates
)

if [[ -n "$profile_uuid" || -n "$profile_specifier" ]]; then
  signing_args=(
    CODE_SIGN_STYLE=Manual
    DEVELOPMENT_TEAM="$development_team"
    CODE_SIGN_IDENTITY="$code_sign_identity"
  )
  if [[ -n "$profile_uuid" ]]; then
    signing_args+=(PROVISIONING_PROFILE="$profile_uuid")
  fi
  if [[ -n "$profile_specifier" ]]; then
    signing_args+=(PROVISIONING_PROFILE_SPECIFIER="$profile_specifier")
  fi

  if [[ -f "$default_entitlements_path" ]]; then
    entitlements_override_path="${project_root}/ios/build/${project_name}-${timestamp}.entitlements"
    cp "$default_entitlements_path" "$entitlements_override_path"
    if /usr/libexec/PlistBuddy -c "Print :aps-environment" "$entitlements_override_path" >/dev/null 2>&1; then
      /usr/libexec/PlistBuddy -c "Set :aps-environment production" "$entitlements_override_path"
    fi
    signing_args+=(CODE_SIGN_ENTITLEMENTS="$entitlements_override_path")
  fi

  export_options_path="${project_root}/ios/build/ExportOptions-${project_name}-${timestamp}.plist"
  cp "$export_options_plist" "$export_options_path"
  /usr/libexec/PlistBuddy -c "Set :signingStyle manual" "$export_options_path"
  /usr/libexec/PlistBuddy -c "Add :teamID string $development_team" "$export_options_path" 2>/dev/null || \
    /usr/libexec/PlistBuddy -c "Set :teamID $development_team" "$export_options_path"
  /usr/libexec/PlistBuddy -c "Add :provisioningProfiles dict" "$export_options_path" 2>/dev/null || true

  export_profile_value="$profile_specifier"
  if [[ -z "$export_profile_value" ]]; then
    export_profile_value="$profile_uuid"
  fi
  if [[ -n "$export_profile_value" ]]; then
    /usr/libexec/PlistBuddy -c "Add :provisioningProfiles:$bundle_identifier string $export_profile_value" "$export_options_path" 2>/dev/null || \
      /usr/libexec/PlistBuddy -c "Set :provisioningProfiles:$bundle_identifier $export_profile_value" "$export_options_path"
  fi
fi

xcodebuild \
  -workspace "$workspace_path" \
  -scheme "$project_name" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$archive_path" \
  "${signing_args[@]}" \
  archive

echo "Exporting IPA..."
xcodebuild \
  -exportArchive \
  -archivePath "$archive_path" \
  -exportPath "$export_dir" \
  -exportOptionsPlist "$export_options_path" \
  "${signing_args[@]}"

ipa_path="$(find "$export_dir" -maxdepth 1 -type f -name '*.ipa' | head -n 1)"
if [[ -z "$ipa_path" ]]; then
  echo "Export failed: no IPA found in $export_dir" >&2
  exit 1
fi

bash "$ipa_validator" "$ipa_path"

stable_copy="${project_root}/local-builds/${project_name}-${version}-build${build_number}-local.ipa"
if [[ -f "$stable_copy" && "${ALLOW_OVERWRITE_LOCAL_IPA:-0}" != "1" ]]; then
  echo "Refusing to overwrite existing stable IPA: $stable_copy" >&2
  echo "Bump the iOS build number before creating another upload candidate, or set ALLOW_OVERWRITE_LOCAL_IPA=1 to replace it intentionally." >&2
  exit 1
fi
cp "$ipa_path" "$stable_copy"
bash "$ipa_validator" "$stable_copy"

echo "Local IPA ready:"
echo "$stable_copy"
