# Finish deploy — copy/paste runbook

Stop asking Shaiquel questions. Run these on the servers.

## A) App + wallet — Contabo (`173.249.48.238`, `vmi3338208.contaboserver.net`)

**`ps-wallet-backend`** (Matt wallet `:3099` + Python KeyVault `:5002`) runs here with Next.js + gateway — **not** on DigitalOcean.

```bash
ssh root@173.249.48.238
cd /opt/pinksurfing-web-app-wallet && git pull
bash scripts/bootstrap-wallet-vps.sh   # wallet only — or deploy-build.sh for full stack
```

Secrets (`JWT_SIGNING_KEY` must match `auth.pinksurfing.com`):

```bash
nano /opt/pinksurfing-web-app-wallet/ps-wallet-backend-matt-created/.env
pm2 restart ps-wallet ps-keyvault
curl -s http://127.0.0.1:3099/health; echo
curl -s http://127.0.0.1:5002/health; echo
```

## B) Same box — full web rebuild (`app.pinksurfing.com`)

```bash
cd /opt/pinksurfing-web-app-wallet && git pull
bash scripts/ensure-env.sh
# Edit apps/web/.env.local — GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET
# JWT_SECRET must match auth + coreapi JWT_SIGNING_KEY
bash scripts/deploy-build.sh
```

Smoke from your PC:

```powershell
$env:GATEWAY_URL = "https://app.pinksurfing.com"
node C:\CodeBase\scripts\test-live-paths-phase2.js
```

## C) Coreapi — DigitalOcean (`coreapi.pinksurfing.com` → `24.199.119.184`, droplet `marketplace-s-1vcpu-2gb-sfo3`)

From Windows (needs SSH key on coreapi, not password):

```powershell
powershell -File C:\CodeBase\scripts\deploy-coreapi-chat-patch.ps1 `
  -RemoteHost root@COREAPI_IP `
  -RemoteChatPath /opt/pinksurfing/PS-App-Backend/chat
```

On coreapi `.env` or pm2 env:

```
JWT_SECRET=<same as auth JWT_SIGNING_KEY>
JWT_SIGNING_KEY=<same>
SQUARE_ACCESS_TOKEN=...
SQUARE_ENV=sandbox   # or production
```

Restart: `pm2 restart ps-chat`

## D) What works after this

| Feature | Needs |
|---------|--------|
| Login (Google) | App VPS web env + Google Console redirect |
| Chat / contacts | Coreapi patch + JWT aligned |
| Contracts / Square | Coreapi + Square env |
| Wallet address | Browser setup flow (mnemonic) |
| KeyVault on-chain | Wallet VPS + Pinata + JWT + server XCH for create-auto |
| Swaps | API metadata only — not full on-chain HTLC yet |
| SSO ↔ wallet link | Wallet `JWT_SIGNING_KEY` + user completes wallet setup |

## E) PuTTY SSH later

In DO console:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys   # paste your public key
chmod 600 ~/.ssh/authorized_keys
```

PuTTY → Connection → SSH → Auth → load `.ppk` private key.
