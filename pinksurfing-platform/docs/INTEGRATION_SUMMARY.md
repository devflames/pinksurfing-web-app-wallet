# Integration Summary — Web, Gateway, Raihan & Matt

**Platform repo:** [devflames/pinksurfing-web-platform](https://github.com/devflames/pinksurfing-web-platform)  
**Production URL:** [https://pinksurfing.com/app](https://pinksurfing.com/app)

**Platform strategy (client/team):** [PLATFORM_UNIFICATION_PLAN.md](../../docs/PLATFORM_UNIFICATION_PLAN.md) — one account, unified API & deployment (no big-bang monolith rewrite).

This document maps **what this repo implements** to **Raihan’s and Matt’s official backends**. It does not duplicate their source — clone those repos separately on the server.

---

## Official backend repos (clone these)

| Owner | Repo | Branch | Clone |
|-------|------|--------|-------|
| **Raihan** | `PS-App-Backend` | **`raihan`** | `git clone -b raihan https://github.com/Shaqmonster/PS-App-Backend.git` |
| **Matt** | `ps-wallet-backend-matt-created` | **`main`** | `git clone https://github.com/Shaqmonster/ps-wallet-backend-matt-created.git` |
| **Albert (this repo)** | `pinksurfing-web-platform` | **`main`** | `git clone https://github.com/devflames/pinksurfing-web-platform.git` |

**Do not use for production:** `ps-merged-backend-FOR-ALBERT 2`, `PinkSurfingBackendMerge`, or any Albert merge experiment folders.

### Raihan processes (from `PS-App-Backend`)

| Service | Path | Port | Role |
|---------|------|------|------|
| mobileapi | `PS-App-Backend/mobileapi` | **6003** | Main app API, JWT gate, `/chat` proxy to chat |
| chat | `PS-App-Backend/chat` | **6161** | Contracts, chatrooms, notifications |
| adminService | `PS-App-Backend/adminService` | **6001** | Admin API (optional) |

### Matt processes (from `ps-wallet-backend-matt-created`)

| Service | Path | Port | Role |
|---------|------|------|------|
| wallet API | repo root `npm start` | **3099** | Chia wallet, swaps, KeyVault orchestration |
| KeyVault sidecar | Python (see Matt README) | **5002** | Chia keys / vault operations |

---

## End-to-end architecture

```text
Browser
  │
  ├─ https://pinksurfing.com/app/*          → Next.js (apps/web) :3000
  │     └─ /app/api/auth/login              → Next.js route (SSO + mobileapi sync)
  │     └─ /app/api/dev-token               → Next.js route (local dev JWT only)
  │
  └─ https://pinksurfing.com/api/*          → NestJS gateway (apps/api) :8080
        │
        ├─ /api/app/*     ──strip prefix──►  Raihan mobileapi :6003
        │                                      └─ /chat/* ──proxy──► chat :6161
        │
        ├─ /api/wallet/*  ──strip prefix──►  Matt wallet :3099
        │
        └─ /api/admin/*   ──strip prefix──►  Raihan admin :6001

SSO (external, not proxied):
  https://auth.pinksurfing.com/api/token/
```

Gateway path rewrite (see `apps/api/src/modules/proxy/proxy.service.ts`):

- `/api/app/…` → `{APP_API_URL}/…` (prefix removed)
- `/api/wallet/…` → `{WALLET_API_URL}/…`
- `/api/admin/…` → `{ADMIN_API_URL}/…`

Headers forwarded: `Authorization`, `X-Auth-Address`, `X-Auth-Timestamp`, `X-Auth-Signature`.

---

## Route map — what the web app calls today

### A. Next.js-only routes (not through gateway)

| Web calls | Handler | Upstream | Code |
|-----------|---------|----------|------|
| `POST /app/api/auth/login` | Next.js API route | 1) `AUTH_TOKEN_URL` (SSO) → 2) `APP_API_URL/users/create-customer-from-sso` (Raihan mobileapi, server-side) | `apps/web/src/app/api/auth/login/route.ts` |
| `GET /app/api/dev-token` | Next.js API route | Local JWT mint (dev only) | `apps/web/src/app/api/dev-token/route.ts` |

Production login flow:

1. Browser → Next.js `/api/auth/login`
2. Next.js → `https://auth.pinksurfing.com/api/token/` (SSO token)
3. Next.js → `http://127.0.0.1:6003/users/create-customer-from-sso` (direct mobileapi on host)
4. Returns SSO JWT + user profile to browser

### B. Business contracts (live — via gateway → Raihan)

Web base URL: `NEXT_PUBLIC_API_URL` + `/chat/chats/contracts`  
Default local: `http://localhost:8080/api/app/chat/chats/contracts`

| Web function | HTTP | Gateway path | mobileapi path | chat path (final) |
|--------------|------|--------------|----------------|-------------------|
| `fetchAllContracts` | GET | `/api/app/chat/chats/contracts/all` | `/chat/chats/contracts/all` | `/chats/contracts/all` |
| `fetchContractsByConversation` | POST | `…/byConversation` | `/chat/chats/contracts/byConversation` | `/chats/contracts/byConversation` |
| `createContract` | POST | `…/create` | `/chat/chats/contracts/create` | `/chats/contracts/create` |
| `executeContractAction` | POST | `…/action` | `/chat/chats/contracts/action` | `/chats/contracts/action` |

Raihan source: `PS-App-Backend/chat/routes/contracts.js`  
Web client: `apps/web/src/lib/contracts-api.ts`, `apps/web/src/lib/api-client.ts`

Auth: `Authorization: Bearer <JWT>` on every contract call.

### C. Matt wallet (wired — UI placeholder until `NEXT_PUBLIC_WALLET_LIVE=true`)

Web base URL: `NEXT_PUBLIC_WALLET_URL`  
Default local: `http://localhost:8080/api/wallet`

| Web function | HTTP | Gateway path | Matt path |
|--------------|------|--------------|-----------|
| `fetchWalletInfo` | GET | `/api/wallet/` | `/` |
| `fetchWalletInfo` (KV health) | GET | `/api/wallet/keyvault/health` | `/keyvault/health` |
| `fetchOpenSwaps` | GET | `/api/wallet/swaps/open?limit=N` | `/swaps/open` |
| `fetchSwapsForAddress` | GET | `/api/wallet/swaps/address/:addr` | `/swaps/address/:addr` |
| `lookupKeyVault` | GET | `/api/wallet/keyvault/lookup/:addr` | `/keyvault/lookup/:addr` |
| `fetchKeyVaultStatus` | GET | `/api/wallet/keyvault/status/:id` | `/keyvault/status/:id` |

Matt has 70+ additional routes (`/auth`, `/paychat`, `/profiles`, etc.) — gateway proxies all of `/api/wallet/*`; web UI only uses the subset above today.

Web client: `apps/web/src/lib/wallet-api.ts`  
UI: `apps/web/src/components/wallet/WalletPanel.tsx`

### D. Gateway health

| Call | Path | Handler |
|------|------|---------|
| `curl` / monitoring | `/health` or `/api/health` (via Caddy) | `apps/api/src/modules/health/health.controller.ts` |

### E. Agora voice / video calls (Raihan)

| Web action | HTTP | Gateway path | Raihan path |
|------------|------|--------------|-------------|
| Initiate call | POST | `/api/app/chat/calls/initiate` | chat `/calls/initiate` (via mobileapi proxy) |
| End call | POST | `/api/app/chat/calls/end` | chat `/calls/end` |
| RTC token | GET | `/api/app/rtc/:channel/publisher/uid/:uid` | mobileapi `/rtc/...` |

Web client: `apps/web/src/lib/calls-api.ts`, `apps/web/src/lib/use-agora-call.ts`, `CallOverlay` in chat header (☎ / ▶ buttons).

Env: `NEXT_PUBLIC_AGORA_APP_ID` (same as Flutter). Local dev: `NEXT_PUBLIC_CALLS_DEMO=true` skips initiate when full chat stack is down.

### F. Live chat + file upload (Raihan — optional via flag)

Enable with `NEXT_PUBLIC_CHAT_LIVE=true` in `apps/web/.env.local`. Requires gateway + Raihan mobileapi + chat service (:6161) with Mongo.

| Web function | HTTP | Gateway path | chat path (final) |
|--------------|------|--------------|-------------------|
| `fetchContactList` | GET | `/api/app/chat/users/contactList` | `/users/contactList` |
| `fetchOneToOneMessages` | POST | `/api/app/chat/chats/getOneToOneMessageBulk` | `/chats/getOneToOneMessageBulk` |
| `sendChatMessage` | POST | `/api/app/chat/chats/add` | `/chats/add` |
| `uploadChatAttachment` | POST | `/api/app/chat/users/uploadAttachment` | `/users/uploadAttachment` |

Flutter parity: same endpoints as `PS-Flutter-App/lib/database/endpoints.dart` and `ChatProvider` / `ContactsProvider`.

Web client: `apps/web/src/lib/chat-api.ts`, `use-contacts.ts`, `use-live-chat.ts`  
UI: `ChatInput` (📎 attach), `MessageThread` (attachment bubbles)

When flag is **off**, chat uses local `chat-session.ts` (demo auto-reply). Contract state events use local session in both modes.

### G. Flutter-parity shell (bottom nav + Profile/Me)

| Section | Component | Notes |
|---------|-----------|-------|
| Home / PayChat | `AppShell.tsx` | 3-column chat; tab filter by section |
| Shop | `ShopView.tsx` | iframe `pinksurfing.com` |
| Share | `ShareView.tsx` | Copy link |
| Explore | `ExploreView.tsx` | Tiles + Pay/Receive & Invoice stubs |
| Me | `ProfileView.tsx` | Profile fields, networking, teams, business card |

Types: `AppSection` in `packages/ui/src/index.ts`  
---

## Environment variables (quick reference)

| Variable | Set on | Purpose |
|----------|--------|---------|
| `APP_API_URL` | Gateway `.env` | Raihan mobileapi (`http://127.0.0.1:6003`) |
| `WALLET_API_URL` | Gateway `.env` | Matt wallet (`http://127.0.0.1:3099`) |
| `ADMIN_API_URL` | Gateway `.env` | Raihan admin (`http://127.0.0.1:6001`) |
| `CORS_ORIGINS` | Gateway `.env` | e.g. `https://pinksurfing.com` |
| `NEXT_PUBLIC_API_URL` | Web `.env.local` | Public gateway app prefix |
| `NEXT_PUBLIC_WALLET_URL` | Web `.env.local` | Public gateway wallet prefix |
| `NEXT_PUBLIC_BASE_PATH` | Web `.env.local` | `/app` in production |
| `NEXT_PUBLIC_AUTH_MODE` | Web `.env.local` | `local` (dev) or `production` (SSO) |
| `AUTH_TOKEN_URL` | Web `.env.local` | `https://auth.pinksurfing.com/api/token/` |
| `APP_API_URL` | Web `.env.local` | Direct mobileapi for SSR login sync |
| `NEXT_PUBLIC_WALLET_LIVE` | Web `.env.local` | `true` when Matt verified on server |
| `NEXT_PUBLIC_AGORA_APP_ID` | Web `.env.local` | Agora App ID (same as Raihan mobileapi / Flutter) |
| `NEXT_PUBLIC_CALLS_DEMO` | Web `.env.local` | `true` = local demo channel if initiate fails |
| `NEXT_PUBLIC_CHAT_LIVE` | Web `.env.local` | `true` = Raihan contactList + messages + upload |

Templates: `apps/api/.env.production.example`, `apps/web/.env.production.example`

---

## What is implemented vs mock in this repo

| Feature | Status | Backend |
|---------|--------|---------|
| 3-column web shell | ✅ Live | This repo |
| Bottom nav (Home, PayChat, Shop, Share, Explore, Me) | ✅ Live | This repo |
| Profile / Me (networking, teams, business card) | ✅ UI | Demo data; Raihan profile API TBD |
| Explore (Pay/Receive, Invoice) | ✅ UI stubs | This repo |
| Shop | ✅ iframe | pinksurfing.com |
| Local dev login (`/api/dev-token`) | ✅ Live | This repo |
| Production SSO login | ✅ Wired | SSO + Raihan mobileapi |
| Business contracts (CRUD + actions) | ✅ Live | Raihan chat via gateway |
| PayChat / Square UI | ✅ UI flow | Mock settlement (real Square = Phase 2) |
| AI Agent / BTC Swap views | ✅ UI | Mock / state events; Matt HTLC later |
| Live Raihan chat + file upload | ✅ Wired | Set `NEXT_PUBLIC_CHAT_LIVE=true` |
| Chat (demo mode) | ✅ Session | Local browser when flag off |
| Matt wallet panel | 🎨 Placeholder | Routes wired; set `NEXT_PUBLIC_WALLET_LIVE=true` |
| Agora voice / video calls | ✅ Wired | Raihan `/chat/calls/*` + `/rtc` token; needs gateway + mobileapi |
| Flutter app | 📱 Separate | Point `SERVER_URL` / `WALLET_API_URL` at gateway |

---

## Verification scripts

Run from repo root after starting services:

```bash
# Contract smoke (needs PS-App-Backend sibling + smoke or full stack)
node scripts/run-contract-smoke-test.js

# Web → gateway → Raihan contracts
node scripts/test-web-contracts-gateway.js

# Web → gateway → Matt wallet (needs Matt on :3099)
GATEWAY_URL=http://127.0.0.1:8080 node scripts/test-wallet-gateway.js
```

---

## Key source files in this repo

| Area | Path |
|------|------|
| Gateway proxy | `apps/api/src/modules/proxy/proxy.service.ts` |
| Gateway routes | `apps/api/src/modules/proxy/proxy.module.ts` |
| Web API client | `apps/web/src/lib/api-client.ts` |
| Contracts client | `apps/web/src/lib/contracts-api.ts` |
| Wallet client | `apps/web/src/lib/wallet-api.ts` |
| Auth (production) | `apps/web/src/app/api/auth/login/route.ts` |
| Auth (local) | `apps/web/src/app/api/dev-token/route.ts` |
| Agora calls | `apps/web/src/lib/calls-api.ts`, `use-agora-call.ts`, `components/calls/CallOverlay.tsx` |
| Live chat | `apps/web/src/lib/chat-api.ts`, `use-live-chat.ts`, `use-contacts.ts` |
| Bottom nav + Profile | `components/nav/BottomNav.tsx`, `components/profile/*`, `components/explore/*` |
| Subpath `/app` | `apps/web/next.config.ts`, `apps/web/src/lib/base-path.ts` |
| Production Caddy | `infra/gateway/Caddyfile.production.example` |

---

## Related docs

- [LOGIN_AND_API_REFERENCE.md](../../docs/LOGIN_AND_API_REFERENCE.md) — API URLs, login flows, JWT alignment
- [OFFICIAL_BACKEND_CONNECTIONS.md](./OFFICIAL_BACKEND_CONNECTIONS.md) — connection modes & env tables
- [DEPLOYMENT_MANUAL.md](./DEPLOYMENT_MANUAL.md) — server setup step-by-step
- [LOCAL_STANDALONE_DEMO.md](../../docs/LOCAL_STANDALONE_DEMO.md) — unified local demo walkthrough
