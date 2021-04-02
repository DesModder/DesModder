Documentation for the release process of DesModder:

- [ ] Run tests
- [ ] Make a new release branch named `prepare-X.Y.Z`
- [ ] Bump version number in `package.json`
- [ ] Run `npm run build` to rebuild the userscript into `dist/DesModder.user.js` with the new version number and changes.
- [ ] Update [the changelog](https://github.com/jared-hughes/DesModder/blob/main/docs/CHANGELOG.md) with migration directions and other changes based on commits
- [ ] If it looks like everything is good, merge the branch into `main`
- [ ] Make a new release on [DesModder's Github release page](https://github.com/jared-hughes/DesModder/releases) with the most important parts of the changelog.
