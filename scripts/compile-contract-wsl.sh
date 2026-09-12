#!/usr/bin/env bash
set -euo pipefail

export PATH="$(pwd)/scripts:$HOME/.local/bin:$HOME/.compact/bin:$PATH"

if ! command -v compact >/dev/null 2>&1; then
  echo "Midnight Compact manager not found. See README.md#compact-toolchain." >&2
  exit 1
fi

if ! compact compile --version >/dev/null 2>&1; then
  compact update 0.31.1
fi

cd contract
compact compile src/veil-drive.compact src/managed/veil-drive
