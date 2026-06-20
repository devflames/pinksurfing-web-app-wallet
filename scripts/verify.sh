#!/usr/bin/env bash
set -e
G="${GATEWAY_URL:-http://127.0.0.1:8080}"

curl -sf "$G/health" | grep -q ok && echo "PASS gateway" || { echo "FAIL gateway"; exit 1; }

# /api/wallet/ alone is gateway info — probe a real proxied wallet route
curl -sf "$G/api/wallet/keyvault/health" | grep -q healthy && echo "PASS wallet via gateway" || { echo "FAIL wallet"; exit 1; }

curl -sf "$G/health/upstreams" | grep -q wallet && echo "PASS upstreams" || echo "WARN upstreams"
echo "OK"
