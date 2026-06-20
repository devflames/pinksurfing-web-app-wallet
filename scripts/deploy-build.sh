#!/usr/bin/env bash
# Build platform + wallet on Linux VPS (fixes lightningcss, lockfile, Python venv).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLATFORM="$ROOT/pinksurfing-platform"
WALLET="$ROOT/ps-wallet-backend-matt-created"
PY="$WALLET/python"

echo "=== deploy-build @ $ROOT ==="

# Fix CRLF from Windows export (breaks shebang on Linux)
if command -v sed >/dev/null 2>&1; then
  sed -i 's/\r$//' "$ROOT"/scripts/*.sh 2>/dev/null || true
fi

apt-get install -y -qq build-essential python3-dev python3-venv 2>/dev/null || true

echo "--- platform (npm install for Linux native optional deps) ---"
cd "$PLATFORM"
rm -rf node_modules apps/web/node_modules apps/api/node_modules packages/ui/node_modules
npm install --include=optional
npm install lightningcss-linux-x64-gnu@1.32.0 @tailwindcss/oxide-linux-x64-gnu@4.3.0 --no-save
npm run build -w @pinksurfing/api
npm run build -w @pinksurfing/web

echo "--- wallet (lockfile may lag package.json — use npm install) ---"
cd "$WALLET"
rm -rf node_modules
npm install

echo "--- keyvault Python venv (Ubuntu 24 PEP 668) ---"
cd "$PY"
python3 -m venv .venv
.venv/bin/pip install -U pip
.venv/bin/pip install -e .

echo "--- PM2 ---"
cd "$ROOT"
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

sleep 3
bash "$ROOT/scripts/verify.sh"
