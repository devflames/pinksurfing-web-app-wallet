# PinkSurfing App + Wallet

**Deploy repo:** [github.com/devflames/pinksurfing-web-app-wallet](https://github.com/devflames/pinksurfing-web-app-wallet)  
**Production URL:** [https://app.pinksurfing.com](https://app.pinksurfing.com)

Deploy **only** these two codebases on the app VPS. Everything else is already hosted elsewhere.

| Deploy here | Remote (other servers) |
|-------------|------------------------|
| `pinksurfing-platform` (Next.js + gateway) | Raihan API: [coreapi.pinksurfing.com/api-docs](https://coreapi.pinksurfing.com/api-docs/) |
| `ps-wallet-backend-matt-created` (Matt wallet) | SSO: [auth.pinksurfing.com](https://auth.pinksurfing.com) |
| | Shop: [pinksurfing.com](https://pinksurfing.com) |

---

## Live URLs after deploy

| URL | Service |
|-----|---------|
| https://app.pinksurfing.com/ | Web app |
| https://app.pinksurfing.com/api/wallet/ | Matt wallet API (via gateway) |
| https://app.pinksurfing.com/api/wallet/api-docs | **Matt wallet Swagger UI** |
| https://app.pinksurfing.com/api/app/ | Gateway proxy to coreapi (Raihan) |

---

## Quick deploy (Linux VPS)

```bash
# DNS: A record  app  ->  your VPS IP

export DOMAIN=app.pinksurfing.com
bash scripts/ensure-env.sh

# Edit secrets before build:
#   pinksurfing-platform/apps/web/.env.local
#   ps-wallet-backend-matt-created/.env

cd pinksurfing-platform && npm ci
npm run build -w @pinksurfing/api && npm run build -w @pinksurfing/web

cd ../ps-wallet-backend-matt-created && npm ci
cd python && pip3 install -e .

cd ../.. && pm2 start ecosystem.config.cjs && pm2 save
bash scripts/verify.sh
```

### Production live flags (enabled in templates)

- `NEXT_PUBLIC_WALLET_LIVE=true`
- `NEXT_PUBLIC_CHAT_LIVE=true`
- `NEXT_PUBLIC_CONTRACTS_LIVE=true`

---

## PM2 processes

| Name | Port | Role |
|------|------|------|
| `ps-keyvault` | 5002 | Python KeyVault sidecar (Chia ops) |
| `ps-wallet` | 3099 | Matt wallet Node API |
| `ps-gateway` | 8080 | NestJS reverse proxy |
| `ps-web` | 3000 | Next.js frontend |

Caddy (`Caddyfile`) routes `app.pinksurfing.com` to web (:3000) and `/api/*` to gateway (:8080).

---

## Environment files

| File | Purpose |
|------|---------|
| `pinksurfing-platform/apps/web/.env.app-subdomain.example` | Web production template |
| `pinksurfing-platform/apps/api/.env.app-subdomain.example` | Gateway template |
| `ps-wallet-backend-matt-created/.env.production.app-subdomain.example` | Wallet production template |
| `scripts/ensure-env.sh` | Copies templates to `.env.local` / `.env` on VPS |

Generate wallet encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set as `SERVER_ENCRYPTION_KEY` in wallet `.env` (back up securely).

---

## Verify

```bash
curl -s https://app.pinksurfing.com/api/wallet/ | jq .docs
curl -s https://app.pinksurfing.com/api/wallet/keyvault/health | jq .
curl -s https://app.pinksurfing.com/api/wallet/api-docs.json | jq .info.title
bash scripts/verify.sh
```

---

## Documentation

| Doc | Description |
|-----|-------------|
| [CHANGELOG.md](./CHANGELOG.md) | What changed in this sync |
| [docs/APP_WALLET_DEPLOY_REPO.md](./docs/APP_WALLET_DEPLOY_REPO.md) | Full deploy guide |
| [docs/WALLET_BACKEND_DEPLOY.md](./docs/WALLET_BACKEND_DEPLOY.md) | Matt wallet + KeyVault checklist |
| Matt API (interactive) | https://app.pinksurfing.com/api/wallet/api-docs |
| Raihan API (interactive) | https://coreapi.pinksurfing.com/api-docs/ |

---

## Sync from unified CodeBase

On your dev machine:

```powershell
powershell -File C:\CodeBase\scripts\export-app-wallet-repo.ps1
cd C:\CodeBase\pinksurfing-web-app-wallet-export
git add -A && git commit -m "Sync app+wallet deploy repo" && git push
```

---

## Repository layout

```text
pinksurfing-web-app-wallet/
├── Caddyfile
├── ecosystem.config.cjs
├── CHANGELOG.md
├── README.md
├── scripts/
│   ├── ensure-env.sh
│   ├── bootstrap-contabo.sh
│   └── verify.sh
├── docs/
├── pinksurfing-platform/
└── ps-wallet-backend-matt-created/
```
