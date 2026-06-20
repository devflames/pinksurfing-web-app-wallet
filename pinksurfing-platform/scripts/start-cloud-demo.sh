#!/usr/bin/env bash
# PinkSurfing — Cursor Cloud Agent / Linux UI demo (gateway + web, no Raihan/Matt)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PLATFORM_ROOT"

echo "=== PinkSurfing cloud demo ==="

if [ ! -f .env ]; then
  cp apps/api/.env.example .env
  echo "Created .env from apps/api/.env.example"
fi

if [ ! -f apps/web/.env.local ]; then
  cp apps/web/.env.cloud.example apps/web/.env.local
  echo "Created apps/web/.env.local from .env.cloud.example"
fi

npm install

rm -rf apps/web/.next

echo "Starting gateway :8080..."
npm run dev:api &
API_PID=$!

sleep 4

echo "Starting web :3000..."
npm run dev:web &
WEB_PID=$!

echo ""
echo "=== Ready ==="
echo "  Web:              http://localhost:3000"
echo "  Gateway health:   http://localhost:8080/health"
echo "  Upstream status:  http://localhost:8080/health/upstreams"
echo "  App proxy info:   http://localhost:8080/api/app"
echo ""
echo "  Live Raihan/Matt NOT started — UI demo mode."
echo "  See docs/LOCAL_STANDALONE_DEMO.md (unified repo) for full stack."
echo ""
echo "  PIDs: gateway=$API_PID web=$WEB_PID (kill manually when done)"

wait
