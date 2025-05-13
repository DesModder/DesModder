#!/bin/bash
set -euo pipefail

prefix="prepare/"
branch="$(git rev-parse --abbrev-ref HEAD)"
version="${branch#"$prefix"}" # remove prefix

if [ "$branch" != "$prefix$version" ]; then
  echo "Must be on a branch named ${prefix}[version] like ${prefix}0.13.4"
  exit 1
fi

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  echo "Version must look like '0.13.4' but got '$version'"
  exit 1
fi

echo "Releasing version '$version'"

echo "Updating package version"
npm --no-git-tag-version version "$version"

echo "Updating extension version"
for file in public/{chrome,firefox}/manifest.json; do
  tmp=$(mktemp);
  jq --arg version "$version" '.version |= $version' "$file" > "$tmp"
  mv "$tmp" "$file"
  npx prettier --write "$file"
done

echo "Updating RELEASE.md link"
perl -pi -e 's/compare\/v\d+\.\d+\.\d+/compare\/v'"${version}"'/g' docs/RELEASE.md

git add -A
git commit -m "Prepare v$version"

echo "Building for Chrome"
rm -rf dist
npm run build
zip -r "DesModder-Chrome-v$version.zip" dist

echo "Building for Firefox"
rm -rf dist
npm run build-ff
(
  cd dist
  zip -r "DesModder-Firefox-v$version.zip" ./*
)
mv dist/*.zip .
