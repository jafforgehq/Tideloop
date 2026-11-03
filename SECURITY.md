# Security

## Reporting a problem

Please report security problems privately, not in a public issue. Use GitHub's
[private vulnerability reporting](https://github.com/jafforgehq/Tideloop/security/advisories/new)
on this repository. Include what you found, how to reproduce it and which version you tested.
This is a one-person project, so replies can take a few days.

## What is in scope

- The Electron app: the preload API, the window and navigation settings, and handling of the planner file.
- The local MCP server: authentication, the `Host` and `Origin` checks, and anything a web page could do through it.
- The release pipeline: anything that could make CI sign or publish something it should not.

## How the app is built to be safe

- The planner data is one JSON file in the app's user data folder. The app makes no network calls except update checks against this project's public releases.
- The MCP server is off by default. When on, it binds to `127.0.0.1` only, requires a random bearer token, and rejects foreign `Host` and `Origin` headers.
- The window runs sandboxed with context isolation and no Node integration, and the Electron fuses are set at build time.
- The MCP token grants read and write access to the planner, including deletes. Todo titles and notes reach Claude verbatim, so text pasted from an untrusted source could attempt prompt injection. Keep the server off when you do not use it.
- Releases are signed with a Developer ID, notarized by Apple, and verified by `scripts/verify-release.sh` before CI publishes them.
- Signing secrets exist only as GitHub Actions secrets. Pull requests from forks never receive them.

## Supported versions

Only the latest release gets fixes. The app updates itself.
