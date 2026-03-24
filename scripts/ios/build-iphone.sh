#!/bin/bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_ios-common.sh"

TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
LOG_PATH="$LOGS_DIR/iphone_build_${TIMESTAMP}.log"
LATEST_LOG_PATH="$LOGS_DIR/iphone_build_LATEST.log"
NODE_MODULES_DIR="$ROOT/node_modules"

mkdir -p "$LOGS_DIR" "$READY_DIR"

EXPORT_METHOD="${IOS_EXPORT_METHOD:-debugging}"
BUILD_NUMBER="${IOS_BUILD_NUMBER:-}"
OPEN_XCODE=0
SKIP_INIT=0
AUTO_FIX_TARGETS=1
CI_MODE=1

usage() {
  cat <<USAGE
LOVERS CALENDAR 0.9.3 - IPHONE BUILDER

Run:
  ./IPHONE/BUILD_IPHONE.command
  ./IPHONE/BUILD_IPHONE.command --export-method debugging
  ./IPHONE/BUILD_IPHONE.command --export-method release-testing --build-number 2
  ./IPHONE/BUILD_IPHONE.command --export-method app-store-connect --open
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --export-method)
      [[ $# -ge 2 ]] || { echo "Missing export method"; exit 1; }
      EXPORT_METHOD="$2"
      shift 2
      ;;
    --build-number)
      [[ $# -ge 2 ]] || { echo "Missing build number"; exit 1; }
      BUILD_NUMBER="$2"
      shift 2
      ;;
    --open)
      OPEN_XCODE=1
      shift
      ;;
    --skip-init)
      SKIP_INIT=1
      shift
      ;;
    --no-auto-fix)
      AUTO_FIX_TARGETS=0
      shift
      ;;
    --no-ci)
      CI_MODE=0
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

case "$EXPORT_METHOD" in
  debugging|release-testing|app-store-connect) ;;
  *)
    echo "Invalid export method: $EXPORT_METHOD"
    exit 1
    ;;
esac

: > "$LOG_PATH"
: > "$LATEST_LOG_PATH"
exec > >(tee -a "$LOG_PATH" "$LATEST_LOG_PATH") 2>&1

die() {
  echo
  echo "[ERROR] $1"
  exit 1
}

step() {
  echo "[IPHONE] $1"
}


echo "========================================"
echo "LOVERS CALENDAR 0.9.3"
echo "IPHONE BUILD"
echo "========================================"

if [[ "$(uname -s)" != "Darwin" ]]; then
  die "iPhone / iOS build works only on macOS."
fi

for cmd in node npm cargo rustup xcodebuild xcode-select xcrun curl; do
  has_cmd "$cmd" || die "$cmd was not found. Install missing dependency first."
done

INSTALLED_TARGETS="$(rustup target list --installed)"
REQUIRED_TARGETS=(aarch64-apple-ios)
if [[ "$(uname -m)" == "arm64" ]]; then
  REQUIRED_TARGETS+=(aarch64-apple-ios-sim)
else
  REQUIRED_TARGETS+=(x86_64-apple-ios)
fi

MISSING_TARGETS=()
for target in "${REQUIRED_TARGETS[@]}"; do
  if ! echo "$INSTALLED_TARGETS" | grep -qx "$target"; then
    MISSING_TARGETS+=("$target")
  fi
done

if (( ${#MISSING_TARGETS[@]} > 0 )); then
  if (( AUTO_FIX_TARGETS == 1 )); then
    step "Adding missing Rust targets: ${MISSING_TARGETS[*]}"
    rustup target add "${MISSING_TARGETS[@]}"
  else
    die "Missing Rust targets: ${MISSING_TARGETS[*]}"
  fi
fi

cd "$ROOT"
ensure_key_api
PACKAGE_VERSION="$(node -p "require('./package.json').version")"
APP_NAME="LoversCalendar"
NETWORK_STATE="offline"
if test_internet; then
  NETWORK_STATE="online"
fi
step "Ensuring npm dependencies..."
ensure_node_modules_if_possible

step "Version: $PACKAGE_VERSION"
step "Export method: $EXPORT_METHOD"
step "Network for npm: $NETWORK_STATE"
step "App network note: the calendar can work locally offline; cloud sync resumes after network returns when .env is configured."

IOS_PROJECT_FILE="$(find "$APPLE_GEN_DIR" -maxdepth 2 \( -name "*.xcodeproj" -o -name "*.xcworkspace" \) 2>/dev/null | head -n 1 || true)"

if [[ -z "$IOS_PROJECT_FILE" && $SKIP_INIT -eq 1 ]]; then
  die "skip-init was used but the iOS project does not exist yet."
fi

if [[ -z "$IOS_PROJECT_FILE" && $SKIP_INIT -eq 0 ]]; then
  step "iOS project was not found. Running tauri ios init..."
  ensure_ios_init
else
  step "iOS project already exists. Skip init."
fi

BUILD_ARGS=(npm run tauri:ios:build -- --export-method "$EXPORT_METHOD")
if [[ -n "$BUILD_NUMBER" ]]; then
  BUILD_ARGS+=(--build-number "$BUILD_NUMBER")
fi
if (( OPEN_XCODE == 1 )); then
  BUILD_ARGS+=(--open)
fi

step "Running tauri ios build..."
"${BUILD_ARGS[@]}"

IPA_FILE="$(find "$APPLE_GEN_DIR" -type f -name '*.ipa' | sort | tail -n 1 || true)"
if [[ -z "$IPA_FILE" ]]; then
  die "IPA was not found after build."
fi

VERSIONED_IPA="$READY_DIR/${APP_NAME}_${PACKAGE_VERSION}.ipa"
LATEST_IPA="$READY_DIR/${APP_NAME}_latest.ipa"
INFO_FILE="$READY_DIR/LATEST_BUILD_INFO.txt"

cp -f "$IPA_FILE" "$VERSIONED_IPA"
cp -f "$IPA_FILE" "$LATEST_IPA"

cat > "$INFO_FILE" <<INFO
Project: $APP_NAME
Version: $PACKAGE_VERSION
Export method: $EXPORT_METHOD
Build number: ${BUILD_NUMBER:-not-set}
Date: $(date '+%Y-%m-%d %H:%M:%S')
Source IPA: $IPA_FILE
Copied to: $VERSIONED_IPA
Latest copy: $LATEST_IPA
Network during build: $NETWORK_STATE
App network note: local offline mode works; cloud sync resumes after network returns when .env is configured.
INFO

echo
step "Build finished. IPA copied to:"
echo "$VERSIONED_IPA"
echo "$LATEST_IPA"
echo
step "Log file: $LOG_PATH"
