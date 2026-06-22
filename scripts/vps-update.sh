#!/usr/bin/env bash
# Pull latest deploy repo and rebuild on the Contabo VPS.
# Run ON THE SERVER as root:
#   cd /opt/pinksurfing-web-app-wallet && bash scripts/vps-update.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== vps-update @ $ROOT ==="
git pull origin main

export DOMAIN="${DOMAIN:-app.pinksurfing.com}"
bash "$ROOT/scripts/ensure-env.sh"

WALLET_ENV="$ROOT/ps-wallet-backend-matt-created/.env"
if ! grep -q '^JWT_SIGNING_KEY=.\+' "$WALLET_ENV" 2>/dev/null; then
  echo ""
  echo "WARN: JWT_SIGNING_KEY is empty in $WALLET_ENV"
  echo "      Wallet /wallet/status and /wallet/link require the same key as SSO."
  echo "      Edit .env then re-run: pm2 restart ps-wallet"
  echo ""
fi

bash "$ROOT/scripts/deploy-build.sh"

if [[ -f "$ROOT/Caddyfile" ]] && command -v caddy >/dev/null 2>&1; then
  cp "$ROOT/Caddyfile" /etc/caddy/Caddyfile
  systemctl reload caddy
  echo "Caddy reloaded"
fi

echo ""
echo "=== Smoke test (public) ==="
curl -sf "https://${DOMAIN}/" -o /dev/null && echo "PASS web https://${DOMAIN}/"
curl -sf "http://127.0.0.1:8080/api/wallet/keyvault/health" | grep -q healthy && echo "PASS wallet health via gateway"
echo ""
echo "Done. Test login at https://${DOMAIN}/"
