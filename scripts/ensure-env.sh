#!/usr/bin/env bash
# Write env files for app.pinksurfing.com (web + gateway + wallet).
# Does NOT overwrite files that already have secrets (use --force to replace).
#
# Usage:
#   export DOMAIN=app.pinksurfing.com
#   bash scripts/ensure-env.sh
#   bash scripts/ensure-env.sh --force

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${DOMAIN:-app.pinksurfing.com}"
FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

PLATFORM="$ROOT/pinksurfing-platform"
WALLET="$ROOT/ps-wallet-backend-matt-created"
WEB_ENV="$PLATFORM/apps/web/.env.local"
GW_ENV="$PLATFORM/.env"
WALLET_ENV="$WALLET/.env"

echo "=== ensure-env → https://$DOMAIN ==="

write_if_missing() {
  local dest="$1" src="$2"
  if $FORCE || [[ ! -f "$dest" ]]; then
    cp "$src" "$dest"
    echo "  wrote $dest"
  else
    echo "  keep  $dest (use --force to overwrite)"
  fi
}

# Gateway — app subdomain template (proxies /api/app → coreapi)
GW_EXAMPLE="$PLATFORM/apps/api/.env.app-subdomain.example"
[[ -f "$GW_EXAMPLE" ]] || GW_EXAMPLE="$PLATFORM/apps/api/.env.web-wallet.example"
write_if_missing "$GW_ENV" "$GW_EXAMPLE"

append_default() {
  local file="$1" key="$2" val="$3"
  if [[ -f "$file" ]] && ! grep -q "^${key}=" "$file" 2>/dev/null; then
    echo "${key}=${val}" >> "$file"
  fi
}

append_default "$GW_ENV" "PORT" "8080"
append_default "$GW_ENV" "CORS_ORIGINS" "https://${DOMAIN}"
append_default "$GW_ENV" "WALLET_API_URL" "http://127.0.0.1:3099"
append_default "$GW_ENV" "APP_API_URL" "https://coreapi.pinksurfing.com"

# Web — live flags enabled in template
write_if_missing "$WEB_ENV" "$PLATFORM/apps/web/.env.app-subdomain.example"

# Wallet
WALLET_EXAMPLE="$WALLET/.env.production.app-subdomain.example"
[[ -f "$WALLET_EXAMPLE" ]] || WALLET_EXAMPLE="$WALLET/.env.example"
write_if_missing "$WALLET_ENV" "$WALLET_EXAMPLE"

append_default "$WALLET_ENV" "PORT" "3099"
append_default "$WALLET_ENV" "KEYVAULT_PYTHON_URL" "http://127.0.0.1:5002"
append_default "$WALLET_ENV" "CHIA_USE_REMOTE" "true"
append_default "$WALLET_ENV" "CORS_ORIGINS" "https://${DOMAIN}"
append_default "$WALLET_ENV" "GOOGLE_REDIRECT_URI" "https://${DOMAIN}/api/wallet/auth/google/callback"
append_default "$WALLET_ENV" "IPFS_PROVIDER" "pinata"

append_default "$WEB_ENV" "NEXT_PUBLIC_SSO_GOOGLE_START_URL" "https://auth.pinksurfing.com/api/auth/google/"
append_default "$WEB_ENV" "NEXT_PUBLIC_GOOGLE_AUTH_SAME_ORIGIN" "true"
append_default "$WEB_ENV" "GOOGLE_REDIRECT_URI" "https://${DOMAIN}/api/auth/google/callback"

echo ""
echo "Live flags (web): WALLET_LIVE, CHAT_LIVE, CONTRACTS_LIVE = true"
echo ""
echo "Edit secrets before build:"
echo "  $WEB_ENV          → GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET"
echo "  $WALLET_ENV       → JWT_SIGNING_KEY (match auth.pinksurfing.com), GOOGLE_*, PINATA_JWT, SERVER_ENCRYPTION_KEY, Chia RPC"
echo ""
echo "Generate SERVER_ENCRYPTION_KEY:"
echo "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
