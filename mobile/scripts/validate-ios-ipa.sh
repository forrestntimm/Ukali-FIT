#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: bash scripts/validate-ios-ipa.sh <absolute-or-relative-path-to-ipa>" >&2
  exit 1
fi

ipa_path="$1"
if [[ ! -f "$ipa_path" ]]; then
  echo "IPA not found: $ipa_path" >&2
  exit 1
fi
ipa_filename="$(basename "$ipa_path")"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

unzip -q "$ipa_path" -d "$tmp_dir"

app_dir="$(find "$tmp_dir/Payload" -maxdepth 1 -type d -name '*.app' | head -n 1)"
if [[ -z "$app_dir" ]]; then
  echo "Invalid IPA: missing .app bundle in Payload/" >&2
  exit 1
fi

if [[ ! -f "$app_dir/main.jsbundle" ]]; then
  echo "Invalid IPA: missing embedded main.jsbundle in $app_dir" >&2
  exit 1
fi

if [[ ! -d "$app_dir/assets" ]]; then
  echo "Invalid IPA: missing embedded assets directory in $app_dir" >&2
  exit 1
fi

info_plist_path="$app_dir/Info.plist"
if [[ ! -f "$info_plist_path" ]]; then
  echo "Invalid IPA: missing Info.plist in $app_dir" >&2
  exit 1
fi

version="$(
  /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$info_plist_path" 2>/dev/null || true
)"
build_number="$(
  /usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$info_plist_path" 2>/dev/null || true
)"

if [[ -z "$version" || -z "$build_number" ]]; then
  echo "Invalid IPA: missing CFBundleShortVersionString or CFBundleVersion in $info_plist_path" >&2
  exit 1
fi

if [[ "$ipa_filename" == *"-local.ipa" && "$ipa_filename" != *"-${version}-build${build_number}-local.ipa" ]]; then
  echo "Invalid IPA: stable filename $ipa_filename does not match embedded version ${version} build ${build_number}" >&2
  exit 1
fi

echo "IPA validation passed: $ipa_path"
