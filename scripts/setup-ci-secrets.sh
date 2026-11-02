#!/usr/bin/env bash
# Stores the release secrets in GitHub. Run it yourself in a terminal: values are read
# from hidden prompts and go straight to GitHub, so they never touch the repo or a log.
set -euo pipefail

REPO=jafforgehq/Tideloop

secret() {
  local value
  read -r -s -p "$2: " value
  echo
  [ -n "$value" ] || { echo "$1 cannot be empty" >&2; exit 1; }
  printf %s "$value" | gh secret set "$1" --repo "$REPO"
}

read -r -p "Path to your exported Developer ID .p12 file: " p12
p12=${p12/#\~/$HOME}
[ -f "$p12" ] || { echo "No file at $p12" >&2; exit 1; }
base64 -i "$p12" | gh secret set CSC_LINK --repo "$REPO"

secret CSC_KEY_PASSWORD "Password you set when exporting the .p12"
secret APPLE_ID "Apple ID email"
secret APPLE_APP_SPECIFIC_PASSWORD "App-specific password from account.apple.com"
secret RELEASES_TOKEN "Fine-grained GitHub token with Contents: write on tideloop-app"

echo "Done. You can delete the .p12 file now."
gh secret list --repo "$REPO"
