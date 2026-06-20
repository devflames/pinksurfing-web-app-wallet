/**
 * Ed25519 Signature Authentication Middleware
 *
 * Verifies that API callers control the private key for their claimed identity.
 * Uses the Ed25519 signing keys already registered in each user's profile.
 *
 * Auth headers:
 *   X-Auth-Address:   Chia address (or messaging PK) of the caller
 *   X-Auth-Timestamp: Unix epoch milliseconds
 *   X-Auth-Signature: Base64-encoded Ed25519 signature over "<timestamp>:<method>:<path>"
 *
 * For profile registration (self-signed):
 *   The signingPk is taken from the request body (profileData.signingPk)
 *   and the signature covers the registration payload hash.
 */

const crypto = require('crypto');
const db = require('./db');

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

// Prepared statement to look up signing key by address
const getSigningPkByAddress = db.prepare(
  `SELECT profile_data FROM profiles WHERE chia_address = ?`
);

// Also look up by messaging PK (sealed-sender mode)
const getSigningPkByMessagingPk = db.prepare(
  `SELECT profile_data FROM profiles WHERE messaging_pk = ?`
);

/**
 * Extract the Ed25519 signing public key for an address from the DB.
 * Returns hex string or null.
 */
function lookupSigningPk(address) {
  // Try by chia address first
  let row = getSigningPkByAddress.get(address);
  if (!row && address.length === 64) {
    // Might be a messaging PK (hex, 32 bytes = 64 chars)
    row = getSigningPkByMessagingPk.get(address);
  }
  if (!row || !row.profile_data) return null;

  try {
    const pd = JSON.parse(row.profile_data);
    return pd.signingPk || null;
  } catch {
    return null;
  }
}

/**
 * Verify an Ed25519 signature using Node.js native crypto.
 *
 * @param {string} signingPkHex  - 32-byte Ed25519 public key (hex)
 * @param {Buffer} message       - The signed message bytes
 * @param {Buffer} signature     - 64-byte Ed25519 signature
 * @returns {boolean}
 */
function verifyEd25519(signingPkHex, message, signature) {
  try {
    const pkBytes = Buffer.from(signingPkHex, 'hex');
    // Node.js requires DER-encoded public key for Ed25519
    // Ed25519 DER prefix: 302a300506032b6570032100 (12 bytes) + 32 bytes key
    const derPrefix = Buffer.from('302a300506032b6570032100', 'hex');
    const derKey = Buffer.concat([derPrefix, pkBytes]);
    const publicKey = crypto.createPublicKey({
      key: derKey,
      format: 'der',
      type: 'spki',
    });
    return crypto.verify(null, message, publicKey, signature);
  } catch (e) {
    console.error(`[Auth] Ed25519 verify error: ${e.message}`);
    return false;
  }
}

/**
 * Express middleware: require Ed25519 signature authentication.
 *
 * Looks up the caller's signingPk from the profile DB, then verifies
 * the signature over "<timestamp>:<METHOD>:<path>".
 *
 * On success, sets:
 *   req.verifiedAddress  - The authenticated Chia address
 *   req.verifiedSigningPk - The signing public key (hex)
 */
function requireAuth(req, res, next) {
  const address = req.headers['x-auth-address'];
  const timestampStr = req.headers['x-auth-timestamp'];
  const signatureB64 = req.headers['x-auth-signature'];
  const nonce = req.headers['x-auth-nonce'] || '';

  if (!address || !timestampStr || !signatureB64) {
    return res.status(401).json({
      status: 'error',
      message: 'Missing auth headers: X-Auth-Address, X-Auth-Timestamp, X-Auth-Signature',
    });
  }

  // 1. Check timestamp freshness
  const timestamp = parseInt(timestampStr, 10);
  const now = Date.now();
  if (isNaN(timestamp) || Math.abs(now - timestamp) > MAX_TIMESTAMP_DRIFT_MS) {
    return res.status(401).json({
      status: 'error',
      message: 'Auth timestamp expired or invalid (must be within 5 minutes)',
    });
  }

  // 2. Look up signing key
  const signingPk = lookupSigningPk(address);
  if (!signingPk) {
    return res.status(401).json({
      status: 'error',
      message: 'No signing key found for this address. Register your profile first.',
    });
  }

  // 3. Verify signature over "<timestamp>:<nonce>:<METHOD>:<path>"
  //    Supports both nonce (new) and non-nonce (legacy) formats.
  const messageWithNonce = Buffer.from(`${timestampStr}:${nonce}:${req.method}:${req.path}`);
  const messageLegacy = Buffer.from(`${timestampStr}:${req.method}:${req.path}`);
  const signature = Buffer.from(signatureB64, 'base64');

  const valid = verifyEd25519(signingPk, messageWithNonce, signature)
    || verifyEd25519(signingPk, messageLegacy, signature);

  if (!valid) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid signature',
    });
  }

  // 4. Attach verified identity
  req.verifiedAddress = address;
  req.verifiedSigningPk = signingPk;
  next();
}

/**
 * Express middleware: verify self-signed profile registration.
 *
 * For the registration endpoint, the signingPk comes from the request body
 * (since the profile doesn't exist yet). The signature covers
 * sha256(chiaAddress + signingPk + timestamp).
 *
 * On success, sets req.verifiedAddress.
 */
function requireSelfSignedAuth(req, res, next) {
  const timestampStr = req.headers['x-auth-timestamp'];
  const signatureB64 = req.headers['x-auth-signature'];

  if (!timestampStr || !signatureB64) {
    return res.status(401).json({
      status: 'error',
      message: 'Missing auth headers: X-Auth-Timestamp, X-Auth-Signature',
    });
  }

  // 1. Check timestamp freshness
  const timestamp = parseInt(timestampStr, 10);
  const now = Date.now();
  if (isNaN(timestamp) || Math.abs(now - timestamp) > MAX_TIMESTAMP_DRIFT_MS) {
    return res.status(401).json({
      status: 'error',
      message: 'Auth timestamp expired or invalid',
    });
  }

  // 2. Extract signingPk from request body
  const signingPk = req.body?.profileData?.signingPk;
  const chiaAddress = req.body?.chiaAddress;
  if (!signingPk || !chiaAddress) {
    return res.status(400).json({
      status: 'error',
      message: 'Registration must include chiaAddress and profileData.signingPk',
    });
  }

  // 3. Verify signature over sha256(chiaAddress + signingPk + timestamp + nonce)
  //    Supports both nonce (new) and non-nonce (legacy) formats.
  const nonce = req.headers['x-auth-nonce'] || '';
  const payloadWithNonce = `${chiaAddress}:${signingPk}:${timestampStr}:${nonce}`;
  const payloadLegacy = `${chiaAddress}:${signingPk}:${timestampStr}`;
  const messageWithNonce = crypto.createHash('sha256').update(payloadWithNonce).digest();
  const messageLegacy = crypto.createHash('sha256').update(payloadLegacy).digest();
  const signature = Buffer.from(signatureB64, 'base64');

  const valid = verifyEd25519(signingPk, messageWithNonce, signature)
    || verifyEd25519(signingPk, messageLegacy, signature);

  if (!valid) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid registration signature. Prove you control this signing key.',
    });
  }

  req.verifiedAddress = chiaAddress;
  req.verifiedSigningPk = signingPk;
  next();
}

module.exports = {
  requireAuth,
  requireSelfSignedAuth,
  verifyEd25519,
  lookupSigningPk,
};
