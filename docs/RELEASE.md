Documentation for the release process of DesModder:

- [ ] Make a new release branch named `prepare-X.Y.Z`
- [ ] Bump version number in both the `package.json` and `manifest.json` following semver.
- [ ] Clear `dist/` then run `npm run build` to rebuild the extension into `dist/` with the new version number and changes.
- [ ] Update [the changelog](https://github.com/jared-hughes/DesModder/blob/main/docs/CHANGELOG.md) with migration directions and other changes based on commits
- [ ] If it looks like everything is good, merge the branch into `main`
- [ ] Assemble the CRX zip
- [ ] Make a new release on [DesModder's Github release page](https://github.com/jared-hughes/DesModder/releases) with the CRX and most important parts of the changelog. Tag the release `vX.Y.Z` (remember the `v`).
