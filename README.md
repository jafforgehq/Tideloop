# Tideloop

A macOS week planner. A tide chart above your week shows how full each day is, and todos drag between lists and days.

Source lives here, in a private repo. Releases and the public page live in [`jafforgehq/tideloop-app`](https://github.com/jafforgehq/tideloop-app), so the page and the updater work without access to this repo.

## Develop

```bash
npm install
npm run dev        # run the app
npm test           # unit tests
npm run e2e        # end-to-end tests against a real window
npm run typecheck
npm run dist:unsigned   # a local package, arm64, not signed
```

An unsigned build will not start on Apple silicon until it is ad-hoc signed, because the Electron fuses change the binary:

```bash
codesign --force --deep --sign - dist/mac-arm64/Tideloop.app
```

## Release

1. Bump `version` in `package.json` and add a section to `CHANGELOG.md`.
2. Push to `main`.

CI tests the push. If that version has no public release yet, it builds arm64 and x64, signs and notarizes them, refuses to continue unless `scripts/verify-release.sh` passes, publishes to `tideloop-app`, and updates the page. Installed apps pick the release up by themselves.

Secrets are set once with `scripts/setup-ci-secrets.sh`:

| Secret | What it is |
| --- | --- |
| `CSC_LINK` | The Developer ID Application certificate as a base64 `.p12` |
| `CSC_KEY_PASSWORD` | The password of that `.p12` |
| `APPLE_APP_SPECIFIC_PASSWORD` | An app-specific password for the Apple ID set in `ci.yml` |
| `RELEASES_TOKEN` | A fine-grained GitHub token with Contents: write on `tideloop-app` only |

## Claude Code

Turn on **Settings > Claude Code** in the app and run the command it copies. The server listens on `127.0.0.1:47613` while the app is open, and requires its token.

## Layout

- `src/shared`: the planner rules, dates, tide, themes. No Electron.
- `src/main`: the Electron process, plus Electron-free store, persistence, updater and MCP modules.
- `src/preload`: the narrow API the window gets.
- `src/renderer`: the React UI.
- `site`: the public page.
- `docs/superpowers`: the design and the plan.
