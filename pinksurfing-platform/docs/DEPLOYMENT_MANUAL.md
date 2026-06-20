# Manual Deployment Guide — Albert

Deploy **pinksurfing-platform** (web + gateway) against **official Raihan + Matt backends** on your own webserver.

**Client production URL:** [https://pinksurfing.com/app](https://pinksurfing.com/app) — app shell under `/app` on the main domain; API on same host at `/api/*` (see Caddy example).

---

## Prerequisites

- Linux server (Ubuntu 22.04+ recommended) — Matt wallet needs `better-sqlite3` native build
- Node.js 20 LTS
- MongoDB + Redis (for full Raihan stack)
- Domain + TLS (Caddy or nginx)
- Git access to official repos

---

## 1. Clone repositories

```bash
sudo mkdir -p /opt/pinksurfing
sudo chown $USER:$USER /opt/pinksurfing
cd /opt/pinksurfing

git clone -b raihan https://github.com/Shaqmonster/PS-App-Backend.git PS-App-Backend
cd PS-App-Backend && cd ..

git clone https://github.com/Shaqmonster/ps-wallet-backend-matt-created.git ps-wallet-backend-matt-created

git clone https://github.com/devflames/pinksurfing-web-platform.git pinksurfing-platform
```

Do **not** clone `ps-merged-backend-FOR-ALBERT 2` for production.

---

## 2. Configure official Raihan backends

```bash
# chat
cp PS-App-Backend/chat/.env.example PS-App-Backend/chat/.env
# Edit: JWT_SECRET, MONGO_URI, REDIS, Square keys

# mobileapi — align tokenAuth.password with chat JWT_SECRET
# Edit PS-App-Backend/mobileapi/config.js and .env
```

Start (use systemd or pm2 in production):

```bash
cd PS-App-Backend/chat && npm install && node app.js      # :6161
cd PS-App-Backend/mobileapi && npm install && node app.js # :6003
```

Verify: `curl http://127.0.0.1:6003/` responds.

---

## 3. Configure official Matt wallet

```bash
cd ps-wallet-backend-matt-created
cp .env.example .env
# Edit: GOOGLE_CLIENT_ID, CHIA_RPC, PINATA, etc.

npm install
# Start Python KeyVault sidecar on :5002 first (see Matt repo README)
npm start   # :3099
```

Verify: `curl http://127.0.0.1:3099/`

---

## 4. Configure gateway

```bash
cd /opt/pinksurfing/pinksurfing-platform
npm install
cp apps/api/.env.production.example .env
npm run build -w @pinksurfing/api
```

`.env` (gateway):

```env
PORT=8080
APP_API_URL=http://127.0.0.1:6003
WALLET_API_URL=http://127.0.0.1:3099
ADMIN_API_URL=http://127.0.0.1:6001
CORS_ORIGINS=https://pinksurfing.com,https://www.pinksurfing.com
```

Run:

```bash
npm run start:prod -w @pinksurfing/api
```

Verify: `curl http://127.0.0.1:8080/health`

---

## 5. Configure & build web

```bash
cp apps/web/.env.production.example apps/web/.env.local
npm run build -w @pinksurfing/web
npm run start -w @pinksurfing/web   # :3000
```

Production env:

```env
NEXT_PUBLIC_BASE_PATH=/app
NEXT_PUBLIC_AUTH_MODE=production
NEXT_PUBLIC_API_URL=https://pinksurfing.com/api/app
NEXT_PUBLIC_WALLET_URL=https://pinksurfing.com/api/wallet
NEXT_PUBLIC_WALLET_LIVE=true
NEXT_PUBLIC_AGORA_APP_ID=6633314fbbcf41f8a2c73dac26dd8552
NEXT_PUBLIC_CALLS_DEMO=false
AUTH_TOKEN_URL=https://auth.pinksurfing.com/api/token/
APP_API_URL=http://127.0.0.1:6003
```

Agora calls use Raihan `mobileapi` `/rtc/*` and chat `/calls/*` through the gateway. Set `NEXT_PUBLIC_CALLS_DEMO=false` in production so initiate/end hit the real chat API.

---

## 6. TLS reverse proxy (Caddy)

Copy [infra/gateway/Caddyfile.production.example](../infra/gateway/Caddyfile.production.example) to `/etc/caddy/Caddyfile`:

```text
pinksurfing.com, www.pinksurfing.com {
  handle /app* {
    reverse_proxy 127.0.0.1:3000
  }
  handle /api/* {
    reverse_proxy 127.0.0.1:8080
  }
}
```

The marketplace / site root on `pinksurfing.com` is configured separately (existing infra).

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## 7. Smoke test after deploy

```bash
curl https://pinksurfing.com/api/health
# Open https://pinksurfing.com/app in browser (SSO login)

# On server against localhost gateway:
node scripts/test-web-contracts-gateway.js
GATEWAY_URL=http://127.0.0.1:8080 node scripts/test-wallet-gateway.js
```

---

## 8. Process management (pm2 example)

```bash
pm2 start PS-App-Backend/chat/app.js --name ps-chat
pm2 start PS-App-Backend/mobileapi/app.js --name ps-mobileapi
pm2 start ps-wallet-backend-matt-created/src/index.js --name ps-wallet
pm2 start "npm run start:prod -w @pinksurfing/api" --cwd pinksurfing-platform --name ps-gateway
pm2 start "npm run start -w @pinksurfing/web" --cwd pinksurfing-platform --name ps-web
pm2 save
```

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| 404 on `/app` | Web built with `NEXT_PUBLIC_BASE_PATH=/app`; Caddy `handle /app*` |
| 502 on `/api/app` | mobileapi running on :6003 |
| 502 on `/api/wallet` | Matt wallet on :3099 |
| Login works, contracts fail | chat on :6161; JWT secret match |
| CORS errors | `CORS_ORIGINS` includes `https://pinksurfing.com` |
| Wallet panel empty | `NEXT_PUBLIC_WALLET_LIVE=true`; Matt reachable |

---

*Connection reference:* [OFFICIAL_BACKEND_CONNECTIONS.md](./OFFICIAL_BACKEND_CONNECTIONS.md)
