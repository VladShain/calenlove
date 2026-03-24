#!/bin/bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_ios-common.sh"

TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
LOG_PATH="$LOGS_DIR/ios_simulator_${TIMESTAMP}.log"
LATEST_LOG_PATH="$LOGS_DIR/ios_simulator_LATEST.log"
: > "$LOG_PATH"
: > "$LATEST_LOG_PATH"
exec > >(tee -a "$LOG_PATH" "$LATEST_LOG_PATH") 2>&1

cd "$ROOT"
ensure_key_api
ensure_node_modules_if_possible
ensure_ios_init
npm run tauri:ios:dev
