This document describes DesModder's process for upgrading packages.

1. Run `npx npm-upgrade` to list the new versions of packages.
2. In separate commits, update each group of packages, testing as you go.
3. PR and merge.

If any package update requires many file changes (such as some prettier updates), then split the package bump and file changes to separate commits.

The groups of packages are:

- All the codemirror + Lezer packages (test by clicking around Text Mode)
- Both the ffmpeg packages (test every export file type)
- All the Jest packages (including Puppeteer) (test with `npm run test`)
- All the esbuild packages (restart the dev server before testing)
- Typescript and the `@types/*` (test with `npm run lint:types`)
- All the eslint packages (test with `npm run lint:eslint`)
  - Some changes can be fixed with `npm run fix:eslint`
- Prettier (test with re-run `npm run lint:formatting`)
  - Fix with `npm run fix:prettier`
- Other packages
