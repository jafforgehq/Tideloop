#!/usr/bin/env bash
# Publishes site/ to the public repo's main branch, which GitHub Pages serves.
# Usage: scripts/deploy-page.sh "commit message"
set -euo pipefail

PUBLIC_REPO=jafforgehq/tideloop-app
message=${1:?commit message required}

version=$(gh release view --repo "$PUBLIC_REPO" --json tagName --jq .tagName 2>/dev/null || true)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# CI has no git credentials of its own. A local run already does, so leave its git config alone.
if [ -n "${CI:-}" ]; then gh auth setup-git; fi
gh repo clone "$PUBLIC_REPO" "$work" -- --depth 1 --quiet
rsync -a --delete --exclude .git site/ "$work/"
node scripts/stamp-page.mjs "$work/index.html" "${version#v}"

cd "$work"
git add -A
if git diff --cached --quiet; then
  echo "Page is already up to date."
  exit 0
fi
git -c user.name="Tideloop release" -c user.email="noreply@users.noreply.github.com" commit -q -m "$message"
git push -q origin HEAD:main
echo "Page published for release ${version:-none yet}."
