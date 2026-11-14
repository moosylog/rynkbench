#!/bin/sh
# Puts the WASM clients in src/vendor without Nix, from the newest green Checks
# run whose build recipe matches this checkout (see the "Keep the WASM build"
# step in .github/workflows/checks.yml). Needs the GitHub CLI, signed in.
# Usage: npm run wasm:ci
set -eu
cd "$(dirname "$0")/.."

want=$(sh scripts/wasm-recipe.sh)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

for run in $(gh run list --workflow checks.yml --status success --limit 20 --json databaseId -q '.[].databaseId'); do
  rm -rf "$tmp/build"
  gh run download "$run" --name wasm-build --dir "$tmp/build" >/dev/null 2>&1 || continue
  [ "$(cat "$tmp/build/recipe.sha256")" = "$want" ] || continue
  for client in rynk-wasm moergo-config-wasm; do
    rm -rf "src/vendor/$client"
    mkdir -p src/vendor
    cp -r "$tmp/build/$client" "src/vendor/$client"
  done
  echo "WASM clients from Checks run $run (recipe $want)"
  exit 0
done

echo "No green Checks run in the last 20 has a WASM build for this recipe ($want)." >&2
echo "Push the branch so Checks builds one, or build with Nix: npm run wasm" >&2
exit 1
