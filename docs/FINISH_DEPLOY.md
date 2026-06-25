# Finish deploy — copy/paste runbook

Stop asking Shaiquel questions. Run these on the servers.

## A) Wallet droplet (`ps-wallet-backend`, `64.23.198.129`)

You are already in the DO web console as `root`.

```bash
apt-get update && apt-get install -y git curl
mkdir -p /opt/pinksurfing && cd /opt/pinksurfing
git clone https://github.com/devflames/pinksurfing-web-app-wallet.git pinksurfing-web-app-wallet 2>/dev/null || true
cd pinksurfing-web-app-wallet && git pull
bash scripts/bootstrap-wallet-vps.sh
```

Then set secrets (get `JWT_SIGNING_KEY` from whoever runs `auth.pinksurfing.com`):

```bash
nano /opt/pinksurfing-web-app-wallet/ps-wallet-backend-matt-created/.env
# JWT_SIGNING_KEY=...
# PINATA_JWT=...
# SERVER_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
pm2 restart ps-wallet ps-keyvault
curl -s http://127.0.0.1:3099/health | head -c 400; echo
curl -s http://127.0.0.1:5002/health | head -c 400; echo
```

## B) App VPS (`app.pinksurfing.com` — web + gateway)

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

## C) Coreapi (`coreapi.pinksurfing.com` — chat/contracts)

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
