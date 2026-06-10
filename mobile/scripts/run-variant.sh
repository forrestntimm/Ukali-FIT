#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: bash scripts/run-variant.sh <athlete|coach> <start|ios|android|prep-ios> [extra args...]"
  exit 1
fi

variant="$1"
mode="$2"
shift 2

if [[ "$variant" != "athlete" && "$variant" != "coach" ]]; then
  echo "Invalid variant: $variant (expected athlete or coach)"
  exit 1
fi

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
expo_process_pattern="${project_root}/node_modules/.bin/expo"

fix_ios_bundle_script_path() {
  local pbxproj
  for pbxproj in "${project_root}"/ios/*.xcodeproj/project.pbxproj; do
    [[ -f "$pbxproj" ]] || continue
    node - "$pbxproj" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let source = fs.readFileSync(file, "utf8");
const originalSource = source;

const oldCommand =
  "`\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\"`";
const brokenCommand =
  "RN_XCODE_SCRIPT_PATH=\\\"$(\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\")\\\"\\\\n\\\"$RN_XCODE_SCRIPT_PATH\\\"";
const newCommand =
  "RN_XCODE_SCRIPT_PATH=\\\"$(\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\")\\\"\\n\\\"$RN_XCODE_SCRIPT_PATH\\\"";

if (source.includes(oldCommand)) {
  source = source.split(oldCommand).join(newCommand);
}
if (source.includes(brokenCommand)) {
  source = source.split(brokenCommand).join(newCommand);
}
if (source !== originalSource) {
  fs.writeFileSync(file, source);
}
NODE
  done
}

ensure_ios_debug_bundle_fallback() {
  local updates_file="${project_root}/ios/.xcode.env.updates"

  local app_delegate
  for app_delegate in "${project_root}"/ios/*/AppDelegate.mm; do
    [[ -f "$app_delegate" ]] || continue
    node - "$app_delegate" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let source = fs.readFileSync(file, "utf8");

const supportedFallbackBlock = `return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@".expo/.virtual-metro-entry" fallbackURLProvider:^NSURL *{
    return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
  }];`;

source = source.replace(
  /return \[\[RCTBundleURLProvider sharedSettings\] jsBundleURLForBundleRoot:@\"\.expo\/\.virtual-metro-entry\"[\s\S]*?\]\];/g,
  supportedFallbackBlock
);

if (source.includes('jsBundleURLForBundleRoot:@".expo/.virtual-metro-entry"')) {
  fs.writeFileSync(file, source);
}
NODE
  done

  cat >"$updates_file" <<'EOF'
# Keep an embedded JS bundle in Debug builds so the app can boot even when Metro
# is temporarily unavailable, and make sure local release archives/TestFlight
# builds always embed their JS bundle.
if [[ "$CONFIGURATION" = *Debug* ]]; then
  unset SKIP_BUNDLING
fi

if [[ -n "${CONFIGURATION:-}" && "$CONFIGURATION" != *Debug* ]]; then
  unset SKIP_BUNDLING
fi
EOF
}

ensure_native_variant() {
  local platform="$1"
  local variant_marker="${project_root}/.last_${platform}_variant"
  local last_variant=""
  local platform_label=""
  local native_project_exists=false

  if [[ -f "$variant_marker" ]]; then
    last_variant="$(cat "$variant_marker")"
  fi

  if [[ "$platform" == "ios" ]]; then
    if find "${project_root}/ios" -maxdepth 1 -type d -name '*.xcodeproj' | grep -q .; then
      native_project_exists=true
    fi
  else
    if [[ -f "${project_root}/android/app/build.gradle" ]]; then
      native_project_exists=true
    fi
  fi

  if [[ "$last_variant" == "$variant" && "$native_project_exists" == true ]]; then
    return
  fi

  if [[ "$platform" == "ios" ]]; then
    platform_label="iOS"
  else
    platform_label="Android"
  fi

  echo "Switching ${platform_label} native project to ${variant} variant..."
  CI=1 npx expo prebuild --platform "$platform" --clean --no-install
  if [[ "$platform" == "ios" ]]; then
    fix_ios_bundle_script_path
    ensure_ios_debug_bundle_fallback
  fi
  echo "$variant" > "$variant_marker"
}

# Prevent athlete/coach bundle collisions by clearing stale Expo/Metro processes
# from this project before starting a new variant session.
pkill -f "$expo_process_pattern" >/dev/null 2>&1 || true

export APP_VARIANT="$variant"
export EXPO_PUBLIC_APP_VARIANT="$variant"

case "$mode" in
  start)
    exec npx expo start --dev-client --port 8081 --clear "$@"
    ;;
  ios)
    # Ensure athlete and coach compile to distinct native apps (name, scheme, bundle ID).
    # Regenerate native project when switching between variants.
    ensure_native_variant "ios"
    fix_ios_bundle_script_path
    ensure_ios_debug_bundle_fallback

    exec npx expo run:ios --port 8081 "$@"
    ;;
  android)
    ensure_native_variant "android"
    exec npx expo run:android --port 8081 "$@"
    ;;
  prep-ios)
    ensure_native_variant "ios"
    fix_ios_bundle_script_path
    ensure_ios_debug_bundle_fallback
    ;;
  *)
    echo "Invalid mode: $mode (expected start, ios, android, or prep-ios)"
    exit 1
    ;;
esac
