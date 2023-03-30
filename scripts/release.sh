#!/bin/bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: release.sh [version]"
  exit 1
fi

version="$1"

echo "Updating package version"
npm --no-git-tag-version version "$version"

echo "Updating extension version"
for file in public/{chrome,firefox}/manifest.json; do
  jq --arg version "$version" '.version |= $version' "$file" | sponge "$file"
  npx prettier --write "$file"
done

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
