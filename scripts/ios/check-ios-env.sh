#!/bin/bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_ios-common.sh"

TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
LOG_PATH="$LOGS_DIR/iphone_env_check_${TIMESTAMP}.log"
LATEST_LOG_PATH="$LOGS_DIR/iphone_env_check_LATEST.log"
: > "$LOG_PATH"
: > "$LATEST_LOG_PATH"
exec > >(tee -a "$LOG_PATH" "$LATEST_LOG_PATH") 2>&1

say() { echo "[IOS-CHECK] $1"; }
fail=0

say "LoversCalendar 0.9.1 iOS environment check"
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[FAIL] macOS is required for iPhone / iOS build"
  exit 1
fi

for cmd in node npm rustup cargo xcodebuild xcode-select xcrun curl; do
  if has_cmd "$cmd"; then
    echo "[OK] $cmd -> $(command -v "$cmd")"
  else
    echo "[FAIL] $cmd not found"
    fail=1
  fi
done

if has_cmd pod; then
  echo "[OK] pod -> $(command -v pod)"
else
  echo "[WARN] CocoaPods not found. Install with: brew install cocoapods"
  fail=1
fi

echo
if has_cmd xcodebuild; then
  echo "[INFO] xcodebuild version:"
  xcodebuild -version || true
fi
if has_cmd node; then
  echo "[INFO] node version: $(node -v)"
fi
if has_cmd npm; then
  echo "[INFO] npm version: $(npm -v)"
fi
if has_cmd rustup; then
  echo "[INFO] installed Rust iOS targets:"
  rustup target list --installed | grep 'apple-ios' || true
  for target in aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim; do
    if rustup target list --installed | grep -qx "$target"; then
      echo "[OK] target $target"
    else
      echo "[WARN] missing target $target"
      fail=1
    fi
  done
fi

if has_cmd security; then
  echo "[INFO] signing identities (if any):"
  security find-identity -v -p codesigning || true
fi

if [[ $fail -ne 0 ]]; then
  echo
  echo "[RESULT] Environment is NOT ready yet. Fix WARN / FAIL lines above."
  exit 1
fi

echo
say "Environment looks ready. You can run BUILD_IPHONE.command"
