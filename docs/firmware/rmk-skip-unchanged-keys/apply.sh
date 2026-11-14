#!/bin/sh
# Applies the "do not store a key flash already holds" patch to an RMK checkout
# and runs RMK's storage tests. Usage: ./apply.sh /path/to/rmk
set -eu

here=$(cd "$(dirname "$0")" && pwd)
patch="$here/0001-storage-skip-unchanged-key-and-encoder-actions.patch"
rmk=${1:?usage: ./apply.sh /path/to/rmk}

cd "$rmk"
[ -f rmk/src/storage/mod.rs ] || { echo "not an RMK checkout: $rmk" >&2; exit 1; }

if grep -q "fn store_key_action" rmk/src/storage/mod.rs; then
  echo "already applied"
else
  git am --3way "$patch"
  echo "applied"
fi

if command -v cargo-nextest >/dev/null 2>&1 || cargo nextest --version >/dev/null 2>&1; then
  (cd rmk && cargo nextest run --no-default-features --features=vial,storage storage)
else
  echo "cargo-nextest is missing: cargo install cargo-nextest --locked, then"
  echo "  cd rmk && cargo nextest run --no-default-features --features=vial,storage storage"
fi
