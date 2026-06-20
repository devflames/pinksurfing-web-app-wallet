#!/usr/bin/env bash
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root on VPS"; exit 1; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
apt-get update -qq && apt-get install -y -qq curl git ufw python3 python3-pip python3-venv
command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs; }
command -v pm2 >/dev/null || npm install -g pm2
command -v caddy >/dev/null || apt-get install -y caddy
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
cp "$ROOT/Caddyfile" /etc/caddy/Caddyfile
systemctl reload caddy || systemctl start caddy
export DOMAIN=app.pinksurfing.com
bash "$ROOT/scripts/ensure-env.sh"
echo ""
echo "Next on VPS:"
echo "  cd $ROOT/pinksurfing-platform && npm ci && npm run build -w @pinksurfing/api && npm run build -w @pinksurfing/web"
echo "  cd $ROOT/ps-wallet-backend-matt-created && npm ci"
echo "  cd $ROOT/ps-wallet-backend-matt-created/python && pip3 install -e ."
echo "  cd $ROOT && pm2 start ecosystem.config.cjs && pm2 save"
echo "  bash scripts/verify.sh"