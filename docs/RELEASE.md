Documentation for the release process of DesModder:

- [ ] Make a branch `prepare/0.10.2` (swapping out for the correct version)
- [ ] Update [the changelog](https://github.com/DesModder/DesModder/blob/main/docs/CHANGELOG.md). Helpful: https://github.com/DesModder/DesModder/compare/v0.14.8...main
- [ ] Update README.md, and update the corresponding webstore description.
- [ ] Update any outdated webstore images, and add new ones for new features.
- [ ] Run `./scripts/release.sh`
- [ ] If it looks like everything is good, merge the branch into `main`
- [ ] Make a new release on [DesModder's Github release page](https://github.com/DesModder/DesModder/releases) with the zip file and most important parts of the changelog. Tag the release `vX.Y.Z` (remember the `v`).
- [ ] Use the zip from the GitHub release as the source code, and `docs/reviewer-notes-ff.md` for the Reviewer notes
