#!/usr/bin/env bash
# Start OFFICIAL Raihan + Matt backends (not smoke scripts).
# Usage: bash scripts/start-official-backends.sh
# Prereq: repos cloned at PINKSURFING_ROOT; .env files configured.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(dirname "$SCRIPT_DIR")"
ROOT="${PINKSURFING_ROOT:-$(dirname "$PLATFORM_ROOT")}"

echo "=== PinkSurfing official backends ==="
echo "Root: $ROOT"

start_bg() {
  local name="$1"
  local dir="$2"
  local cmd="$3"
  if [ ! -d "$dir" ]; then
    echo "SKIP $name — missing $dir"
    return 1
  fi
  echo "Starting $name..."
  (cd "$dir" && eval "$cmd") &
  sleep 2
}

start_bg "chat :6161" "$ROOT/PS-App-Backend/chat" "node app.js"
start_bg "mobileapi :6003" "$ROOT/PS-App-Backend/mobileapi" "node app.js"
start_bg "Matt wallet :3099" "$ROOT/ps-wallet-backend-matt-created" "npm start"

echo ""
echo "Verify:"
echo "  curl -s http://127.0.0.1:6003/"
echo "  curl -s http://127.0.0.1:3099/"
echo ""
echo "Then start gateway: cd $ROOT/pinksurfing-platform && npm run start:prod -w @pinksurfing/api"
echo "Then start web:     npm run start -w @pinksurfing/web"
echo "Production URL:     https://pinksurfing.com/app"
