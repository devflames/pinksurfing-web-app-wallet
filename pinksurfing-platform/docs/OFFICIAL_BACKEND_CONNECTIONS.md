# Official Backend Connections (Albert / Production Deploy)

**Owner:** Albert — full-stack & blockchain  
**Policy:** Use **audited official GitHub repos only**. Do **not** deploy Claude/Albert merge folders as production backends.

**Client production URL:** [https://pinksurfing.com/app](https://pinksurfing.com/app) (404 until deployed — configure `NEXT_PUBLIC_BASE_PATH=/app` + Caddy `/app*` → Next.js).

---

## Official sources (only these)

| ID | GitHub repo (official) | Branch | Runs | Port |
|----|------------------------|--------|------|------|
| **RAIHAN** | [Shaqmonster/PS-App-Backend](https://github.com/Shaqmonster/PS-App-Backend) | **`raihan`** | mobileapi, chat, adminService | 6003, 6161, 6001 |
| **MATT** | [Shaqmonster/ps-wallet-backend-matt-created](https://github.com/Shaqmonster/ps-wallet-backend-matt-created) | `main` | wallet API + Python KeyVault sidecar | 3099, 5002 |
| **ALBERT** | [devflames/pinksurfing-web-platform](https://github.com/devflames/pinksurfing-web-platform) | `main` | gateway + web | 8080, 3000 |

**NOT production:**

- `ps-merged-backend-FOR-ALBERT 2`
- `PinkSurfingBackendMerge`
- Smoke scripts (`scripts/smoke-*.js`) — dev/test only

---

## Architecture on your webserver

```text
                    ┌─────────────────────────────────────┐
  Browser / Flutter │  https://pinksurfing.com/app        │  Next.js (web, basePath /app)
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │  https://pinksurfing.com/api/*      │  Gateway (NestJS :8080 via Caddy)
                    │    /api/app/*   → Raihan mobileapi  │
                    │      (incl. /rtc/* Agora tokens)    │
                    │    /api/wallet/* → Matt wallet      │
                    │    /api/admin/* → Raihan admin      │
                    └─────────────────┬───────────────────┘
                                      │ localhost only
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
        mobileapi :6003         Matt wallet :3099        admin :6001
              │                       │
              ▼                       ▼
        chat :6161              KeyVault Python :5002
```

SSO stays on **official auth host** (same as Flutter today):

- `https://auth.pinksurfing.com/api/token/`

---

## Connection modes

### Mode 1 — **Self-hosted official stack** (recommended for Albert)

Clone official repos on the server, configure `.env` from each repo’s `.env.example`, run gateway + web from this repo.

| Component | Env var | Value on server |
|-----------|---------|-----------------|
| Gateway → Raihan | `APP_API_URL` | `http://127.0.0.1:6003` |
| Gateway → Matt | `WALLET_API_URL` | `http://127.0.0.1:3099` |
| Gateway → Admin | `ADMIN_API_URL` | `http://127.0.0.1:6001` |
| Web (public) | `NEXT_PUBLIC_BASE_PATH` | `/app` |
| Web (public) | `NEXT_PUBLIC_API_URL` | `https://pinksurfing.com/api/app` |
| Web (public) | `NEXT_PUBLIC_WALLET_URL` | `https://pinksurfing.com/api/wallet` |
| Web (SSR login) | `APP_API_URL` | `http://127.0.0.1:6003` (direct mobileapi) |
| Web (SSR login) | `AUTH_TOKEN_URL` | `https://auth.pinksurfing.com/api/token/` |
| Web auth | `NEXT_PUBLIC_AUTH_MODE` | `production` |
| Web Agora | `NEXT_PUBLIC_AGORA_APP_ID` | Same App ID as Raihan mobileapi |
| Web Agora | `NEXT_PUBLIC_CALLS_DEMO` | `false` in production |
| Gateway CORS | `CORS_ORIGINS` | `https://pinksurfing.com,https://www.pinksurfing.com` |

Copy templates:

- `apps/api/.env.production.example` → repo root `.env`
- `apps/web/.env.production.example` → `apps/web/.env.local`

### Mode 2 — **Existing PinkSurfing production APIs** (no self-host Raihan yet)

| Purpose | URL |
|---------|-----|
| SSO | `https://auth.pinksurfing.com/api/token/` |
| App API (legacy direct) | `https://mobileapi.pinksurfing.com` |
| Target unified API (when gateway live) | `https://api.pinksurfing.com` |

Use Mode 2 only if official servers already run **`raihan`** contract routes. Otherwise use Mode 1.

### Mode 3 — **Local dev** (smoke / gateway)

See [../docs/LOCAL_STANDALONE_DEMO.md](../docs/LOCAL_STANDALONE_DEMO.md) — full stack on `:8888`, `NEXT_PUBLIC_AUTH_MODE=local`.

---

## Repo layout on server (suggested)

```text
/opt/pinksurfing/
├── PS-App-Backend/          # git clone, branch raihan
├── ps-wallet-backend-matt-created/
└── pinksurfing-platform/    # this repo (gateway + web + docs)
```

Set `PINKSURFING_ROOT=/opt/pinksurfing` when running smoke scripts from this repo.

---

## Start order (official backends)

1. MongoDB + Redis (Raihan requires both for full stack)
2. `PS-App-Backend/chat` → `:6161`
3. `PS-App-Backend/mobileapi` → `:6003`
4. `PS-App-Backend/adminService` → `:6001` (optional)
5. Matt KeyVault Python sidecar → `:5002`
6. `ps-wallet-backend-matt-created` → `:3099`
7. NestJS gateway → `:8080`
8. Next.js web → `:3000` (built with `NEXT_PUBLIC_BASE_PATH=/app`)
9. Caddy TLS → `pinksurfing.com/app` + `pinksurfing.com/api/*`

Linux helper: [scripts/start-official-backends.sh](../scripts/start-official-backends.sh)  
Windows dev: [scripts/start-official-backends.ps1](../scripts/start-official-backends.ps1)

---

## JWT / auth alignment (critical)

| Setting | Raihan location |
|---------|-----------------|
| JWT secret | `chat/.env` `JWT_SECRET` |
| Token password | `mobileapi/config.js` `tokenAuth.password` |
| Web dev mint | `apps/web/.env` `JWT_SECRET` (local mode only) |

Production uses SSO token from `auth.pinksurfing.com` — no local `JWT_SECRET` in web for login.

---

## Flutter (official connections)

```env
SERVER_URL=https://pinksurfing.com/api/app
WALLET_API_URL=https://pinksurfing.com/api/wallet
```

---

## Pre-push checklist

- [ ] `.env`, `.env.local`, `.env.production` **not committed** (only `*.example`)
- [ ] `PS-App-Backend` on branch **`raihan`** (on server, separate clone)
- [ ] Matt repo is **`ps-wallet-backend-matt-created`** (not merge folders)
- [ ] Gateway forwards `Authorization` + `X-Auth-*` headers
- [ ] Production web uses `NEXT_PUBLIC_AUTH_MODE=production` and `NEXT_PUBLIC_BASE_PATH=/app`

---

## Related

- [INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md) — **route map + clone commands**
- [DEPLOYMENT_MANUAL.md](./DEPLOYMENT_MANUAL.md) — step-by-step server setup
- [DEPLOYMENT_MANUAL.md](./DEPLOYMENT_MANUAL.md) — step-by-step server setup
- [LOCAL_STANDALONE_DEMO.md](../../docs/LOCAL_STANDALONE_DEMO.md) — unified local demo
