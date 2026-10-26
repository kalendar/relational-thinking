#!/usr/bin/env bash
# Builds every tool from source and assembles the GitHub Pages site in _site/.
# The live site at kalendar.github.io/relational-thinking is exactly this folder.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf _site
mkdir _site

# Tools with a build step: tools/<name>/build.js writes tools/<name>/dist/<name>.html
for build in tools/*/build.js; do
  name=$(basename "$(dirname "$build")")
  node "$build" >/dev/null
  cp "tools/$name/dist/$name.html" _site/
done

# Single-file tools and the tools index page are published as they are.
cp tools/splitters/*.html _site/
cp tools/index.html _site/
touch _site/.nojekyll

echo "Assembled _site/:"
ls -1 _site
