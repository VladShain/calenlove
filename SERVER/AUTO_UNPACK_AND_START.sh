#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/.env.server"
TEMPLATE_ENV="$ROOT_DIR/SERVER_ENV.txt"

if [[ -f "$TEMPLATE_ENV" && ! -f "$ENV_FILE" ]]; then
  cp "$TEMPLATE_ENV" "$ENV_FILE"
fi

DEPLOY_BASE="${DEPLOY_BASE:-$HOME/loverscalendar-server}"
if [[ -f "$ENV_FILE" ]]; then
  while IFS='=' read -r key value; do
    [[ -z "${key:-}" ]] && continue
    [[ "$key" =~ ^# ]] && continue
    if [[ "$key" == "DEPLOY_BASE" && -n "${value:-}" ]]; then
      DEPLOY_BASE="$value"
    fi
  done < "$ENV_FILE"
fi

RELEASES_DIR="$DEPLOY_BASE/releases"
CURRENT_LINK="$DEPLOY_BASE/current"
mkdir -p "$RELEASES_DIR"

STAMP="$(date +%Y%m%d_%H%M%S)"
TARGET_RELEASE="$RELEASES_DIR/$STAMP"
mkdir -p "$TARGET_RELEASE"

rsync -a --delete   --exclude 'releases'   --exclude 'current'   --exclude 'server.pid'   --exclude 'server.log'   "$ROOT_DIR/" "$TARGET_RELEASE/"

ln -sfn "$TARGET_RELEASE" "$CURRENT_LINK"
cd "$CURRENT_LINK"

if [[ ! -f ".env.server" && -f "SERVER_ENV.txt" ]]; then
  cp "SERVER_ENV.txt" ".env.server"
fi

if command -v pm2 >/dev/null 2>&1; then
  pm2 delete loverscalendar-server >/dev/null 2>&1 || true
  pm2 start server.js --name loverscalendar-server
  pm2 save >/dev/null 2>&1 || true
else
  if [[ -f server.pid ]] && kill -0 "$(cat server.pid)" >/dev/null 2>&1; then
    kill "$(cat server.pid)" || true
  fi
  nohup node server.js > server.log 2>&1 &
  echo $! > server.pid
fi

echo "Готово. Сервер развёрнут в $CURRENT_LINK"
echo "Проверь /health и лог server.log"
