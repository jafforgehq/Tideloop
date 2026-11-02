# Tideloop design

## Intent

A macOS desktop planner for day-to-day use. The week is the home screen, and a tide curve above it shows how full each day is. Todos move by drag between lists and days. The chosen look is mock A, "Tide chart", from the design canvas.

## Requirements from the owner

- Electron app with weekly overview, todo lists, calendar overview, and moving todos onto days.
- Tide chart direction (mock A).
- Themes and an update system, done well.
- An MCP server inside the app, so Claude Code can read and edit the planner.
- Private GitHub repo. Version starts at 0.0.1.
- CI/CD: a new version pushed gets built, signed, notarized and released.
- A public GitHub page, created only after signed and notarized builds exist.

## Non-goals for 0.0.1

Windows and Linux builds, calendar sync, recurring items, reminders, Sunday-first weeks, multiple windows, iCloud or other device sync.

## Decisions

Each of these was the builder's call, not the owner's.

| Topic | Decision | Rejected, and why |
| --- | --- | --- |
| Source and downloads | Private `jafforgehq/Tideloop` holds source. Public `jafforgehq/tideloop-app` holds only the page and release files. | One private repo: its release files are not downloadable without a token, so neither the page nor the updater could work for anyone. |
| Update feed | `electron-updater`, GitHub provider, reading public `tideloop-app` releases. | Own server: more to run, nothing gained. |
| Release trigger | Push to `main`. If the `package.json` version has no release yet, build and publish. | Tag push: an extra manual step, and the owner asked for deploy on push. |
| CI cost | Tests run on Linux. Only the release job uses a macOS runner, because macOS minutes bill at 10x on private repos. | Tests on macOS for every push: burns the free minutes quickly. |
| Data | One JSON file in `userData`, written atomically, with a `.bak` copy. Main process owns the state. | SQLite: native rebuilds per architecture for no benefit at this data size. Renderer-owned state: MCP edits could not reach it. |
| MCP transport | Streamable HTTP on `127.0.0.1:47613`, inside the running app, with a bearer token. Off by default. | Stdio: would spawn a second Electron process against a single-instance app and a file another process owns. Limit: the app must be open. |
| UI stack | React, TypeScript, electron-vite, native HTML5 drag and `<dialog>`. | A drag library or UI kit: native parts cover the need, and they would fight the look. |
| Themes | Tokens in TypeScript, applied as CSS variables, so a test can check contrast. | Plain CSS files: contrast could not be tested. |
| Architectures | Separate arm64 and x64 builds. | Universal: doubles the download for everyone. |

## Behaviour worth pinning

- The tide height of a day is its event minutes plus its todo minutes, done todos included, so ticking something off does not make the day look emptier in hindsight. Todos default to 30 minutes.
- A full day defaults to 8 hours and is a setting. A day over it gets an accent crest and a label.
- Undone todos on past days stay where they are, and the header offers to move them to today.
- Undo covers todo, event and list changes, including edits made over MCP. Settings are not undoable.
- A data file that cannot be read is never overwritten. It is moved aside, the backup is tried, and the owner is told.
- MCP refuses a wrong token, a foreign `Host` and a foreign `Origin`, and listens only on loopback.
- Nothing is published unless the notarization checks pass in CI.
- Every drag has a keyboard equivalent.
