# Legacy Backend Audit & Port Strategy

**Source:** `github.com/SaiShankar93/PS-App-Backend`  
**Target:** `ps-wallet-backend` (our unified backend at 64.23.198.129)  
**Date:** 2026-03-11

---

## PART 1: SECURITY AUDIT — CRITICAL FINDINGS

### 🔴 SEVERITY: CRITICAL

#### 1. Hardcoded Secrets in Source Code (committed to GitHub)
Every single secret is hardcoded in config files and `.env` files **checked into git**:

| Secret | File | Value |
|--------|------|-------|
| MongoDB Atlas credentials | `chat/app.js:49`, `chat/config.js:13-14`, `btcService/app.js:26` | `[REDACTED]` |
| MongoDB credentials (alt) | `mobileapi/config.js:51-53` | `[REDACTED]` |
| Stripe secret key | `mobileapi/config.js:122`, `chat/config.js:25` | `[REDACTED]` |
| Moonpay LIVE secret key | `mobileapi/config.js:127` | `[REDACTED]` |
| Moonpay LIVE webhook key | `mobileapi/config.js:128` | `[REDACTED]` |
| AWS S3 access keys | `mobileapi/.env:2-3`, `chat/.env:2-3` | `[REDACTED]` |
| Admin credentials | `mobileapi/.env:7-8` | `[REDACTED]` |
| Gmail SMTP password | `mobileapi/config.js:33` | `[REDACTED]` |
| CoinMarketCap API keys (4) | `mobileapi/config.js:61-65` | `[REDACTED]` |
| HD wallet mnemonic (LIVE) | `mobileapi/config.js:71` | `[REDACTED]` |
| HD wallet password | `mobileapi/config.js:72` | `[REDACTED]` |
| Infura web3 key | `mobileapi/config.js:76` | `[REDACTED]` |
| Square API token | `chat/routes/chatroom.route.js:71` | `[REDACTED]` |
| JWT secret | `mobileapi/config.js:56` | `sso_secret_key_for_jwt_decoding` |
| Chat JWT secret | `chat/config.js:22` | `password` (literally) |
| Firebase private keys | `chat/firebasePrivateKey.json` | Full service account JSON |
| Agora credentials | `mobileapi/app.js:138-139` | APP_ID + APP_CERTIFICATE |

**Impact:** Anyone with repo access has full control of MongoDB, Stripe, Moonpay, AWS S3, Firebase, HD wallets, and all user funds.

**Action:** ALL these credentials must be rotated IMMEDIATELY. They are burned.

#### 2. Passwords Stored with Reversible Encryption (Not Hashed)
```
mobileapi/routes/users.js:86-100
```
Passwords are "encrypted" with `AES-192-CBC` using:
- Key derived from `"Hello darkness"` with salt `"salt"`
- Fixed IV of all zeros (`Buffer.alloc(16, 0)`)

This is **reversible encryption, not hashing**. Anyone with the source code can decrypt every password in the database. The key and IV are identical across all services (chat, mobileapi, settings).

**Impact:** Complete password database compromise with source code access.

#### 3. TLS Verification Disabled
```
mobileapi/.env:1 → NODE_TLS_REJECT_UNAUTHORIZED=0
chat/.env:1 → NODE_TLS_REJECT_UNAUTHORIZED=0
```
Disables all SSL certificate validation globally. Every HTTPS request (to Stripe, Moonpay, MongoDB Atlas, external APIs) is vulnerable to MITM attacks.

#### 4. Chat Auth Token Secret is Literally "password"
```
chat/config.js:22 → token: { password: 'password' }
```
The JWT signing secret for the entire chat service is the string `"password"`. Anyone can forge valid chat tokens.

#### 5. No Auth on Chat Auth Route
```
chat/routes/auth.route.js:13-25
```
`POST /register` accepts any body and inserts it directly into the accounts collection. `GET /` returns ALL user accounts with no authentication.

#### 6. Unauthenticated Chat Routes
The chat `TokenValidator` is commented out in `groupRoutes.js:74-87` and `CallRoutes.js:63-75`. Group messaging and call routes have NO authentication middleware active.

---

### 🟠 SEVERITY: HIGH

#### 7. MongoDB Injection via Regex
```
mobileapi/routes/users.js:712
```
`accountModel.findOne({ email: { $regex: new RegExp(req.body.email, "i") } })` — User-supplied email is passed directly into RegExp constructor. Attacker can inject regex patterns for ReDoS or match unintended accounts.

#### 8. HD Wallet Master Seed in Config
```
mobileapi/config.js:71
```
The master mnemonic for the custodial wallet system is in plaintext. This seed controls all BTC/ETH wallets derived from it. Combined with the hardcoded password (`shamla@123`), an attacker has full control of all custodial funds.

#### 9. No Rate Limiting on Login
The login route (`/sociallogin`, `/login`) has no rate limiting. The only rate limiter is on `/new` which is a test endpoint. Brute force attacks on any account are trivial.

#### 10. Plaintext Messages in Database
All chat messages stored in MongoDB plaintext. No encryption at rest, no E2E encryption. Server (and anyone with DB access) can read all messages.

#### 11. File Upload Path Traversal Risk
```
mobileapi/app.js:292-294
```
File names are constructed from user input (`file.originalname`) with only whitespace stripping. No sanitization against `../` traversal or executable extensions.

---

### 🟡 SEVERITY: MEDIUM

#### 12. Session Token Not Invalidated
JWT middleware (`mobileapi/lib/jwt.js:56-65`) has session validation commented out. Tokens never expire in practice — the `expiresIn: "5d"` is passed to `verify()` (which ignores it since it's a verify option, not a sign option).

#### 13. Error Objects Leaked to Client
```
mobileapi/routes/users.js:487 → error: error (full error object)
```
Full error stack traces and internal error objects returned to clients in multiple routes.

#### 14. No CORS Restrictions
`app.use(cors())` with no origin restrictions. Any website can make authenticated API calls.

#### 15. Stale Dependencies
`package.json` uses `firebase: ^11.0.1` (client SDK, not admin SDK — wrong package for server), `bitcore-lib: ^10.5.3`, `request-promise` (deprecated). No `package-lock.json` pinning for sub-dependencies in mobileapi.

#### 16. Debug Logging of Sensitive Data
Numerous `console.log` statements print tokens, passwords, user data, and full request bodies to stdout. In production with PM2, these go to log files.

---

## PART 2: PORT STRATEGY — WHAT TO BRING vs. SKIP

### ❌ DO NOT PORT (Already Replaced or Insecure)

| Legacy Feature | Why Skip | Our Replacement |
|---|---|---|
| **User auth (email/password + JWT)** | Insecure password storage, weak JWT. | Email OTP + wallet-based auth (no passwords) |
| **1-on-1 chat (chatroom.route.js)** | Plaintext MongoDB, no E2E. | Wallet relay with X25519+AES-256-GCM |
| **Contacts system** | Tied to MongoDB accounts. | Wallet profile directory (relay + IPFS) |
| **Custodial wallets (WalletFactory)** | HD wallet with shared master seed = custodial. | Self-custodial per-user BLS/BTC keys |
| **BTC/ETH send/receive (txRoutes)** | Server holds private keys. | Client-side BTC/XCH signing |
| **Moonpay/Stripe fiat on-ramp** | Keys burned, needs new merchant setup. | Defer — needs new accounts |
| **KYC document upload** | Tied to old file service. | Defer — regulatory dependent |
| **Admin panel (adminRoutes)** | Tightly coupled to MongoDB. | Build fresh when needed |
| **PayChat (Square payments in chat)** | Square token burned, niche feature. | Revisit as wallet-native payments |
| **Email service (separate microservice)** | We already have SendGrid-based OTP. | email-otp.js in ps-wallet-backend |
| **Socket.IO chat delivery** | Replace polling with WebSocket, but rewrite. | Port concept, not code |
| **MongoDB dependency** | We use SQLite (lightweight, embedded). | Keep SQLite |
| **Session/cache (lokijs)** | In-memory, no persistence. | SQLite + in-memory where needed |

### ✅ PORT (Feature Logic Only — Rewrite for Our Architecture)

#### Priority 1: Group Chat
**Legacy:** `chat/models/group.js`, `chat/routes/groupRoutes.js`  
**What to port:**
- Group model: name, image, creator, members list, channel ID
- Routes: create group, add/remove members, send group message, list groups, group details
- Group message delivery (fan-out to all members)

**Our implementation:**
- New SQLite table: `groups` (group_id, name, image_url, creator_address, created_at)
- New SQLite table: `group_members` (group_id, member_address, role, joined_at)
- Group messages sent as encrypted blobs to relay, fan-out to all member addresses
- E2E: Shared group key derived from member key exchange (Signal-style)

#### Priority 2: Voice/Video Calls (Agora)
**Legacy:** `chat/routes/CallRoutes.js`, `chat/models/CallsModel.js`, `mobileapi/app.js` (RTC token gen)  
**What to port:**
- Agora RTC token generation endpoint (with NEW credentials)
- Call state machine: initiate → accept/reject → end
- Call model: from, to, channel, type (voice/video), status, timestamps
- Group call support (members in call tracking)

**Our implementation:**
- New route: `/calls/token/:channel/:role/:uid` — Agora RTC token generation
- New SQLite table: `calls` (call_id, from_address, to_address, channel, type, status, timestamps)
- Call initiation/acceptance via wallet messaging (encrypted call metadata)
- Push notification triggers on call events

#### Priority 3: Push Notifications (Firebase FCM)
**Legacy:** `chat/src/Notification.js`, `chat/firebasePrivateKey.json`  
**What to port:**
- FCM multi-device token management (FCMTokens array per user)
- Notification dispatch for: new messages, calls, group events
- Invalid token cleanup (remove stale tokens on error)

**Our implementation:**
- Add `fcm_tokens` column to profiles table (JSON array)
- New route: `POST /profiles/fcm-token` — register/update FCM tokens
- New service: `push-service.js` — Firebase Admin SDK with NEW service account
- Trigger notifications on: message send, call initiate, group invite

#### Priority 4: File/Attachment Uploads
**Legacy:** `fileService/`, `mobileapi/src/multerConfig.js`  
**What to port:**
- File upload endpoint with multer
- S3 storage integration (with NEW credentials)
- File URL resolution for chat attachments

**Our implementation:**
- New route: `POST /files/upload` — multer + S3 (or local fallback)
- New route: `GET /files/:fileId` — serve/redirect to S3
- Chat messages can reference file IDs for attachments
- Size limits, content-type validation, virus scanning (future)

#### Priority 5: Business Profiles
**Legacy:** `mobileapi/models/businessModel.js`  
**What to port:**
- Business profile fields: name, email, phone, website, address, logo
- Link business profile to user account

**Our implementation:**
- Extend profiles table with optional business fields
- Or new `business_profiles` table linked by wallet address
- Business info stored on IPFS (source of truth) with relay cache

### ⚠️ PORT LATER (Low Priority)

| Feature | Notes |
|---|---|
| **Real-time WebSocket** | Replace polling with Socket.IO or WS for message delivery. Significant architecture change. |
| **Transaction history** | Client tracks own txns locally. Server-side history useful for tax/audit. |
| **Referral system** | Growth feature. Simple code, port when needed. |
| **Invoice system** | Business feature. Port with business profiles. |
| **Analytics/Usage stats** | Operational tooling. Build with proper observability stack. |
| **Settings (timezone, currency, preferences)** | Extend profile model when needed. |
| **2FA/TOTP** | We have MFA design doc already. Implement per that spec. |
| **Whitelist addresses** | Client-side feature for wallet mode. |

---

## PART 3: EXECUTION PLAN

### Phase 1: Foundation (Now)
1. **Rotate ALL leaked credentials** — MongoDB, Stripe, Moonpay, AWS, Firebase, Agora, etc.
2. **Set up new Firebase project** — new service account for FCM
3. **Set up new Agora project** — new APP_ID + APP_CERTIFICATE
4. Port **push notification service** to ps-wallet-backend
5. Port **group chat** tables + routes

### Phase 2: Communication (Next)
6. Port **voice/video calls** (Agora token gen + call state)
7. Port **file uploads** (multer + S3 with new creds)
8. Add **WebSocket** layer for real-time message delivery

### Phase 3: Business Features (Later)
9. Port **business profiles**
10. Port **transaction history** tracking
11. New fiat on-ramp integration (new Stripe/Moonpay accounts)
12. Build proper **admin dashboard**

---

## PART 4: ARCHITECTURAL DECISIONS

| Decision | Legacy | Our Approach |
|---|---|---|
| **Database** | MongoDB Atlas (shared, cloud) | SQLite (embedded, portable, zero-config) |
| **Auth** | JWT from passwords | Wallet signatures + Email OTP (passwordless) |
| **Encryption** | None (plaintext messages) | X25519+AES-256-GCM E2E |
| **Identity** | Email-based accounts | Wallet address (DID) + IPFS profiles |
| **Key custody** | Server holds all keys | User holds all keys (self-custodial) |
| **Microservices** | 7 separate processes | Single Express app (simpler ops) |
| **Real-time** | Socket.IO (separate service) | Polling → WebSocket (same process) |
| **File storage** | S3 (with leaked keys) | S3 with new keys OR IPFS for permanence |
| **Push** | Firebase FCM | Firebase FCM (new project) |
| **Calls** | Agora RTC | Agora RTC (new project) |
