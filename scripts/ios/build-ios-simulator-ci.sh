#!/bin/bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_ios-common.sh"

TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
LOG_PATH="$LOGS_DIR/iphone_ci_simulator_${TIMESTAMP}.log"
LATEST_LOG_PATH="$LOGS_DIR/iphone_ci_simulator_LATEST.log"
APPLE_BUILD_DIR="$ROOT/src-tauri/gen/apple/build"
APP_NAME="LoversCalendar"
APPETIZE_RESPONSE_PATH="$READY_DIR/appetize-response.json"
SUMMARY_PATH="$READY_DIR/CI_SUMMARY.md"
INFO_PATH="$READY_DIR/CI_LATEST_BUILD_INFO.txt"
PACKAGE_VERSION=""
NETWORK_STATE="offline"
SIM_TARGET=""

mkdir -p "$LOGS_DIR" "$READY_DIR"
: > "$LOG_PATH"
: > "$LATEST_LOG_PATH"
exec > >(tee -a "$LOG_PATH" "$LATEST_LOG_PATH") 2>&1

step() {
  echo "[IOS-CI] $1"
}

die() {
  echo
  echo "[IOS-CI][ERROR] $1"
  exit 1
}

ensure_cocoapods() {
  if has_cmd pod; then
    step "CocoaPods already exists."
    return 0
  fi

  if has_cmd brew; then
    step "CocoaPods not found. Installing with Homebrew..."
    brew install cocoapods
    return 0
  fi

  die "CocoaPods not found and Homebrew is unavailable."
}

choose_simulator_target() {
  if [[ "$(uname -m)" == "arm64" ]]; then
    echo "aarch64-sim"
  else
    echo "x86_64"
  fi
}

build_simulator_bundle() {
  step "Cleaning stale Tauri iOS simulator artifacts..."
  rm -rf "$APPLE_BUILD_DIR/arm64-sim" "$APPLE_BUILD_DIR/aarch64-sim" "$APPLE_BUILD_DIR/x86_64" "$ROOT/src-tauri/gen/apple"/*.xcarchive

  step "Building iOS Simulator app through official Tauri CLI route..."
  step "Simulator target: $SIM_TARGET"
  npm run tauri:ios:build -- --target "$SIM_TARGET" --debug
}

find_simulator_app() {
  find "$APPLE_BUILD_DIR" -type d -name '*.app' \( -path "*$SIM_TARGET/*" -o -path '*debug*/*' -o -path '*iphonesimulator/*' \) | sort | head -n 1 || true
}

zip_app_bundle() {
  local app_path="$1"
  local versioned_zip="$READY_DIR/${APP_NAME}_iOS_Simulator_${PACKAGE_VERSION}.zip"
  local latest_zip="$READY_DIR/${APP_NAME}_iOS_Simulator_latest.zip"

  rm -f "$versioned_zip" "$latest_zip"
  ditto -c -k --sequesterRsrc --keepParent "$app_path" "$versioned_zip"
  cp -f "$versioned_zip" "$latest_zip"
  echo "$versioned_zip"
}

publish_to_appetize_if_configured() {
  local zip_path="$1"
  rm -f "$APPETIZE_RESPONSE_PATH"

  if [[ -z "${APPETIZE_API_TOKEN:-}" ]]; then
    step "APPETIZE_API_TOKEN is empty. Skip Appetize upload."
    return 0
  fi

  local endpoint="https://api.appetize.io/v1/apps"
  if [[ -n "${APPETIZE_PUBLIC_KEY:-}" ]]; then
    endpoint="$endpoint/$APPETIZE_PUBLIC_KEY"
    step "Updating existing Appetize build..."
  else
    step "Creating new Appetize iOS build..."
  fi

  curl -sS -X POST "$endpoint"     -H "X-API-KEY: $APPETIZE_API_TOKEN"     -F "file=@${zip_path}"     -F "platform=ios"     -F "note=LoversCalendar ${PACKAGE_VERSION} GitHub Actions build ${GITHUB_RUN_NUMBER:-0}"     > "$APPETIZE_RESPONSE_PATH"

  if [[ ! -s "$APPETIZE_RESPONSE_PATH" ]]; then
    die "Appetize response is empty."
  fi

  step "Appetize upload finished. Response saved to $APPETIZE_RESPONSE_PATH"
}

cd "$ROOT"
PACKAGE_VERSION="$(node -p "require('./package.json').version")"
SIM_TARGET="$(choose_simulator_target)"

echo "========================================"
echo "LOVERS CALENDAR ${PACKAGE_VERSION}"
echo "IOS GITHUB ACTIONS SIMULATOR BUILD"
echo "========================================"

if [[ "$(uname -s)" != "Darwin" ]]; then
  die "This script must run on macOS."
fi

for cmd in node npm cargo rustup xcodebuild xcode-select xcrun curl; do
  has_cmd "$cmd" || die "$cmd was not found."
done

ensure_cocoapods
ensure_key_api
if test_internet; then
  NETWORK_STATE="online"
fi

step "Ensuring npm dependencies..."
ensure_node_modules_if_possible

INSTALLED_TARGETS="$(rustup target list --installed)"
for target in aarch64-apple-ios-sim aarch64-apple-ios x86_64-apple-ios; do
  if ! echo "$INSTALLED_TARGETS" | grep -qx "$target"; then
    step "Adding missing Rust target: $target"
    rustup target add "$target"
  fi
done

step "Ensuring iOS project exists..."
ensure_ios_init
build_simulator_bundle
APP_BUNDLE="$(find_simulator_app)"
[[ -n "$APP_BUNDLE" ]] || die "Simulator .app was not found after Tauri iOS build."
step "Simulator app: $APP_BUNDLE"

ZIP_PATH="$(zip_app_bundle "$APP_BUNDLE")"
step "Simulator zip: $ZIP_PATH"

APPETIZE_UPLOAD_STATE="disabled"
if [[ -n "${APPETIZE_API_TOKEN:-}" ]]; then
  APPETIZE_UPLOAD_STATE="enabled"
fi

cat > "$INFO_PATH" <<INFO
Project: $APP_NAME
Version: $PACKAGE_VERSION
Date: $(date '+%Y-%m-%d %H:%M:%S')
Network during build: $NETWORK_STATE
Build route: tauri ios build --target $SIM_TARGET --debug
Apple build dir: $APPLE_BUILD_DIR
Simulator target: $SIM_TARGET
Simulator app: $APP_BUNDLE
Simulator zip: $ZIP_PATH
Appetize upload: $APPETIZE_UPLOAD_STATE
INFO

publish_to_appetize_if_configured "$ZIP_PATH"

APPETIZE_URL="not uploaded"
APPETIZE_PUBLIC_KEY_VALUE="not created"
if [[ -s "$APPETIZE_RESPONSE_PATH" ]]; then
  APPETIZE_URL="$(node -e 'const fs = require("fs"); const p = process.argv[1]; const d = JSON.parse(fs.readFileSync(p, "utf8")); process.stdout.write(d.publicURL || d.appURL || "uploaded");' "$APPETIZE_RESPONSE_PATH" 2>/dev/null || echo 'uploaded')"
  APPETIZE_PUBLIC_KEY_VALUE="$(node -e 'const fs = require("fs"); const p = process.argv[1]; const d = JSON.parse(fs.readFileSync(p, "utf8")); process.stdout.write(d.publicKey || "created");' "$APPETIZE_RESPONSE_PATH" 2>/dev/null || echo 'created')"
fi

cat > "$SUMMARY_PATH" <<SUMMARY
# iOS Simulator CI Summary

- App: $APP_NAME
- Version: $PACKAGE_VERSION
- Build route: tauri ios build --target $SIM_TARGET --debug
- Network: $NETWORK_STATE
- Simulator target: $SIM_TARGET
- Zip: $(basename "$ZIP_PATH")
- Appetize upload: $APPETIZE_UPLOAD_STATE
- Appetize URL: $APPETIZE_URL
- Appetize public key: $APPETIZE_PUBLIC_KEY_VALUE
SUMMARY

step "CI simulator build finished successfully."
step "Summary: $SUMMARY_PATH"
step "Info: $INFO_PATH"
