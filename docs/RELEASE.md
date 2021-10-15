Documentation for the release process of DesModder:

- [ ] Make a new release branch named `prepare-X.Y.Z`
- [ ] Bump version number in both the `package.json` and `manifest.json` following semver.
  - then run `npm install` to bump the version in `package-lock.json`
- [ ] Update [the changelog](https://github.com/DesModder/DesModder/blob/main/docs/CHANGELOG.md) with migration directions and other changes based on commits
  - Helpful: https://github.com/DesModder/DesModder/compare/v0.3.0...main
- [ ] Update README.md, and update the corresponding webstore description.
- [ ] Update any outdated webstore images, and add new ones for new features.
- [ ] Clear `dist/` then run `npm run build` to rebuild the extension into `dist/` with the new version number and changes.
- [ ] Assemble the zip file from `dist/` and release through the Chrome developer console.
- [ ] If it looks like everything is good, merge the branch into `main`
- [ ] Make a new release on [DesModder's Github release page](https://github.com/DesModder/DesModder/releases) with the zip file and most important parts of the changelog. Tag the release `vX.Y.Z` (remember the `v`).
