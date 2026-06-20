# Google Auth — Cross-Platform Integration Spec

**For:** PinkSurfing client & engineering  
**Author:** Albert (`devflames/pinksurfing-web-platform`)  
**Date:** 2026-06-10  
**Status:** Approved by client — web scaffolding in progress (awaiting SSO `/api/token/google/`)

**Data ownership & non-custodial keys:** [DATA_OWNERSHIP_AND_SSO_ARCHITECTURE.md](../../docs/DATA_OWNERSHIP_AND_SSO_ARCHITECTURE.md)

---

## 1. Executive summary

**Yes — Google sign-in across Flutter, web, and backends is possible.**  
**No — we should not reuse Matt’s wallet Google OAuth as the app login for everything.**

| Flow | Purpose | Owner |
|------|---------|--------|
| **A. App login (“Sign in with Google”)** | One PinkSurfing account, JWT for chat/contracts/profile | **SSO** (`auth.pinksurfing.com`) + Raihan sync |
| **B. Wallet Google OAuth** | Encrypt/backup Chia keys in **Google Drive** | **Matt** (`ps-wallet-backend-matt-created`) |

Both can coexist. Users sign in once (A); wallet features optionally connect Google Drive (B).

---

## 2. Current state (today)

```text
┌─────────────┐     email/password      ┌──────────────────────────┐
│ Flutter     │ ──────────────────────► │ auth.pinksurfing.com     │
│ Web (prod)  │                         │ POST /api/token/         │
└─────────────┘                         └────────────┬─────────────┘
                                                     │ JWT (access)
         ┌──────────────────────────────────────────┼──────────────────────┐
         ▼                                          ▼                      ▼
  Raihan mobileapi :6003                    chat :6161              Matt wallet :3099
  /users/create-customer-from-sso           (same JWT)              /auth/google/* (Drive only)
```

| Platform | Login today | Google login today |
|----------|-------------|-------------------|
| **Flutter** | SSO email/password (`auth_provider.dart`) | UI buttons on login screen — **not wired** |
| **Web** | SSO via `POST /app/api/auth/login` → SSO → Raihan | **Not implemented** |
| **Matt wallet** | N/A (uses SSO JWT + Ed25519 headers for API) | **`GET /auth/google`** — Drive backup only |
| **Raihan** | `POST /users/create-customer-from-sso` | `POST /register/google` exists — separate registration path |

**Gateway (production):**  
`https://pinksurfing.com/api/app/*` → Raihan · `https://pinksurfing.com/api/wallet/*` → Matt

---

## 3. Target architecture (after integration)

```text
                    ┌─────────────────────────────────────┐
  Flutter / Web     │  auth.pinksurfing.com               │
  "Sign in with     │  + Google OAuth (NEW)               │
   Google"          │  → same JWT as email login          │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
       Raihan mobileapi          chat / contracts         Matt wallet
       create-customer-from-sso   (Bearer JWT)            /api/wallet/auth/google/*
                                                         (Drive keys — separate step)
```

**Rule:** Every client stores **one SSO JWT**. Wallet Google tokens never replace app login.

---

## 4. Phase 1 — App login with Google (all platforms)

### 4.1 Auth service (`auth.pinksurfing.com`) — **blocking dependency**

Matt/Raihan/Albert cannot complete this alone if SSO does not expose Google. Required work on the **auth host** (Django or equivalent).

**Interim (Raihan `PS-App-Backend`):** `POST /users/token/google` in mobileapi forwards to SSO when live, else issues JWT locally. Proxy auth host → mobileapi or set `AUTH_GOOGLE_TOKEN_URL` to gateway `/api/app/users/token/google`. See `PS-App-Backend/docs/SSO_GOOGLE_TOKEN_ENDPOINT.md`.

| Item | Detail |
|------|--------|
| New endpoint or extend token | e.g. `POST /api/token/google/` with `{ id_token }` from Google, or OAuth code exchange server-side |
| Google Cloud project | OAuth client IDs: **Web**, **Android**, **iOS** (Flutter) |
| Redirect URIs | `https://pinksurfing.com/app/api/auth/google/callback`, localhost dev URIs |
| Output | **Same JWT shape** as `POST /api/token/` today (`access` field) |
| User provisioning | On first Google login → create user (mirror `api/signup/` behaviour) |

> **Action for client:** Confirm who owns `auth.pinksurfing.com` and approve Google Cloud OAuth app creation.

### 4.2 Raihan (`PS-App-Backend`, branch `raihan`)

| Task | Endpoint | Notes |
|------|----------|-------|
| Sync Google user | `POST /users/create-customer-from-sso` | **Already used** by web login — no change if JWT is identical |
| Optional cleanup | `POST /register/google` | Deprecate or align with SSO-first flow to avoid duplicate account paths |
| JWT alignment | `JWT_SECRET` / `tokenAuth.password` | Must match chat + web (see `OFFICIAL_BACKEND_CONNECTIONS.md`) |

### 4.3 Web (`pinksurfing-platform/apps/web`)

| Task | Location | Notes |
|------|----------|-------|
| “Continue with Google” button | `LoginScreen.tsx` | Next to email login |
| OAuth callback route | **New** `app/api/auth/google/callback/route.ts` | Exchange code → SSO JWT → `create-customer-from-sso` → `saveSession()` |
| Or popup flow | `@react-oauth/google` or server-side PKCE | Prefer server callback to hide client secret |
| Session | Reuse `auth-context.tsx` | Same `token` + `user` as email login (`mode: 'sso'`) |
| Env | See §6 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, callback URL |

**Pattern:** Copy logic from existing `api/auth/login/route.ts` — only step 1 (get JWT) changes from password to Google.

### 4.4 Flutter (`ps-flutter-app`)

| Task | Package / file | Notes |
|------|----------------|-------|
| Wire Google button | `login.dart` | Replace decorative assets with `google_sign_in` |
| Get Google token | `auth_provider.dart` | `idToken` → send to SSO Google endpoint |
| Store JWT | Existing `saveTokenLocal` | No change |
| Sync user | Call mobileapi with Bearer (if not done in SSO) | Same as post-login today |
| iOS / Android config | `GoogleService-Info.plist`, SHA-1 in Google Console | Required for release builds |

### 4.5 Gateway — no auth changes

Gateway already forwards `Authorization`. Google login does **not** need new proxy routes for app APIs.

Optional convenience (already in latest gateway):

- `GET /health/upstreams` — verify Raihan/Matt up
- `GET /api/wallet` — proxy info

---

## 5. Phase 2 — Wallet Google (Matt, unchanged design)

When user opens **Chia wallet / KeyVault** (Flutter or web wallet panel live):

| Step | Call | Via |
|------|------|-----|
| 1 | User already logged in (SSO JWT) | — |
| 2 | `GET /api/wallet/auth/google?json=true` | Gateway → Matt `:3099` |
| 3 | Browser opens Google consent (Drive `appdata` scope) | Matt callback |
| 4 | Poll `GET /api/wallet/auth/google/token/:sessionId` | Flutter desktop / web popup |
| 5 | Keys backed up to Google Drive | Matt KeyVault |

**Do not** use this flow for chat login or profile.

Matt env (server):

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://pinksurfing.com/api/wallet/auth/google/callback
```

---

## 6. Environment variables

### Auth service (owner TBD)

```env
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_ALLOWED_AUDIENCES=web-client-id,android-client-id,ios-client-id
```

### Web (`apps/web/.env.local` / production)

```env
NEXT_PUBLIC_AUTH_MODE=production
AUTH_TOKEN_URL=https://auth.pinksurfing.com/api/token/
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...                    # server only — never NEXT_PUBLIC_
GOOGLE_REDIRECT_URI=https://pinksurfing.com/app/api/auth/google/callback
APP_API_URL=http://127.0.0.1:6003
```

### Flutter (`.env` / build config)

```env
# Existing
SERVER_URL=https://pinksurfing.com/api/app
WALLET_API_URL=https://pinksurfing.com/api/wallet

# New
GOOGLE_CLIENT_ID_ANDROID=...
GOOGLE_CLIENT_ID_IOS=...
AUTH_GOOGLE_TOKEN_URL=https://auth.pinksurfing.com/api/token/google/
```

### Matt wallet (unchanged)

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://pinksurfing.com/api/wallet/auth/google/callback
```

---

## 7. Test plan (sign-off checklist)

| # | Scenario | Pass criteria |
|---|----------|---------------|
| 1 | Google login — new user (web) | JWT issued, user row in Raihan, chat/contact works |
| 2 | Google login — new user (Flutter) | Same account as web (same email) |
| 3 | Google login — existing email/password user | Same `user._id`, no duplicate account |
| 4 | Email login still works | Regression on Flutter + web |
| 5 | JWT works on gateway | `Authorization: Bearer` → contracts, chat live |
| 6 | Wallet Google (Matt) | Drive connect after app login; keys not on server plaintext |
| 7 | Logout / re-login | Clean session on all clients |
| 8 | Cloud agent / local dev | Redirect URIs include localhost |

---

## 8. Timeline estimate (engineering)

| Phase | Scope | Estimate |
|-------|--------|----------|
| **0** | Auth service Google endpoint + Google Cloud project | 3–5 days (auth owner) |
| **1a** | Web Google login | 2–3 days |
| **1b** | Flutter Google login | 3–4 days (incl. iOS/Android store config) |
| **1c** | Raihan QA + dedupe `register/google` | 1–2 days |
| **2** | Web wallet panel → Matt Drive OAuth | 2–3 days (when wallet live) |
| **QA** | Cross-platform test matrix | 2–3 days |

**Total (Phase 1 production-ready):** ~2–3 weeks with auth service unblocked.

---

## 9. Risks & explicit non-goals

| Risk | Mitigation |
|------|------------|
| SSO team unavailable | Blocker — cannot ship unified Google login without `auth.pinksurfing.com` |
| Duplicate accounts (Google vs email) | SSO must link by email; Raihan `create-customer-from-sso` idempotent |
| Using Matt OAuth for login | **Rejected** — wrong scopes, wrong security model |
| Merge / experiment repos | **Not used** — official repos only (`PRODUCTION_BACKEND_POLICY.md`) |

**Non-goals for Phase 1:** Facebook/Apple login, replacing SSO entirely, changing JWT format.

---

## 10. Decisions needed from client

1. **Confirm Phase 1 + 2** (app Google login + wallet Drive OAuth separate) — recommended  
2. **Who owns `auth.pinksurfing.com`** for Google OAuth implementation?  
3. **Google Cloud billing account** for OAuth consent screen (production)  
4. **Priority:** Web first, Flutter first, or both in parallel?

---

## Related docs

- [OFFICIAL_BACKEND_CONNECTIONS.md](./OFFICIAL_BACKEND_CONNECTIONS.md) — JWT alignment, gateway URLs  
- [INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md) — full route map  
- [TEAM_AND_REPOSITORY_MAP.md](../../docs/TEAM_AND_REPOSITORY_MAP.md) — Matt vs Raihan responsibilities  
- Matt wallet: `ps-wallet-backend-matt-created/src/routes/auth.js`  
- Web login reference: `apps/web/src/app/api/auth/login/route.ts`
