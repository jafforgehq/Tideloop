# Contributing

Thanks for looking. Tideloop is a small app and I want to keep it that way, so open an issue before a big change.

## Set up

You need macOS and Node 22 or newer.

```bash
npm install
npm run dev
```

## Before you open a pull request

```bash
npm run typecheck
npm test
npm run e2e
```

CI runs the same three. Keep changes small and focused, and add a test with every behaviour change:

- Planner rules live in `src/shared/planner.ts` as a pure reducer. Test them in `tests/` first, then change the reducer.
- UI behaviour that needs a real window is covered in `e2e/`.
- Colours live in `src/shared/themes.ts`. A new theme must pass the contrast tests.

## Style

- TypeScript, no semicolons, single quotes. Match the surrounding code.
- Comments say why, not what.
- No new dependency for something a few lines can do.

## Releases

Only the maintainer releases. A release is a version bump in `package.json` and a section in `CHANGELOG.md`, merged to `main`. Pull requests should not bump the version unless asked.

## Licence

By contributing you agree that your contribution is released under the [MIT licence](LICENSE).
