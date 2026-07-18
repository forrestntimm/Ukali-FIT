#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: bash scripts/build-local-android.sh <athlete|coach>" >&2
  exit 1
fi

variant="$1"
if [[ "$variant" != "athlete" && "$variant" != "coach" ]]; then
  echo "Invalid variant: $variant (expected athlete or coach)" >&2
  exit 1
fi

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
profile="${variant}-production"
local_jdk_home="${HOME}/.local/jdks/temurin-17/Contents/Home"
local_android_home="${HOME}/Library/Android/sdk"

if [[ -z "${JAVA_HOME:-}" && -x "${local_jdk_home}/bin/java" ]]; then
  export JAVA_HOME="$local_jdk_home"
fi

if [[ -z "${ANDROID_HOME:-}" && -d "$local_android_home" ]]; then
  export ANDROID_HOME="$local_android_home"
fi

if [[ -z "${ANDROID_SDK_ROOT:-}" && -n "${ANDROID_HOME:-}" ]]; then
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
fi

if [[ -n "${JAVA_HOME:-}" ]]; then
  export PATH="${JAVA_HOME}/bin:${PATH}"
fi

if [[ -n "${ANDROID_HOME:-}" ]]; then
  export PATH="${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"
fi

if ! command -v java >/dev/null 2>&1; then
  echo "Java is required for local Android builds. Install JDK 17 or set JAVA_HOME." >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}" || ! -d "$ANDROID_HOME" ]]; then
  echo "Android SDK is required for local Android builds. Install it or set ANDROID_HOME." >&2
  exit 1
fi

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

resolved_config_json="$(npx expo config --json)"
app_name="$(printf '%s' "$resolved_config_json" | jq -r '.name // "Ukali"')"
version="$(printf '%s' "$resolved_config_json" | jq -r '.version // "1.0.0"')"
version_code="$(printf '%s' "$resolved_config_json" | jq -r '.android.versionCode // 1')"
package_id="$(printf '%s' "$resolved_config_json" | jq -r '.android.package // empty')"
profile_auto_increment="$(jq -r --arg profile "$profile" '.build[$profile].autoIncrement // false' eas.json)"

if [[ -z "$package_id" ]]; then
  echo "Could not resolve android.package for $variant" >&2
  exit 1
fi

safe_name="$(printf '%s' "$app_name" | tr '[:upper:] ' '[:lower:]-' | tr -cd '[:alnum:]-')"
output_version_code="$version_code"
if [[ "$profile_auto_increment" == "true" ]]; then
  output_version_code="$((version_code + 1))"
fi
mkdir -p local-builds

stable_copy="${project_root}/local-builds/${safe_name}-${version}-versionCode${output_version_code}-local.aab"
if [[ -f "$stable_copy" && "${ALLOW_OVERWRITE_LOCAL_AAB:-0}" != "1" ]]; then
  echo "Refusing to overwrite existing stable AAB: $stable_copy" >&2
  echo "Bump the Android versionCode before creating another upload candidate, or set ALLOW_OVERWRITE_LOCAL_AAB=1 to replace it intentionally." >&2
  exit 1
fi

echo "Building ${app_name} (${package_id}) Android versionCode ${version_code} locally..."
npx eas-cli build \
  --platform android \
  --profile "$profile" \
  --local \
  --non-interactive \
  --output "$stable_copy"

if [[ ! -f "$stable_copy" ]]; then
  echo "Local Android build finished without expected AAB: $stable_copy" >&2
  exit 1
fi

unzip -t "$stable_copy" >/dev/null

echo "Local AAB ready:"
echo "$stable_copy"
