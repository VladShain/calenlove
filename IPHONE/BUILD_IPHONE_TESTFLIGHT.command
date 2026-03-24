#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
bash "scripts/ios/build-iphone.sh" --export-method app-store-connect "$@"
