const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'wallet.db'));

// WAL mode for better concurrent reads
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS inscriptions (
    id TEXT PRIMARY KEY,
    wallet_pk TEXT NOT NULL,
    chia_address TEXT NOT NULL,
    profile_data TEXT NOT NULL,
    ipfs_cid TEXT,
    metadata_uri TEXT,
    nft_coin_id TEXT,
    spend_bundle_json TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    tx_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_inscriptions_address ON inscriptions(chia_address);
  CREATE INDEX IF NOT EXISTS idx_inscriptions_status ON inscriptions(status);

  CREATE TABLE IF NOT EXISTS oauth_sessions (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TEXT,
    email TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Encrypted message relay: server stores opaque blobs, cannot read content
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_address TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    sender_pk TEXT NOT NULL,
    encrypted_payload TEXT NOT NULL,
    nonce TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    delivered INTEGER NOT NULL DEFAULT 0,
    delivered_at TEXT,
    expired INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_address, delivered);
  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_address);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

  -- Profile directory: public key → address → display profile
  -- This acts as a cache / registry for on-chain profiles
  CREATE TABLE IF NOT EXISTS profiles (
    chia_address TEXT PRIMARY KEY,
    wallet_pk TEXT NOT NULL,
    username TEXT,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    profile_data TEXT,
    ipfs_cid TEXT,
    metadata_uri TEXT,
    nft_coin_id TEXT,
    source TEXT NOT NULL DEFAULT 'registered',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_profiles_pk ON profiles(wallet_pk);

  -- On-chain KeyVault singletons for encrypted wallet backup
  CREATE TABLE IF NOT EXISTS keyvaults (
    launcher_id TEXT PRIMARY KEY,
    wallet_address TEXT,
    owner_pubkey TEXT NOT NULL,
    latest_cid TEXT,
    backup_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_keyvaults_wallet ON keyvaults(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_keyvaults_status ON keyvaults(status);

`);

// ── Split-key MFA recovery tables ──

db.exec(`
  -- Server-side key shares for split-key envelope encryption
  -- Server share + user's password-derived key = full decryption key
  CREATE TABLE IF NOT EXISTS key_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    launcher_id TEXT NOT NULL UNIQUE,
    share_enc TEXT NOT NULL,
    share_nonce TEXT NOT NULL,
    share_tag TEXT NOT NULL,
    backup_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_key_shares_launcher ON key_shares(launcher_id);

  -- MFA methods registered per vault (TOTP, passkey, recovery codes)
  CREATE TABLE IF NOT EXISTS mfa_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    launcher_id TEXT NOT NULL,
    method_type TEXT NOT NULL,
    secret_enc TEXT NOT NULL,
    label TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(launcher_id, method_type, label)
  );

  CREATE INDEX IF NOT EXISTS idx_mfa_methods_launcher ON mfa_methods(launcher_id);

  -- Recovery attempt audit log + rate limiting
  CREATE TABLE IF NOT EXISTS recovery_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    launcher_id TEXT NOT NULL,
    method_type TEXT,
    success INTEGER NOT NULL DEFAULT 0,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_recovery_attempts_launcher_time
    ON recovery_attempts(launcher_id, created_at);
`);

// Migration: add username column if missing (existing databases)
try {
  db.exec(`ALTER TABLE profiles ADD COLUMN username TEXT`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL`);
  console.log('[DB] Migrated profiles: added username column');
} catch (e) {
  // Column already exists — expected after first run
}

// Migration: add encrypted_data column to keyvaults (store backup blob locally, not just on IPFS)
try {
  db.exec(`ALTER TABLE keyvaults ADD COLUMN encrypted_data TEXT`);
  console.log('[DB] Migrated keyvaults: added encrypted_data column');
} catch (e) {
  // Column already exists — expected after first run
}

// Migration: add signature column to messages (Ed25519 message signing)
try {
  db.exec(`ALTER TABLE messages ADD COLUMN signature TEXT`);
  console.log('[DB] Migrated messages: added signature column');
} catch (e) {
  // Column already exists — expected after first run
}

// Migration: add messaging_pk column to profiles (for sealed-sender PK → address resolution)
try {
  db.exec(`ALTER TABLE profiles ADD COLUMN messaging_pk TEXT`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_profiles_messaging_pk ON profiles(messaging_pk) WHERE messaging_pk IS NOT NULL`);
  console.log('[DB] Migrated profiles: added messaging_pk column');
} catch (e) {
  // Column already exists — expected after first run
}

// Migration: add index on messages.sender_pk (for sealed-sender conversation queries)
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_sender_pk ON messages(sender_pk)`);
  console.log('[DB] Added index on messages.sender_pk');
} catch (e) {
  // Index already exists
}

// Migration: add fcm_token column to profiles (for push notifications)
try {
  db.exec(`ALTER TABLE profiles ADD COLUMN fcm_token TEXT`);
  console.log('[DB] Migrated profiles: added fcm_token column');
} catch (e) {
  // Column already exists — expected after first run
}

// ── Atomic Swap tables (BTC ↔ XCH) ──
db.exec(`
  CREATE TABLE IF NOT EXISTS swaps (
    id TEXT PRIMARY KEY,
    initiator_chia_address TEXT NOT NULL,
    initiator_btc_pubkey TEXT,
    counterparty_chia_address TEXT,
    counterparty_btc_pubkey TEXT,
    direction TEXT NOT NULL,
    xch_amount_mojos TEXT NOT NULL,
    btc_amount_sats TEXT NOT NULL,
    secret_hash TEXT NOT NULL,
    secret_preimage TEXT,
    chia_htlc_puzzle_hash TEXT,
    chia_htlc_address TEXT,
    chia_htlc_coin_id TEXT,
    chia_clawback_pubkey TEXT,
    chia_sweep_pubkey TEXT,
    chia_timeout_seconds INTEGER NOT NULL DEFAULT 86400,
    btc_htlc_address TEXT,
    btc_htlc_redeem_script TEXT,
    btc_htlc_funding_txid TEXT,
    btc_claim_pubkey TEXT,
    btc_refund_pubkey TEXT,
    btc_timeout_blocks INTEGER NOT NULL DEFAULT 144,
    status TEXT NOT NULL DEFAULT 'created',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_swaps_status ON swaps(status);
  CREATE INDEX IF NOT EXISTS idx_swaps_initiator ON swaps(initiator_chia_address);
  CREATE INDEX IF NOT EXISTS idx_swaps_counterparty ON swaps(counterparty_chia_address);
`);

// Migration: drop vault_recovery_escrow table (server should never hold vault keys)
try {
  db.exec(`DROP TABLE IF EXISTS vault_recovery_escrow`);
} catch (e) {
  // ignore
}

// ── Group Chat (Signal-grade E2E) ──
db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    creator_address TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    member_address TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    display_name TEXT,
    invited_by TEXT,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(group_id, member_address)
  );

  CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
  CREATE INDEX IF NOT EXISTS idx_group_members_address ON group_members(member_address);
`);

// Migration: add group_id column to messages (for group message fan-out)
try {
  db.exec(`ALTER TABLE messages ADD COLUMN group_id TEXT`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id)`);
  console.log('[DB] Migrated messages: added group_id column');
} catch (e) {
  // Column already exists — expected after first run
}

// Migration: add visibility + max_members to groups (public/private rooms)
try {
  db.exec(`ALTER TABLE groups ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'`);
  db.exec(`ALTER TABLE groups ADD COLUMN max_members INTEGER NOT NULL DEFAULT 500`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_groups_visibility ON groups(visibility)`);
  console.log('[DB] Migrated groups: added visibility, max_members columns');
} catch (e) {
  // Columns already exist — expected after first run
}

// Migration: add last_read_at to group_members (unread badge tracking)
try {
  db.exec(`ALTER TABLE group_members ADD COLUMN last_read_at TEXT`);
  console.log('[DB] Migrated group_members: added last_read_at column');
} catch (e) {
  // Column already exists — expected after first run
}

// ── Voice/Video Calls (Agora RTC) ──
db.exec(`
  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    from_address TEXT NOT NULL,
    to_address TEXT,
    call_mode TEXT NOT NULL DEFAULT 'voice',
    call_status TEXT NOT NULL DEFAULT 'initiated',
    channel TEXT NOT NULL UNIQUE,
    caller_display_name TEXT,
    caller_avatar_url TEXT,
    receiver_display_name TEXT,
    receiver_avatar_url TEXT,
    group_id TEXT,
    group_name TEXT,
    group_image TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    accepted_at TEXT,
    ended_at TEXT,
    duration_seconds INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_calls_from ON calls(from_address);
  CREATE INDEX IF NOT EXISTS idx_calls_to ON calls(to_address);
  CREATE INDEX IF NOT EXISTS idx_calls_channel ON calls(channel);
  CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(call_status);
`);


// ── DID + Business Card Tables ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS dids (
    launcher_id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    owner_pubkey TEXT NOT NULL,
    inner_puzzle_hash TEXT,
    coin_id TEXT,
    parent_coin_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_dids_wallet ON dids(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_dids_status ON dids(status);

  CREATE TABLE IF NOT EXISTS business_profiles (
    wallet_address TEXT PRIMARY KEY,
    did_launcher_id TEXT,
    business_name TEXT,
    email TEXT,
    phone TEXT,
    country_code TEXT,
    website TEXT,
    street_address TEXT,
    unit TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    postal_code TEXT,
    logo_cid TEXT,
    category TEXT,
    description TEXT,
    ipfs_cid TEXT,
    metadata_uri TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (did_launcher_id) REFERENCES dids(launcher_id)
  );

  CREATE TABLE IF NOT EXISTS business_cards (
    nft_launcher_id TEXT PRIMARY KEY,
    issuer_did TEXT NOT NULL,
    issuer_address TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    recipient_puzzle_hash TEXT NOT NULL DEFAULT '',
    profile_cid TEXT,
    card_meta_cid TEXT,
    status TEXT DEFAULT 'active',
    issued_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (issuer_did) REFERENCES dids(launcher_id)
  );
  CREATE INDEX IF NOT EXISTS idx_cards_recipient ON business_cards(recipient_address);
  CREATE INDEX IF NOT EXISTS idx_cards_issuer ON business_cards(issuer_did);
  CREATE INDEX IF NOT EXISTS idx_cards_pair ON business_cards(issuer_did, recipient_address);
`);

// ── PayChat (pay-per-message with Chia offer files) ──────────────────

db.exec(`
  -- PayChat offers: signed-but-unbroadcast XCH send bundles
  -- Sender signs → offer stored → recipient responds → offer broadcast on-chain
  CREATE TABLE IF NOT EXISTS paychat_offers (
    id TEXT PRIMARY KEY,
    sender_address TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    amount_mojos INTEGER NOT NULL,
    memo TEXT,
    coin_spends_json TEXT NOT NULL,
    signature_hex TEXT NOT NULL,
    coin_ids TEXT NOT NULL,
    message_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    tx_status TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    accepted_at TEXT,
    expires_at TEXT NOT NULL DEFAULT (datetime('now', '+24 hours'))
  );

  CREATE INDEX IF NOT EXISTS idx_paychat_offers_sender ON paychat_offers(sender_address);
  CREATE INDEX IF NOT EXISTS idx_paychat_offers_recipient ON paychat_offers(recipient_address);
  CREATE INDEX IF NOT EXISTS idx_paychat_offers_status ON paychat_offers(status);
  CREATE INDEX IF NOT EXISTS idx_paychat_offers_message ON paychat_offers(message_id);

  -- PayChat settings: per-user ask price
  CREATE TABLE IF NOT EXISTS paychat_settings (
    chia_address TEXT PRIMARY KEY,
    ask_amount_mojos INTEGER NOT NULL DEFAULT 100000000,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Encrypted File Storage (Signal-style attachments) ─────────────

db.exec(`
  -- Encrypted file blobs: client encrypts before upload, server stores opaque data
  -- Server never sees plaintext. Decryption key sent inside E2E encrypted message.
  CREATE TABLE IF NOT EXISTS encrypted_files (
    id TEXT PRIMARY KEY,
    uploader_address TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    mime_type TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL DEFAULT (datetime('now', '+30 days'))
  );
  CREATE INDEX IF NOT EXISTS idx_files_uploader ON encrypted_files(uploader_address);
  CREATE INDEX IF NOT EXISTS idx_files_expires ON encrypted_files(expires_at);
`);

// SSO user ↔ wallet link (non-custodial — server stores address mapping only)
db.exec(`
  CREATE TABLE IF NOT EXISTS sso_wallet_links (
    sso_user_id TEXT PRIMARY KEY,
    email TEXT,
    chia_address TEXT NOT NULL,
    wallet_pk TEXT NOT NULL,
    launcher_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sso_wallet_links_email ON sso_wallet_links(email);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sso_wallet_links_chia ON sso_wallet_links(chia_address);
`);

module.exports = db;
