#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
bash "scripts/ios/run-ios-simulator.sh" "$@"
