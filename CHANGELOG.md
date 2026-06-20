# Changelog — pinksurfing-web-app-wallet

Deploy repo: [github.com/devflames/pinksurfing-web-app-wallet](https://github.com/devflames/pinksurfing-web-app-wallet)  
Target: **https://app.pinksurfing.com**

---

## 2026-06-21 — Sync from unified CodeBase

### Deploy scope

- **On this VPS:** `pinksurfing-platform` + `ps-wallet-backend-matt-created` only
- **Remote (other servers):** Raihan `coreapi.pinksurfing.com`, SSO `auth.pinksurfing.com`, shop `pinksurfing.com`

### Production env (live flags enabled)

Web (`apps/web/.env.app-subdomain.example`):

- `NEXT_PUBLIC_WALLET_LIVE=true`
- `NEXT_PUBLIC_CHAT_LIVE=true`
- `NEXT_PUBLIC_CONTRACTS_LIVE=true`
- `NEXT_PUBLIC_API_URL=https://app.pinksurfing.com/api/app`
- `NEXT_PUBLIC_WALLET_URL=https://app.pinksurfing.com/api/wallet`

Gateway (`apps/api/.env.app-subdomain.example`):

- `APP_API_URL=https://coreapi.pinksurfing.com`
- `WALLET_API_URL=http://127.0.0.1:3099`

### Matt wallet backend (`ps-wallet-backend-matt-created`)

| Change | Details |
|--------|---------|
| **Swagger API UI** | `GET /api-docs` (UI), `GET /api-docs.json` (OpenAPI 3.0) |
| Public docs URL | `https://app.pinksurfing.com/api/wallet/api-docs` |
| CORS from env | `CORS_ORIGINS` (production: `https://app.pinksurfing.com`) |
| Windows Chia paths | `~` expands via `USERPROFILE` on Windows |
| KeyVault env alias | `KEYVAULT_PYTHON_URL` unified with `KEYVAULT_SIDECAR_URL` |
| Production env template | `.env.production.app-subdomain.example` |
| Startup checks | Logs Python sidecar health + API docs URL |
| Node engines | `>=18 <=22` (use Node 20 LTS on VPS) |

### Platform web (`pinksurfing-platform`)

- Team UX update: contacts, profiles, PayChat dial, business cards, Find People
- Wallet panel: KeyVault lookup, open swaps, health (when `WALLET_LIVE=true`)
- Gateway templates for app subdomain deploy

### Scripts & ops

- `scripts/ensure-env.sh` — writes prod env with live flags
- `scripts/bootstrap-contabo.sh` — VPS bootstrap (Node 20, Caddy, PM2)
- `scripts/verify.sh` — gateway + wallet smoke tests
- `ecosystem.config.cjs` — PM2: keyvault, wallet, gateway, web

### Docs included

- `docs/APP_WALLET_DEPLOY_REPO.md`
- `docs/WALLET_BACKEND_DEPLOY.md`
- This changelog

### Known before go-live

1. Fill secrets: `GOOGLE_*`, `JWT_SECRET`, `PINATA_JWT`, `SERVER_ENCRYPTION_KEY`, Chia RPC certs
2. Matt wallet needs **two processes**: Node `:3099` + Python KeyVault `:5002`
3. Swap create from web requires **Ed25519** wallet auth (not SSO JWT alone)
4. `npm test` in wallet repo may be stale — use `/keyvault/health` and `/api-docs` as smoke tests

---

## Earlier

- Initial export repo for Contabo VPS (`app.pinksurfing.com`)
- Caddy reverse proxy, PM2 ecosystem, separate from marketplace host
