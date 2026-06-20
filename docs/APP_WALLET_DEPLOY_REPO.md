# App + Wallet Deploy Repo (separate GitHub repo)

**Goal:** Deploy **only** `pinksurfing-platform` + `ps-wallet-backend-matt-created` to **`https://app.pinksurfing.com`**.

Everything else is **already live on other servers** — gateway proxies to them where needed.

| On app VPS | Remote (other servers) |
|------------|------------------------|
| Next.js web + NestJS gateway | — |
| Matt wallet `:3099` + KeyVault `:5002` | — |
| — | Raihan → **coreapi.pinksurfing.com** |
| — | SSO → **auth.pinksurfing.com** |
| — | Shop → **pinksurfing.com** |

---

## Is it possible?

**Yes.** Recommended layout:

```text
pinksurfing-app-wallet/          ← new GitHub repo
├── README.md
├── Caddyfile                    ← app.pinksurfing.com
├── ecosystem.config.cjs         ← PM2 (web + gateway + wallet)
├── scripts/
│   ├── bootstrap-contabo.sh
│   ├── ensure-env.sh
│   └── verify.sh
├── pinksurfing-platform/        ← unchanged monorepo
└── ps-wallet-backend-matt-created/
```

**DNS:** `A  app  →  173.249.48.238`  
**Marketplace:** `https://pinksurfing.com/` stays on existing ecommerce host.

---

## Create the repo (from unified CodeBase)

```bash
cd C:\CodeBase   # or /path/to/pinksurfing-unified-repo
bash scripts/export-app-wallet-repo.sh ../pinksurfing-app-wallet

cd ../pinksurfing-app-wallet
git init
git add .
git commit -m "Initial app+wallet deploy repo for app.pinksurfing.com"
git remote add origin git@github.com:YOUR_ORG/pinksurfing-app-wallet.git
git push -u origin main
```

On Contabo:

```bash
git clone git@github.com:YOUR_ORG/pinksurfing-app-wallet.git /opt/pinksurfing-app
cd /opt/pinksurfing-app
bash scripts/bootstrap-contabo.sh
```

---

## Env (subdomain — empty base path)

**Web** (`pinksurfing-platform/apps/web/.env.local`):

```env
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_APP_ORIGIN=https://app.pinksurfing.com
NEXT_PUBLIC_API_URL=https://app.pinksurfing.com/api/app
NEXT_PUBLIC_WALLET_URL=https://app.pinksurfing.com/api/wallet
NEXT_PUBLIC_WALLET_LIVE=true
NEXT_PUBLIC_CHAT_LIVE=true
NEXT_PUBLIC_CONTRACTS_LIVE=true
SSO_SYNC_OPTIONAL=true
AUTH_TOKEN_URL=https://auth.pinksurfing.com/api/token/
```

**Gateway** (`pinksurfing-platform/.env`):

```env
PORT=8080
CORS_ORIGINS=https://app.pinksurfing.com
WALLET_API_URL=http://127.0.0.1:3099
APP_API_URL=https://coreapi.pinksurfing.com
```
**Wallet** (`ps-wallet-backend-matt-created/.env`):

```env
PORT=3099
CHIA_USE_REMOTE=true
GOOGLE_REDIRECT_URI=https://app.pinksurfing.com/api/wallet/auth/google/callback
```

---

## Wallet already on Contabo?

If Matt wallet is **already running** on the VPS:

```bash
pm2 list   # find ps-wallet — do not start a second copy
pm2 start ecosystem.config.cjs --only ps-gateway,ps-web,ps-keyvault
```

Set `WALLET_API_URL=http://127.0.0.1:3099` only.

---

## Live URLs

| URL | Service |
|-----|---------|
| `https://app.pinksurfing.com/` | Next.js web (this VPS) |
| `https://app.pinksurfing.com/api/wallet/` | Matt wallet via gateway (this VPS) |
| `https://app.pinksurfing.com/api/app/` | Gateway → **coreapi.pinksurfing.com** (remote) |
| `https://coreapi.pinksurfing.com/api-docs/` | Raihan API reference |
| `https://auth.pinksurfing.com/` | SSO login (remote) |
| `https://pinksurfing.com/` | Ecommerce (remote) |
---

## Syncing updates from main unified repo

Re-run export when platform or wallet changes:

```bash
bash scripts/export-app-wallet-repo.sh ../pinksurfing-app-wallet
cd ../pinksurfing-app-wallet && git add -A && git commit -m "Sync from unified repo" && git push
```

Or use **git subtree** / **submodule** if you prefer linked history (more complex).

---

## What is NOT deployed on app.pinksurfing.com

| Excluded | Runs on |
|----------|---------|
| `Pinksurfing-Ecommerce-New-Prod` | `pinksurfing.com` |
| `SSO/` | `auth.pinksurfing.com` |
| `PS-App-Backend/` | **coreapi.pinksurfing.com** (gateway proxies `/api/app/*` there) |
| `ps-flutter-app/` | App stores / separate release |