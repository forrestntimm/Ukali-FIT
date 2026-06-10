#!/usr/bin/env bash
set -euo pipefail

mode="${1:-start}"

echo "Variant selection is required for ${mode}."
echo "Use one of the explicit commands:"
echo "  npm run start:athlete   npm run start:coach"
echo "  npm run ios:athlete     npm run ios:coach"
echo "  npm run android:athlete npm run android:coach"
exit 1
