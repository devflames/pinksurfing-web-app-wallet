/**
 * Recovery Service — Split-Key MFA-Gated Backup Recovery
 *
 * Neither the user NOR the server can decrypt alone:
 *   - User holds: password-derived key share
 *   - Server holds: random key share (this service), released only after MFA
 *
 * MFA methods (Phase 1): TOTP (Google Authenticator, 2FAS, Authy)
 * Future: Passkeys (WebAuthn/FIDO2), backup recovery codes
 *
 * Server key shares are encrypted at rest with SERVER_ENCRYPTION_KEY env var.
 * If that key is lost, all server shares are unrecoverable (by design).
 */

const crypto = require('crypto');
const { TOTP, Secret } = require('otpauth');
const db = require('./db');

// ── Server-side encryption key (encrypts key shares + TOTP secrets at rest) ──

const SERVER_KEY_HEX =
  process.env.SERVER_ENCRYPTION_KEY || process.env.RECOVERY_MASTER_KEY;
let SERVER_KEY = null;
let RECOVERY_DISABLED = false;

if (!SERVER_KEY_HEX) {
  const generated = crypto.randomBytes(32).toString('hex');
  console.warn('[Recovery] ⚠ SERVER_ENCRYPTION_KEY is not set — recovery endpoints disabled.');
  console.warn(`[Recovery]   Add this to your .env file:`);
  console.warn(`[Recovery]   SERVER_ENCRYPTION_KEY=${generated}`);
  console.warn(`[Recovery]   ⚠ Save this key permanently — if lost, all server key shares are unrecoverable.`);
  RECOVERY_DISABLED = true;
} else {
  SERVER_KEY = Buffer.from(SERVER_KEY_HEX, 'hex');
  if (SERVER_KEY.length !== 32) {
    console.warn('[Recovery] ⚠ SERVER_ENCRYPTION_KEY must be 64 hex chars (32 bytes) — recovery endpoints disabled.');
    RECOVERY_DISABLED = true;
    SERVER_KEY = null;
  }
}

// ── Prepared statements ──

const stmts = {
  // Key shares
  upsertShare: db.prepare(`
    INSERT INTO key_shares (launcher_id, share_enc, share_nonce, share_tag, backup_version)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(launcher_id) DO UPDATE SET
      share_enc = excluded.share_enc,
      share_nonce = excluded.share_nonce,
      share_tag = excluded.share_tag,
      backup_version = excluded.backup_version,
      updated_at = datetime('now')
  `),
  getShare: db.prepare(
    `SELECT * FROM key_shares WHERE launcher_id = ?`
  ),
  deleteShare: db.prepare(
    `DELETE FROM key_shares WHERE launcher_id = ?`
  ),

  // MFA methods
  insertMethod: db.prepare(`
    INSERT INTO mfa_methods (launcher_id, method_type, secret_enc, label)
    VALUES (?, ?, ?, ?)
  `),
  getMethods: db.prepare(
    `SELECT id, launcher_id, method_type, label, is_active, created_at
     FROM mfa_methods WHERE launcher_id = ? AND is_active = 1`
  ),
  getMethodById: db.prepare(
    `SELECT * FROM mfa_methods WHERE id = ? AND is_active = 1`
  ),
  getMethodByType: db.prepare(
    `SELECT * FROM mfa_methods WHERE launcher_id = ? AND method_type = ? AND is_active = 1 LIMIT 1`
  ),
  deactivateMethod: db.prepare(
    `UPDATE mfa_methods SET is_active = 0 WHERE id = ?`
  ),

  // Recovery attempts (audit + rate limit)
  insertAttempt: db.prepare(
    `INSERT INTO recovery_attempts (launcher_id, method_type, success, ip_address) VALUES (?, ?, ?, ?)`
  ),
  countRecentAttempts: db.prepare(
    `SELECT COUNT(*) as cnt FROM recovery_attempts
     WHERE launcher_id = ? AND created_at > datetime('now', '-24 hours')`
  ),
  countRecentFails: db.prepare(
    `SELECT COUNT(*) as cnt FROM recovery_attempts
     WHERE launcher_id = ? AND success = 0 AND created_at > datetime('now', '-15 minutes')`
  ),
};

// ── Encryption helpers (AES-256-GCM, server master key) ──

function encryptWithServerKey(plaintext) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', SERVER_KEY, nonce);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: enc.toString('hex'),
    nonce: nonce.toString('hex'),
    tag: tag.toString('hex'),
  };
}

function decryptWithServerKey(encHex, nonceHex, tagHex) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    SERVER_KEY,
    Buffer.from(nonceHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]);
}

// ── Key Share Management ──

/**
 * Store a server key share for a launcher.
 * The share is encrypted at rest with the server master key.
 *
 * @param {string} launcherId
 * @param {Buffer} shareBytes - 32-byte random key share
 * @param {number} backupVersion
 */
function storeKeyShare(launcherId, shareBytes, backupVersion = 1) {
  if (RECOVERY_DISABLED) throw new Error('Recovery service disabled — SERVER_ENCRYPTION_KEY not configured');
  const { enc, nonce, tag } = encryptWithServerKey(shareBytes);
  stmts.upsertShare.run(launcherId, enc, nonce, tag, backupVersion);
  console.log(`[Recovery] Stored key share for ${launcherId.substring(0, 16)}...`);
}

/**
 * Retrieve and decrypt the server key share for a launcher.
 * MUST only be called after MFA verification.
 *
 * @param {string} launcherId
 * @returns {Buffer|null} 32-byte key share or null
 */
function getKeyShare(launcherId) {
  if (RECOVERY_DISABLED) return null;
  const row = stmts.getShare.get(launcherId);
  if (!row) return null;
  return decryptWithServerKey(row.share_enc, row.share_nonce, row.share_tag);
}

/**
 * Generate a new random server key share (32 bytes).
 * @returns {Buffer}
 */
function generateKeyShare() {
  return crypto.randomBytes(32);
}

// ── TOTP Management ──

/**
 * Set up TOTP for a launcher. Returns the TOTP URI for QR code generation.
 * The TOTP secret is stored encrypted at rest.
 *
 * @param {string} launcherId
 * @param {string} label - User-friendly name (e.g. "Google Authenticator")
 * @returns {{ success: boolean, totpUri?: string, message: string }}
 */
function setupTotp(launcherId, label = 'PinkSurfing Vault') {
  if (RECOVERY_DISABLED) return { success: false, message: 'Recovery service disabled — SERVER_ENCRYPTION_KEY not configured' };
  // Check if TOTP already exists
  const existing = stmts.getMethodByType.get(launcherId, 'totp');
  if (existing) {
    return { success: false, message: 'TOTP already configured. Remove it first to reconfigure.' };
  }

  // Generate TOTP secret
  const secret = new Secret({ size: 20 }); // 160-bit, RFC 4226 standard

  const totp = new TOTP({
    issuer: 'PinkSurfing',
    label: label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });

  const totpUri = totp.toString();

  // Encrypt secret at rest
  const secretBytes = Buffer.from(secret.bytes);
  const { enc, nonce, tag } = encryptWithServerKey(secretBytes);
  const secretEnc = JSON.stringify({ enc, nonce, tag });

  // Store (but not yet active — needs confirmation)
  stmts.insertMethod.run(launcherId, 'totp_pending', secretEnc, label);

  console.log(`[Recovery] TOTP setup initiated for ${launcherId.substring(0, 16)}...`);

  return {
    success: true,
    totpUri,
    secret: secret.base32, // For manual entry (shown alongside QR)
    message: 'Scan QR code with your authenticator app, then confirm with a code.',
  };
}

/**
 * Confirm TOTP setup by verifying the first code.
 * Changes method_type from 'totp_pending' to 'totp'.
 *
 * @param {string} launcherId
 * @param {string} code - 6-digit TOTP code
 * @returns {{ success: boolean, message: string }}
 */
function confirmTotp(launcherId, code) {
  const pending = stmts.getMethodByType.get(launcherId, 'totp_pending');
  if (!pending) {
    return { success: false, message: 'No pending TOTP setup found. Start setup first.' };
  }

  // Decrypt secret
  const { enc, nonce, tag } = JSON.parse(pending.secret_enc);
  const secretBytes = decryptWithServerKey(enc, nonce, tag);

  const totp = new TOTP({
    issuer: 'PinkSurfing',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromRaw(secretBytes),
  });

  // Verify the code (window=1 allows ±30s drift)
  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) {
    return { success: false, message: 'Invalid code. Make sure your authenticator time is synced.' };
  }

  // Activate: change type from totp_pending → totp
  db.prepare(`UPDATE mfa_methods SET method_type = 'totp' WHERE id = ?`).run(pending.id);

  console.log(`[Recovery] TOTP confirmed for ${launcherId.substring(0, 16)}...`);

  return { success: true, message: 'TOTP enabled. Your vault backup is now protected with 2FA.' };
}

/**
 * Verify a TOTP code for recovery.
 *
 * @param {string} launcherId
 * @param {string} code - 6-digit TOTP code
 * @returns {boolean}
 */
function verifyTotp(launcherId, code) {
  const method = stmts.getMethodByType.get(launcherId, 'totp');
  if (!method) return false;

  const { enc, nonce, tag } = JSON.parse(method.secret_enc);
  const secretBytes = decryptWithServerKey(enc, nonce, tag);

  const totp = new TOTP({
    issuer: 'PinkSurfing',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromRaw(secretBytes),
  });

  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

// ── Rate Limiting ──

/**
 * Check if recovery attempts are rate-limited for a launcher.
 * @param {string} launcherId
 * @returns {{ allowed: boolean, message?: string }}
 */
function checkRateLimit(launcherId) {
  // Max 3 failed attempts in 15 minutes → lockout
  const { cnt: recentFails } = stmts.countRecentFails.get(launcherId);
  if (recentFails >= 3) {
    return { allowed: false, message: 'Too many failed attempts. Try again in 15 minutes.' };
  }

  // Max 10 total attempts in 24 hours
  const { cnt: dailyAttempts } = stmts.countRecentAttempts.get(launcherId);
  if (dailyAttempts >= 10) {
    return { allowed: false, message: 'Daily recovery limit reached. Try again tomorrow.' };
  }

  return { allowed: true };
}

/**
 * Log a recovery attempt.
 */
function logAttempt(launcherId, methodType, success, ipAddress) {
  stmts.insertAttempt.run(launcherId, methodType, success ? 1 : 0, ipAddress || null);
}

// ── Recovery Flow (orchestrator) ──

/**
 * Full recovery verification: check rate limit → verify MFA → release key share.
 *
 * @param {string} launcherId
 * @param {string} methodType - 'totp' (future: 'passkey', 'recovery_code')
 * @param {string} proof - The MFA proof (TOTP code, passkey signature, etc.)
 * @param {string} ipAddress - Client IP for rate limiting
 * @returns {{ success: boolean, keyShareHex?: string, message: string }}
 */
function verifyAndRelease(launcherId, methodType, proof, ipAddress) {
  // 1. Rate limit check
  const rateCheck = checkRateLimit(launcherId);
  if (!rateCheck.allowed) {
    return { success: false, message: rateCheck.message };
  }

  // 2. Verify MFA
  let verified = false;
  switch (methodType) {
    case 'totp':
      verified = verifyTotp(launcherId, proof);
      break;
    // Future: case 'passkey': ...
    // Future: case 'recovery_code': ...
    default:
      return { success: false, message: `Unknown MFA method: ${methodType}` };
  }

  // 3. Log attempt
  logAttempt(launcherId, methodType, verified, ipAddress);

  if (!verified) {
    return { success: false, message: 'Verification failed. Check your code and try again.' };
  }

  // 4. Release key share
  const shareBuffer = getKeyShare(launcherId);
  if (!shareBuffer) {
    return { success: false, message: 'No key share found for this vault.' };
  }

  console.log(`[Recovery] Key share released for ${launcherId.substring(0, 16)}... via ${methodType}`);

  return {
    success: true,
    keyShareHex: shareBuffer.toString('hex'),
    message: 'Verification successful. Key share released.',
  };
}

// ── Query helpers ──

/**
 * List active MFA methods for a launcher (without secrets).
 */
function listMethods(launcherId) {
  return stmts.getMethods.all(launcherId);
}

/**
 * Check if a launcher has any active MFA method.
 */
function hasMfa(launcherId) {
  const methods = stmts.getMethods.all(launcherId);
  return methods.length > 0;
}

/**
 * Check if a launcher has a stored key share.
 */
function hasKeyShare(launcherId) {
  const row = stmts.getShare.get(launcherId);
  return !!row;
}

/**
 * Remove an MFA method by ID (requires MFA verification first — enforced in route).
 */
function removeMethod(methodId) {
  stmts.deactivateMethod.run(methodId);
}

// ── Cleanup ──

// Clean up pending TOTP setups older than 10 minutes
setInterval(() => {
  const result = db.prepare(
    `DELETE FROM mfa_methods WHERE method_type = 'totp_pending' AND created_at < datetime('now', '-10 minutes')`
  ).run();
  if (result.changes > 0) {
    console.log(`[Recovery] Cleaned up ${result.changes} expired TOTP setups`);
  }
}, 5 * 60 * 1000);

module.exports = {
  RECOVERY_DISABLED,

  // Key shares
  generateKeyShare,
  storeKeyShare,
  hasKeyShare,

  // TOTP
  setupTotp,
  confirmTotp,

  // Recovery
  verifyAndRelease,
  checkRateLimit,

  // Query
  listMethods,
  hasMfa,
  removeMethod,
};
