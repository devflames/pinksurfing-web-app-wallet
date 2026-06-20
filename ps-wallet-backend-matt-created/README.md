# ps-wallet-backend (Matt)

Non-custodial Chia wallet backend for PinkSurfing — KeyVault on-chain backups, atomic swaps, E2E messaging, PayChat, profiles, and Google Drive OAuth for encrypted backup.

**Production @ [app.pinksurfing.com](https://app.pinksurfing.com/):** deployed **with** `pinksurfing-platform` on the same VPS. Web at `/`, this API at `/api/wallet/*` via gateway → port **3099**. Raihan, SSO, and marketplace run on **other servers**.

## Two processes required

| Process | Command | Port |
|---------|---------|------|
| **Node API** | `npm start` | **3099** |
| **Python KeyVault sidecar** | `cd python && python -m ps_keyvault.api` | **5002** |

Without the Python sidecar, `GET /keyvault/health` reports Python unhealthy and deploy/spend chain ops fail.

### Quick start (local)

```powershell
# From CodeBase root (Windows)
powershell -File scripts/start-wallet-backend.ps1

# Or manually:
cd ps-wallet-backend-matt-created
npm install          # Node 20 LTS recommended; needs C++ build tools on Windows
cp .env.example .env
cd python && pip install -e . && python -m ps_keyvault.api   # terminal 1
cd .. && npm start                                           # terminal 2
```

Verify:

```bash
curl http://127.0.0.1:3099/
curl http://127.0.0.1:3099/keyvault/health
```

## What the web app uses today

Gateway strips `/api/wallet` → `:3099`. Web client (`pinksurfing-platform/apps/web/src/lib/wallet-api.ts`):

| Endpoint | Purpose |
|----------|---------|
| `GET /` | Service info |
| `GET /keyvault/health` | Node + Python health |
| `GET /keyvault/lookup/:addr` | Find KeyVault for Chia address |
| `GET /keyvault/status/:id` | Vault status |
| `GET /swaps/open` | Open atomic swaps |
| `GET /swaps/address/:addr` | Swaps for address |
| `POST /swaps/create` | Create swap (**Ed25519 auth**, not SSO JWT) |

Enable in web: `NEXT_PUBLIC_WALLET_LIVE=true`, `NEXT_PUBLIC_WALLET_URL=https://app.pinksurfing.com/api/wallet`

## Auth models

1. **Ed25519 wallet auth** — mutating routes (swaps, messages send, profile register). Headers: `X-Auth-Address`, `X-Auth-Timestamp`, `X-Auth-Signature`.
2. **Google OAuth** — Drive backup only (`/auth/google/*`), not platform SSO.
3. **Email OTP** — optional wallet sessions (`/auth/email/*`).

Platform SSO JWT (`Authorization: Bearer`) is **not** accepted on swap mutations yet — web swap UI must sign with wallet Ed25519 key or backend needs a gateway-trust layer (discuss with Matt + Albert).

## Key modules

| Path | Role |
|------|------|
| `src/routes/keyvault.js` | KeyVault REST API |
| `src/routes/swaps.js` | BTC ↔ XCH atomic swap metadata |
| `src/services/keyvault-service.js` | Node → Python sidecar + IPFS |
| `src/services/db.js` | SQLite (`data/wallet.db`) |
| `python/ps_keyvault/` | Chia singleton deploy/spend/recover |

## Production checklist

See [docs/WALLET_BACKEND_DEPLOY.md](../docs/WALLET_BACKEND_DEPLOY.md) for full deploy steps.

Minimum before go-live:

1. **Node 20 LTS** on Linux VPS (avoid Node 24 + native module issues).
2. **`npm install`** with build tools; **`pip install -e .`** in `python/`.
3. **Both processes** running (PM2/systemd — two units).
4. **`IPFS_PROVIDER=pinata`** + `PINATA_JWT` (not `data_uri`).
5. **`SERVER_ENCRYPTION_KEY`** set once and backed up (64-char hex).
6. **`CORS_ORIGINS`** = your web/gateway origins (not `*`).
7. **Chia node + wallet RPC** with TLS cert paths in `.env`.
8. **Gateway** `WALLET_API_URL=http://127.0.0.1:3099`.
9. **SQLite backup** plan for `data/wallet.db`.

## Environment

Copy `.env.example` → `.env`. Critical vars:

- `KEYVAULT_PYTHON_URL=http://127.0.0.1:5002`
- `SERVER_ENCRYPTION_KEY` — required before recovery/MFA use
- `IPFS_PROVIDER=pinata`, `PINATA_JWT`
- `CORS_ORIGINS` — production origins
- Chia RPC cert paths (supports `~` on Windows via `USERPROFILE`)

## Architecture

```
Web / Flutter @ app.pinksurfing.com
    → https://app.pinksurfing.com/api/wallet/*
        → Gateway :8080 (Caddy on same host)
            → Node :3099 (this repo)
                → Python :5002 (Chia KeyVault ops)
                → Pinata / IPFS (encrypted backups)
                → Chia blockchain (singletons, HTLCs)
```

## Testing

```bash
npm start
npm test   # Note: some tests may be stale vs current routes — use /keyvault/health as smoke test
```

## API documentation (Swagger UI)

| URL | Description |
|-----|-------------|
| `GET /api-docs` | Interactive Swagger UI |
| `GET /api-docs.json` | OpenAPI 3.0 JSON |

**Production:** https://app.pinksurfing.com/api/wallet/api-docs

Covers KeyVault, swaps, profiles, auth, messages, PayChat, recovery, and more. Raihan app API is separate: [coreapi.pinksurfing.com/api-docs/](https://coreapi.pinksurfing.com/api-docs/)

---

- Platform integration: `pinksurfing-platform/docs/INTEGRATION_SUMMARY.md`
- Deploy manual: `pinksurfing-platform/docs/DEPLOYMENT_MANUAL.md`
- Raihan app API (separate): https://coreapi.pinksurfing.com/api-docs/
