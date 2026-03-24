#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
bash "scripts/ios/check-ios-env.sh" "$@"
