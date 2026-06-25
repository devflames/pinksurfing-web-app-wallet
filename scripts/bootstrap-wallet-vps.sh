#!/usr/bin/env bash
# One-shot wallet backend on Ubuntu VPS (DigitalOcean ps-wallet-backend droplet).
# Run as root in the web console:
#   curl -fsSL https://raw.githubusercontent.com/devflames/pinksurfing-web-app-wallet/main/scripts/bootstrap-wallet-vps.sh | bash
# Or after git clone:
#   bash /opt/pinksurfing-web-app-wallet/scripts/bootstrap-wallet-vps.sh
#
set -euo pipefail

ROOT="${PINKSURFING_ROOT:-/opt/pinksurfing-web-app-wallet}"
DOMAIN="${DOMAIN:-app.pinksurfing.com}"
WALLET_REPO="${WALLET_REPO:-https://github.com/Shaqmonster/ps-wallet-backend-matt-created.git}"

echo "=== PinkSurfing wallet VPS bootstrap ==="
echo "ROOT=$ROOT  DOMAIN=$DOMAIN"

apt-get update -qq
apt-get install -y -qq curl git ufw build-essential python3 python3-pip python3-venv python3-dev

if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

command -v pm2 >/dev/null || npm install -g pm2

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

mkdir -p "$(dirname "$ROOT")"
if [[ ! -d "$ROOT/.git" ]]; then
  echo "Clone deploy repo into $ROOT ..."
  git clone https://github.com/devflames/pinksurfing-web-app-wallet.git "$ROOT" || {
    echo "Deploy repo clone failed — cloning wallet only to /opt/pinksurfing/ps-wallet-backend-matt-created"
    mkdir -p /opt/pinksurfing
    git clone "$WALLET_REPO" /opt/pinksurfing/ps-wallet-backend-matt-created
    ROOT=/opt/pinksurfing
  }
fi

WALLET="$ROOT/ps-wallet-backend-matt-created"
[[ -d "$WALLET" ]] || git clone "$WALLET_REPO" "$WALLET"

cd "$ROOT"
git pull --ff-only 2>/dev/null || true

if [[ -f "$ROOT/scripts/ensure-env.sh" ]]; then
  export DOMAIN
  bash "$ROOT/scripts/ensure-env.sh"
fi

WALLET_ENV="$WALLET/.env"
if [[ ! -f "$WALLET_ENV" ]]; then
  cp "$WALLET/.env.production.app-subdomain.example" "$WALLET_ENV"
fi

append() {
  local file="$1" key="$2" val="$3"
  grep -q "^${key}=" "$file" 2>/dev/null || echo "${key}=${val}" >> "$file"
}

append "$WALLET_ENV" PORT 3099
append "$WALLET_ENV" KEYVAULT_PYTHON_URL "http://127.0.0.1:5002"
append "$WALLET_ENV" CHIA_USE_REMOTE true
append "$WALLET_ENV" CHIA_NETWORK testnet10
append "$WALLET_ENV" CORS_ORIGINS "https://${DOMAIN}"
append "$WALLET_ENV" IPFS_PROVIDER pinata

echo ""
echo "--- npm + python ---"
cd "$WALLET"
npm ci 2>/dev/null || npm install
cd "$WALLET/python"
python3 -m venv .venv
.venv/bin/pip install -U pip
.venv/bin/pip install -e .

echo ""
echo "--- pm2 (wallet + keyvault only) ---"
cd "$ROOT"
if [[ -f ecosystem.config.cjs ]]; then
  pm2 delete ps-wallet ps-keyvault 2>/dev/null || true
  pm2 start ecosystem.config.cjs --only ps-keyvault,ps-wallet
else
  pm2 delete ps-wallet ps-keyvault 2>/dev/null || true
  pm2 start "$WALLET/src/index.js" --name ps-wallet --cwd "$WALLET" --env PORT=3099
  pm2 start .venv/bin/python3 --name ps-keyvault --cwd "$WALLET/python" --interpreter none -- \
    -m ps_keyvault.api
fi
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash || true

sleep 2
echo ""
echo "--- health ---"
curl -sf "http://127.0.0.1:3099/health" && echo "" || echo "WARN: wallet :3099 not healthy"
curl -sf "http://127.0.0.1:5002/health" && echo "" || echo "WARN: keyvault :5002 not healthy"

echo ""
echo "=== DONE (wallet processes) ==="
echo "Edit secrets: nano $WALLET_ENV"
echo "  Required: JWT_SIGNING_KEY (same as auth.pinksurfing.com), PINATA_JWT, SERVER_ENCRYPTION_KEY"
echo "  Optional: GOOGLE_CLIENT_ID/SECRET for Drive backup, SERVER_KEY_FINGERPRINT + funded XCH for create-auto"
echo "Then: pm2 restart ps-wallet ps-keyvault"
echo "Public check (if gateway on another host): curl -s https://${DOMAIN}/api/wallet/keyvault/health"
