#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOGS_DIR="$ROOT/logs"
READY_DIR="$ROOT/IPHONE/READY"
APPLE_GEN_DIR="$ROOT/src-tauri/gen/apple"
mkdir -p "$LOGS_DIR" "$READY_DIR"

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

test_internet() {
  curl -I --silent --max-time 6 https://registry.npmjs.org/ >/dev/null 2>&1
}

ensure_key_api() {
  cd "$ROOT"
  if [[ -f "$ROOT/scripts/apply-key-api.mjs" ]]; then
    node "$ROOT/scripts/apply-key-api.mjs"
  fi
}

ensure_node_modules_if_possible() {
  cd "$ROOT"
  if test_internet; then
    npm install
  elif [[ -d "$ROOT/node_modules" ]]; then
    echo "[IOS] node_modules already exists. Continue offline."
  else
    echo "[IOS][ERROR] No internet and node_modules is missing." >&2
    exit 1
  fi
}

ensure_ios_init() {
  cd "$ROOT"
  local existing
  existing="$(find "$APPLE_GEN_DIR" -maxdepth 2 \( -name "*.xcodeproj" -o -name "*.xcworkspace" \) 2>/dev/null | head -n 1 || true)"
  if [[ -n "$existing" ]]; then
    echo "[IOS] iOS Xcode project already exists."
    return 0
  fi
  npm run tauri:ios:init -- --ci
}
