#!/usr/bin/env bash
# Fails unless every app and disk image given is signed by our Developer ID and notarized.
set -euo pipefail

TEAM=R9QFVTDHY5
status=0

fail() {
  echo "FAIL: $1" >&2
  status=1
}

for item in "$@"; do
  echo "== $item"
  [ -e "$item" ] || { fail "$item does not exist"; continue; }
  details=$(codesign -dvv "$item" 2>&1 || true)
  grep -q "^TeamIdentifier=$TEAM$" <<<"$details" || fail "$item is not signed by team $TEAM"
  grep -q "^Authority=Developer ID Application" <<<"$details" || fail "$item has no Developer ID signature"
  xcrun stapler validate "$item" >/dev/null 2>&1 || fail "$item has no stapled notarization ticket"
  case "$item" in
    *.app)
      codesign --verify --deep --strict "$item" 2>/dev/null || fail "$item does not pass codesign verification"
      grep -q "flags=.*runtime" <<<"$details" || fail "$item has no hardened runtime"
      spctl --assess --type execute "$item" 2>/dev/null || fail "$item is rejected by Gatekeeper"
      ;;
    *.dmg)
      spctl --assess --type open --context context:primary-signature "$item" 2>/dev/null || fail "$item is rejected by Gatekeeper"
      ;;
  esac
done

[ "$status" -eq 0 ] && echo "All signed and notarized."
exit "$status"
