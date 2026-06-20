# Deploy scope — `https://app.pinksurfing.com`

**What you deploy on this VPS (two codebases only):**

| Deploy here | Repo | Processes |
|-------------|------|-----------|
| Web UI | `pinksurfing-platform/apps/web` | Next.js `:3000` |
| API gateway | `pinksurfing-platform/apps/api` | NestJS `:8080` |
| Wallet API | `ps-wallet-backend-matt-created` | Node `:3099` + Python KeyVault `:5002` |

**Already on other servers (do not redeploy here):**

| Service | Remote host | Used for |
|---------|-------------|----------|
| Raihan app API | [coreapi.pinksurfing.com](https://coreapi.pinksurfing.com/api-docs/) | Chat, PayChat, profile, contracts |
| SSO | `auth.pinksurfing.com` | Login JWT |
| Marketplace | `pinksurfing.com` | Shop / GigHub |

The gateway on `app.pinksurfing.com` **proxies `/api/app/*` → remote coreapi** and **`/api/wallet/*` → local Matt wallet**.

---
## Architecture (production)

```text
https://app.pinksurfing.com/                    → Next.js web (deployed here)
https://app.pinksurfing.com/api/wallet/*        → Gateway → Matt wallet :3099 (deployed here)
                                                       ├→ Python KeyVault :5002
                                                       ├→ Pinata IPFS
                                                       └→ Chia node RPC

https://app.pinksurfing.com/api/app/*           → Gateway → coreapi.pinksurfing.com (remote Raihan)
https://auth.pinksurfing.com                    → SSO login (remote Arshad)
https://pinksurfing.com/                        → Marketplace (remote, other server)
```

Caddy on the app VPS terminates TLS and routes to Next.js + gateway. **Only** `pinksurfing-platform` + `ps-wallet-backend-matt-created` run on this box.

---
## Pre-deploy checklist

### Infrastructure

| Item | Requirement |
|------|-------------|
| OS | Linux VPS recommended (Ubuntu 22.04+) |
| Node | **20 LTS** (`>=18`, avoid bleeding-edge — `better-sqlite3` is native) |
| Python | **3.10+** with `pip install -e .` in `python/` |
| Chia | Full node + wallet RPC running, TLS certs configured |
| Disk | SQLite at `data/wallet.db` — plan backups |
| PM2/systemd | **Two units**: Node + Python sidecar |

### Environment (`.env`)

| Variable | Production value |
|----------|------------------|
| `PORT` | `3099` |
| `KEYVAULT_PYTHON_URL` | `http://127.0.0.1:5002` |
| `IPFS_PROVIDER` | `pinata` |
| `PINATA_JWT` | From Pinata dashboard |
| `SERVER_ENCRYPTION_KEY` | 64-char hex — **generate once, back up, never rotate without migration** |
| `CORS_ORIGINS` | `https://app.pinksurfing.com` |
| `GOOGLE_REDIRECT_URI` | `https://app.pinksurfing.com/api/wallet/auth/google/callback` |
| `CHIA_NETWORK` | `mainnet` or agreed testnet |
| Chia RPC paths | Absolute paths to TLS cert/key files |

Generate encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Gateway (Albert’s platform)

Web (`apps/web/.env.local` on Contabo — see also `.env.app-subdomain.example`):

```env
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_APP_ORIGIN=https://app.pinksurfing.com
NEXT_PUBLIC_API_URL=https://app.pinksurfing.com/api/app
NEXT_PUBLIC_WALLET_URL=https://app.pinksurfing.com/api/wallet
NEXT_PUBLIC_WALLET_LIVE=true
NEXT_PUBLIC_CHAT_LIVE=true
NEXT_PUBLIC_CONTRACTS_LIVE=true
```

Gateway (`pinksurfing-platform/.env`):

```env
PORT=8080
CORS_ORIGINS=https://app.pinksurfing.com
# Local Matt wallet (same VPS)
WALLET_API_URL=http://127.0.0.1:3099
# Remote Raihan — already deployed elsewhere
APP_API_URL=https://coreapi.pinksurfing.com
```

When `NEXT_PUBLIC_CHAT_LIVE=true` or contracts are enabled, web calls `/api/app/*` on this host; gateway forwards to **coreapi**, not a local `PS-App-Backend` clone.

---
## Start commands (Linux)

```bash
# Terminal / systemd unit 1 — Python sidecar
cd ps-wallet-backend-matt-created/python
pip install -e .
python -m ps_keyvault.api   # listens :5002

# Terminal / systemd unit 2 — Node API
cd ps-wallet-backend-matt-created
npm install
npm start                   # listens :3099
```

Windows local dev:

```powershell
powershell -File scripts/start-wallet-backend.ps1
```

---

## Smoke tests after deploy

```bash
curl -s http://127.0.0.1:3099/ | jq .
curl -s http://127.0.0.1:3099/keyvault/health | jq .
# python.success should be true

# Via gateway (public URL after Caddy deploy)
curl -s https://app.pinksurfing.com/api/wallet/keyvault/health | jq .
curl -s https://app.pinksurfing.com/api/wallet/api-docs.json | jq .info.title
```

From platform repo:
```bash
node pinksurfing-platform/scripts/test-wallet-gateway.js
```

---

## Known issues to resolve before “perfect” production

### Blockers (ops)

1. **Two-process deploy** — scripts must start Python + Node; gateway only proxies Node.
2. **`better-sqlite3`** — rebuild on target OS/Node after deploy or `npm ci`.
3. **Chia RPC** — server must run synced node; cert paths must work (Windows `USERPROFILE` now supported in code).

### Security (Matt + Albert review)

| Issue | Risk | Recommendation |
|-------|------|----------------|
| `POST /keyvault/create-auto` unauthenticated | Server spends Chia fees | Gate behind auth or disable in prod until wired |
| `GET /auth/google/token/:id` | Token leak if session ID guessed | Rate-limit + short TTL |
| `GET /calls/token/:channel/:uid` | Open Agora token mint | Require JWT or Ed25519 |
| CORS `*` in dev | CSRF-style abuse | Set `CORS_ORIGINS` in prod (**fixed in `.env.example`**) |
| OAuth tokens in SQLite plaintext | DB breach | Encrypt at rest (future) |

### Integration gaps (web ↔ wallet)

| Gap | Status |
|-----|--------|
| Wallet panel read APIs (health, lookup, swaps list) | Wired |
| Swap create from web UI | **Broken** — web sends SSO Bearer; backend expects Ed25519 headers |
| Chia/BTC addresses in web UI | Stored in browser localStorage, not synced from backend |
| PayChat on web | Raihan `/payChat/*` + Matt `/paychat/*` — partial overlap, clarify with Matt |

**Action for Matt + Albert:** Either (A) web client signs swap requests with wallet Ed25519 key, or (B) gateway validates SSO JWT and forwards trusted `X-Verified-User` to wallet backend.

### Tests

`npm test` (`src/test.js`) references removed KeyVault routes — do not use as CI gate until updated.

---

## What is NOT deployed on this VPS

| Service | Where it runs |
|---------|---------------|
| `PS-App-Backend` (Raihan) | **coreapi.pinksurfing.com** (other server) |
| SSO | **auth.pinksurfing.com** (Arshad) |
| Marketplace / Django | **pinksurfing.com** (other server) |
| Flutter mobile app | Separate release |

Matt wallet (`ps-wallet-backend-matt-created`) handles KeyVault, Chia swaps, wallet E2E, Drive OAuth — **not** chat/PayChat profile APIs (those are Raihan on coreapi).

---
## Related fixes (2026-06)

- `SERVER_ENCRYPTION_KEY` canonical; `RECOVERY_MASTER_KEY` alias — `recovery-service.js`
- Windows Chia cert paths (`USERPROFILE`) — `src/utils/paths.js`, `chia-rpc.js`
- CORS from `CORS_ORIGINS` env — `src/index.js`
- `KEYVAULT_PYTHON_URL` unified with `KEYVAULT_SIDECAR_URL` — `paychat-service.js`
- Start script: `scripts/start-wallet-backend.ps1`

See also [APP_WALLET_DEPLOY_REPO.md](./APP_WALLET_DEPLOY_REPO.md) and [CODEBASE_FIXES_LOG.md](./CODEBASE_FIXES_LOG.md).