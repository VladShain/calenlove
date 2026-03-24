#!/bin/bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_ios-common.sh"

TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
LOG_PATH="$LOGS_DIR/ios_open_${TIMESTAMP}.log"
LATEST_LOG_PATH="$LOGS_DIR/ios_open_LATEST.log"
: > "$LOG_PATH"
: > "$LATEST_LOG_PATH"
exec > >(tee -a "$LOG_PATH" "$LATEST_LOG_PATH") 2>&1

cd "$ROOT"
ensure_key_api
ensure_node_modules_if_possible
ensure_ios_init
PROJECT="$(find "$APPLE_GEN_DIR" -maxdepth 2 \( -name "*.xcworkspace" -o -name "*.xcodeproj" \) 2>/dev/null | head -n 1 || true)"
if [[ -z "$PROJECT" ]]; then
  echo "[IOS-OPEN][ERROR] Xcode project was not created."
  exit 1
fi
open "$PROJECT"
echo "[IOS-OPEN] Opened: $PROJECT"
