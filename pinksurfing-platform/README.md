# PinkSurfing Platform Monorepo

**Albert (platform integration)** — web + gateway composing **official Raihan + Matt backends**.

**Client production URL:** [https://pinksurfing.com/app](https://pinksurfing.com/app)  
(API: `https://pinksurfing.com/api/*` via gateway — see deploy docs)

| Doc | Purpose |
|-----|---------|
| [docs/INTEGRATION_SUMMARY.md](./docs/INTEGRATION_SUMMARY.md) | **Route map + official clone URLs (Raihan/Matt)** |
| [../docs/LOGIN_AND_API_REFERENCE.md](../docs/LOGIN_AND_API_REFERENCE.md) | **API URLs, login flows, JWT alignment** |
| [docs/OFFICIAL_BACKEND_CONNECTIONS.md](./docs/OFFICIAL_BACKEND_CONNECTIONS.md) | Official repo URLs & env (start here for production) |
| [docs/DEPLOYMENT_MANUAL.md](./docs/DEPLOYMENT_MANUAL.md) | Step-by-step server deploy |
| [docs/GOOGLE_AUTH_INTEGRATION.md](./docs/GOOGLE_AUTH_INTEGRATION.md) | **Google login + wallet OAuth cross-platform spec** |

**Official backends (separate repos — clone URLs in [INTEGRATION_SUMMARY.md](./docs/INTEGRATION_SUMMARY.md)):**

- **Raihan** — [Shaqmonster/PS-App-Backend](https://github.com/Shaqmonster/PS-App-Backend) branch `raihan` → mobileapi, chat, contracts
- **Matt** — [Shaqmonster/ps-wallet-backend-matt-created](https://github.com/Shaqmonster/ps-wallet-backend-matt-created) → Chia wallet, KeyVault, swaps

This repo provides **gateway + web UI** only.

## Structure

```
pinksurfing-platform/
├── apps/
│   ├── api/          # NestJS gateway (:8080) → Raihan + Matt + admin
│   └── web/          # Next.js 15 app shell (:3000, basePath /app in prod)
├── packages/ui/
├── docs/             # Deploy + connection guides
├── infra/gateway/    # Caddy production template
├── scripts/          # Demo + integration test scripts
└── .env.example
```

## Prerequisites

- Node.js 20+
- For full demo: `PS-App-Backend` (branch `raihan`) as sibling clone for smoke scripts
- Matt wallet `:3099` optional — wallet UI placeholder until verified on Linux

## Setup (local)

```powershell
npm install
copy apps\api\.env.example .env
copy apps\web\.env.example apps\web\.env.local
```

## Quick start — client demo

```powershell
npm run demo
```

Open http://localhost:3000 → **Continue with local stack**.

Copy `apps/web/.env.example` → `.env.local` includes **Agora** vars for voice/video calls (see [Agora calls](#agora-voice--video-calls) below).

## Agora voice / video calls

Voice (☎) and video (▶) buttons in the chat header — same stack as Flutter + Raihan mobileapi.

| Piece | Location |
|-------|----------|
| API client | `apps/web/src/lib/calls-api.ts` |
| Agora hook | `apps/web/src/lib/use-agora-call.ts` |
| Call UI | `apps/web/src/components/calls/CallOverlay.tsx` |

**Flow:** `POST /api/app/chat/calls/initiate` → channel name → `GET /api/app/rtc/...` → Agora Web SDK join.

**Env (`apps/web/.env.local`):**

```env
NEXT_PUBLIC_AGORA_APP_ID=6633314fbbcf41f8a2c73dac26dd8552
NEXT_PUBLIC_CALLS_DEMO=true   # local: skip initiate if full Raihan chat DB is down
```

Production: set `NEXT_PUBLIC_CALLS_DEMO=false` when full Raihan chat + Mongo run on the server.

Full route map: [docs/INTEGRATION_SUMMARY.md](./docs/INTEGRATION_SUMMARY.md#e-agora-voice--video-calls-raihan)

## Web features (summary)

| Feature | Status |
|---------|--------|
| Bottom nav (Home, PayChat, Shop, Share, Explore, Me) | ✅ Flutter parity shell |
| Profile / Me (position, networking, teams, business card) | ✅ Demo data + UI |
| Explore (Pay/Receive, Invoice stubs) | ✅ UI stubs |
| Shop | ✅ iframe → pinksurfing.com |
| Business contracts (Raihan) | ✅ Live via gateway |
| PayChat / Square UI | ✅ UI (mock settlement) |
| Agora voice / video calls | ✅ Wired (outbound; needs gateway + mobileapi) |
| Matt wallet panel | 🎨 Placeholder until `NEXT_PUBLIC_WALLET_LIVE=true` |
| Live Raihan Mongo chat + file upload | ✅ Wired — set `NEXT_PUBLIC_CHAT_LIVE=true` |

## Production build (local test)

Uses `apps/web/.env.production.example` values when you copy that file to `.env.local` and set `NEXT_PUBLIC_BASE_PATH=/app`:

```powershell
copy apps\web\.env.production.example apps\web\.env.local
npm run build
npm run start -w @pinksurfing/web
```

Deploy to server: [docs/DEPLOYMENT_MANUAL.md](./docs/DEPLOYMENT_MANUAL.md)

## Services (local)

| Service | URL |
|---------|-----|
| Web shell | http://localhost:3000 |
| NestJS gateway | http://localhost:8080 |
| Gateway health | http://localhost:8080/health |
| **Upstream status** | http://localhost:8080/health/upstreams |
| App API proxy | http://localhost:8080/api/app/**…** → Raihan `:6003` |
| Wallet proxy | http://localhost:8080/api/wallet/**…** → Matt `:3099` |
| Proxy info (not an error) | http://localhost:8080/api/app · http://localhost:8080/api/wallet |

**Note:** `GET /api/app/` alone returns **info JSON** (or 404 on older builds). Real routes need a path, e.g. `/api/app/business/contracts`. Raihan/Matt must be running for live data — see [docs/OFFICIAL_BACKEND_CONNECTIONS.md](./docs/OFFICIAL_BACKEND_CONNECTIONS.md).

**Full local stack:** from unified repo root, `bash scripts/start-full-stack-linux.sh` — see [../docs/LOCAL_STANDALONE_DEMO.md](../docs/LOCAL_STANDALONE_DEMO.md).

## Production (pinksurfing.com)

| Service | URL |
|---------|-----|
| Web app | https://pinksurfing.com/app |
| API gateway | https://pinksurfing.com/api/* |
| SSO | https://auth.pinksurfing.com/api/token/ |

Env templates: `apps/web/.env.production.example`, `apps/api/.env.production.example`  
Caddy: `infra/gateway/Caddyfile.production.example`

## Environment files

| File | Purpose |
|------|---------|
| `.env` (repo root) | NestJS gateway |
| `apps/web/.env.local` | Next.js (local or production) |

**Do not commit** `.env` or `.env.local`.

Live repo: [devflames/pinksurfing-unified-repo](https://github.com/devflames/pinksurfing-unified-repo)
