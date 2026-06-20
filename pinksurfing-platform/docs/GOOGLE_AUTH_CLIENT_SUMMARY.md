# Google Sign-In — Client Summary (1 page)

**PinkSurfing · June 2026 · Albert / devflames**

---

## Question

Can we use Matt’s Google OAuth for login across Flutter, web, and backends?

## Answer

**Yes for Google sign-in — but not via Matt’s wallet OAuth.**

| | App login (“Sign in with Google”) | Wallet Google (Matt) |
|---|-----------------------------------|----------------------|
| **Purpose** | One account + JWT for chat, contracts, profile | Backup Chia keys to **Google Drive** |
| **When** | First step — every user | Optional — after app login, in wallet |
| **Owner** | **`auth.pinksurfing.com` (SSO)** | Matt wallet backend |

Both can coexist. Users sign in once (SSO). Wallet connects Google Drive separately when needed.

---

## Recommended approach

Extend the **existing SSO** (`auth.pinksurfing.com`) with a Google endpoint that returns the **same JWT** as email/password today. Web and Flutter only change *how* they get the token — everything after that stays the same.

```text
Today:     email/password  →  SSO  →  JWT  →  Raihan  →  chat/contracts
After:     Google sign-in  →  SSO  →  same JWT  →  Raihan  →  chat/contracts
```

Matt’s `/auth/google/*` stays wallet-only. Do **not** use it for app login (wrong scopes, wrong security model).

---

## What we need from you

1. **Confirm** Phase 1 (app Google login) + Phase 2 (wallet Drive OAuth stays separate).
2. **Name the owner** of `auth.pinksurfing.com` to add `POST /api/token/google/` (or equivalent).
3. **Google Cloud** — OAuth consent screen + client IDs for Web, Android, iOS.
4. **Priority** — web first, Flutter first, or parallel?

---

## Engineering estimate (after SSO is unblocked)

| Work | Owner | Time |
|------|--------|------|
| SSO Google endpoint + account linking by email | Auth service | 3–5 days |
| Web “Continue with Google” | Albert | 2–3 days |
| Flutter Google button wiring | Flutter team | 3–4 days |
| Raihan QA + avoid duplicate accounts | Raihan | 1–2 days |
| Cross-platform QA | All | 2–3 days |

**Phase 1 total: ~2–3 weeks** once SSO work starts.

---

## What does *not* change

- JWT format and gateway routing
- Raihan `create-customer-from-sso` (already used by web + Flutter email login)
- Matt wallet architecture for Drive backup

---

**Full technical spec:** [GOOGLE_AUTH_INTEGRATION.md](./GOOGLE_AUTH_INTEGRATION.md)  
**Data ownership & non-custodial wallet:** [DATA_OWNERSHIP_AND_SSO_ARCHITECTURE.md](../../docs/DATA_OWNERSHIP_AND_SSO_ARCHITECTURE.md)  
**Login & API URLs:** [LOGIN_AND_API_REFERENCE.md](../../docs/LOGIN_AND_API_REFERENCE.md)
