#!/usr/bin/env bash
# Stores every release secret in GitHub. Run it yourself in a terminal: values are read from
# hidden prompts and go straight to GitHub, so they never touch the repo or a log.
set -euo pipefail
umask 077

REPO=jafforgehq/Tideloop
IDENTITY='Developer ID Application: Feda Hadziselimovic (R9QFVTDHY5)'
HERE=$(cd "$(dirname "$0")" && pwd)
# Apple's LibreSSL writes a .p12 that `security import` can read on the CI runner. Newer OpenSSL defaults may not.
OPENSSL=/usr/bin/openssl

# Reads a hidden value into REPLY. Asks again if empty, so a stray Enter or a pasted newline cannot store a blank secret.
read_secret() {
  REPLY=""
  while [ -z "$REPLY" ]; do
    read -r -s -p "$1: " REPLY
    echo
  done
}

# Reads an email into REPLY. Asks again until it looks like one, so Enter alone cannot store a blank Apple ID.
read_apple_id() {
  REPLY=""
  until [[ "$REPLY" == *@*.* ]]; do
    read -r -p "Apple ID email: " REPLY
  done
}

store_apple_id() {
  read_apple_id
  printf %s "$REPLY" | gh secret set APPLE_ID --repo "$REPO"
}

store_token() {
  echo "GitHub release token"
  echo "Opening GitHub. Under Repository access pick Only select repositories, then tideloop-app."
  echo "Under Repository permissions set Contents to Read and write. Generate it and copy it."
  open "https://github.com/settings/personal-access-tokens/new?name=Tideloop%20releases&description=Publish%20Tideloop%20releases%20and%20page&contents=write"
  read_secret "Token (hidden)"
  until GH_TOKEN="$REPLY" gh api repos/jafforgehq/tideloop-app --jq .full_name >/dev/null 2>&1; do
    echo "GitHub did not accept that token. Try again."
    read_secret "Token (hidden)"
  done
  printf %s "$REPLY" | gh secret set RELEASES_TOKEN --repo "$REPO"
}

# Usage: setup-ci-secrets.sh           sets everything
#        setup-ci-secrets.sh token     replaces only the GitHub token
#        setup-ci-secrets.sh apple-id  replaces only the Apple ID
if [ "${1:-}" = "token" ]; then
  store_token
  echo "Token stored."
  exit 0
fi
if [ "${1:-}" = "apple-id" ]; then
  store_apple_id
  echo "Apple ID stored."
  exit 0
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
export EXPORT_PASS P12_PASS
EXPORT_PASS=$($OPENSSL rand -hex 24)
P12_PASS=$($OPENSSL rand -hex 24)

echo "1 of 3: signing certificate"
echo "A Keychain dialog will appear. Enter your Mac login password and allow it."
security export -k "$HOME/Library/Keychains/login.keychain-db" -t identities -f pkcs12 -P "$EXPORT_PASS" -o "$work/all.p12"
$OPENSSL pkcs12 -in "$work/all.p12" -passin env:EXPORT_PASS -nodes -out "$work/all.pem" 2>/dev/null
python3 "$HERE/pick-identity.py" "$work/all.pem" "$IDENTITY" "$work/cert.pem" "$work/key.pem"
$OPENSSL pkcs12 -export -inkey "$work/key.pem" -in "$work/cert.pem" -name "$IDENTITY" -passout env:P12_PASS -out "$work/release.p12"
base64 -i "$work/release.p12" | gh secret set CSC_LINK --repo "$REPO"
printf %s "$P12_PASS" | gh secret set CSC_KEY_PASSWORD --repo "$REPO"

echo
echo "2 of 3: Apple notarization"
echo "Opening Apple's site. Sign in, open App-Specific Passwords, and create one named Tideloop."
open "https://account.apple.com/account/manage"
store_apple_id
read_secret "App-specific password (hidden)"
printf %s "$REPLY" | gh secret set APPLE_APP_SPECIFIC_PASSWORD --repo "$REPO"

echo
echo "3 of 3"
store_token

echo
gh secret list --repo "$REPO"
echo "All done. Tell Claude, or re-run the failed workflow with: gh run rerun --failed \$(gh run list --repo $REPO --branch main --limit 1 --json databaseId --jq '.[0].databaseId') --repo $REPO"
