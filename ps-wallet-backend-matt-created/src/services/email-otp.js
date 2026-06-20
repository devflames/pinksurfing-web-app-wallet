/**
 * Email OTP Service — Pure Authentication Relay
 *
 * Coinbase-style email one-time-passcode authentication.
 * This server NEVER stores wallet keys, seeds, or encrypted blobs.
 * It only proves identity via email OTP.
 *
 * Key storage stays with the user:
 *   1. Device-local (encrypted SharedPreferences)
 *   2. User's own Google Drive (encrypted backup)
 *   3. Seed phrase (offline, written down)
 *
 * - 6-digit OTP sent via email (configurable SMTP or console fallback)
 * - OTPs expire after 10 minutes
 * - Sessions last 30 days
 * - Rate limited: max 5 OTPs per email per hour
 *
 * Environment:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *   (if not set, OTP is logged to console for development)
 */

const crypto = require('crypto');
const db = require('./db');

// ── DB tables ──

db.exec(`
  CREATE TABLE IF NOT EXISTS email_otps (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);
  CREATE INDEX IF NOT EXISTS idx_email_otps_expires ON email_otps(expires_at);

  CREATE TABLE IF NOT EXISTS email_sessions (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_email_sessions_email ON email_sessions(email);
`);

// ── Prepared statements ──

const stmts = {
  insertOtp: db.prepare(
    `INSERT INTO email_otps (id, email, otp_hash, expires_at) VALUES (?, ?, ?, ?)`
  ),
  countRecentOtps: db.prepare(
    `SELECT COUNT(*) as cnt FROM email_otps WHERE email = ? AND created_at > datetime('now', '-1 hour')`
  ),
  getOtp: db.prepare(
    `SELECT * FROM email_otps WHERE email = ? AND verified = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1`
  ),
  markVerified: db.prepare(
    `UPDATE email_otps SET verified = 1 WHERE id = ?`
  ),
  incrementAttempts: db.prepare(
    `UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?`
  ),
  insertSession: db.prepare(
    `INSERT INTO email_sessions (id, email, expires_at) VALUES (?, ?, ?)`
  ),
  getSession: db.prepare(
    `SELECT * FROM email_sessions WHERE id = ? AND expires_at > datetime('now')`
  ),
  deleteSession: db.prepare(
    `DELETE FROM email_sessions WHERE id = ?`
  ),
  // Cleanup expired OTPs (called periodically)
  cleanupOtps: db.prepare(
    `DELETE FROM email_otps WHERE expires_at < datetime('now')`
  ),
  cleanupSessions: db.prepare(
    `DELETE FROM email_sessions WHERE expires_at < datetime('now')`
  ),
};

// ── OTP generation & hashing ──

function generateOtp() {
  // Cryptographically secure 6-digit OTP
  const num = crypto.randomInt(100000, 999999);
  return num.toString();
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateSessionId() {
  return crypto.randomUUID();
}

// ── Email sending ──

const https = require('https');

/**
 * Send email via SendGrid HTTP API (v3).
 * Uses SENDGRID_API_KEY env var. Falls back to SMTP if not set.
 * HTTP API avoids outbound SMTP port blocks common on VPS providers.
 */
async function sendViaSendGrid(to, subject, textContent, htmlContent, from) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return null; // not configured

  const payload = JSON.stringify({
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from.replace(/<|>/g, '').split(' ').pop(), name: from.replace(/<.*/, '').trim() || 'PinkSurfing' },
    subject,
    content: [
      { type: 'text/plain', value: textContent },
      { type: 'text/html', value: htmlContent },
    ],
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.sendgrid.com',
      path: '/v3/mail/send',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          reject(new Error(`SendGrid ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

let _transporter = null;

async function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  try {
    const nodemailer = require('nodemailer');
    _transporter = nodemailer.createTransport({
      host,
      port: parseInt(port || '587', 10),
      secure: port === '465',
      auth: { user, pass },
    });
    console.log(`[EmailOTP] SMTP configured: ${host}:${port}`);
    return _transporter;
  } catch (e) {
    console.log(`[EmailOTP] nodemailer not available: ${e.message}`);
    return null;
  }
}

async function sendOtpEmail(email, otp) {
  const from = process.env.SMTP_FROM || 'PinkSurfing <noreply@pinksurfing.com>';
  const subject = `${otp} is your PinkSurfing verification code`;
  const text = `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.\n\n— PinkSurfing`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
      <div style="background: #0B0B10; border-radius: 16px; padding: 32px; text-align: center;">
        <h2 style="color: #E6E6EA; margin: 0 0 8px;">Verification Code</h2>
        <p style="color: #A4A4AD; margin: 0 0 24px; font-size: 14px;">Enter this code to sign in to PinkSurfing</p>
        <div style="background: #1A1A24; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
          <span style="color: #6EE7FF; font-size: 36px; font-weight: 700; letter-spacing: 8px;">${otp}</span>
        </div>
        <p style="color: #6A6A78; font-size: 12px; margin: 0;">This code expires in 10 minutes</p>
      </div>
    </div>
  `;

  // 1. Try SendGrid HTTP API (works even when SMTP ports are blocked)
  try {
    const sent = await sendViaSendGrid(email, subject, text, html, from);
    if (sent) {
      console.log(`[EmailOTP] Sent OTP to ${email} via SendGrid API`);
      return true;
    }
  } catch (e) {
    console.error(`[EmailOTP] SendGrid API failed: ${e.message}`);
  }

  // 2. Fallback to SMTP (if configured and ports are open)
  const transporter = await getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({ from, to: email, subject, text, html });
      console.log(`[EmailOTP] Sent OTP to ${email} via SMTP`);
      return true;
    } catch (e) {
      console.error(`[EmailOTP] SMTP failed: ${e.message}`);
    }
  }

  // 3. Development fallback: log to console
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  OTP for ${email}`);
  console.log(`║  Code: ${otp}`);
  console.log(`║  Expires in 10 minutes`);
  console.log(`╚══════════════════════════════════════╝\n`);
  return true;
}

// ── Public API ──

/**
 * Send a new OTP to the given email address.
 * Returns { success, message, otpId? }
 */
async function sendOtp(email) {
  email = email.toLowerCase().trim();

  // Rate limit: max 5 per hour per email
  const { cnt } = stmts.countRecentOtps.get(email);
  if (cnt >= 5) {
    return { success: false, message: 'Too many codes requested. Try again in an hour.' };
  }

  const otp = generateOtp();
  const otpId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  stmts.insertOtp.run(otpId, email, hashOtp(otp), expiresAt);

  const sent = await sendOtpEmail(email, otp);
  if (!sent) {
    return { success: false, message: 'Failed to send verification code.' };
  }

  return { success: true, message: 'Verification code sent.', otpId };
}

/**
 * Verify an OTP for the given email.
 * Returns { success, message, sessionToken?, email? }
 */
function verifyOtp(email, otp) {
  email = email.toLowerCase().trim();

  const row = stmts.getOtp.get(email);
  if (!row) {
    return { success: false, message: 'No active verification code. Request a new one.' };
  }

  // Max 5 attempts per OTP
  if (row.attempts >= 5) {
    return { success: false, message: 'Too many attempts. Request a new code.' };
  }

  stmts.incrementAttempts.run(row.id);

  if (hashOtp(otp) !== row.otp_hash) {
    return { success: false, message: 'Incorrect code. Please try again.' };
  }

  // Mark OTP as verified
  stmts.markVerified.run(row.id);

  // Create session (30 day expiry, matching Coinbase)
  const sessionId = generateSessionId();
  const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  stmts.insertSession.run(sessionId, email, sessionExpiry);

  return {
    success: true,
    message: 'Verified.',
    sessionToken: sessionId,
    email,
  };
}

/**
 * Validate a session token. Returns { valid, email? }
 */
function validateSession(sessionToken) {
  if (!sessionToken) return { valid: false };
  const row = stmts.getSession.get(sessionToken);
  if (!row) return { valid: false };
  return { valid: true, email: row.email };
}

/**
 * Invalidate a session.
 */
function destroySession(sessionToken) {
  stmts.deleteSession.run(sessionToken);
}

// Periodic cleanup (every 15 minutes)
setInterval(() => {
  const otps = stmts.cleanupOtps.run();
  const sessions = stmts.cleanupSessions.run();
  if (otps.changes > 0 || sessions.changes > 0) {
    console.log(`[EmailOTP] Cleanup: ${otps.changes} expired OTPs, ${sessions.changes} expired sessions`);
  }
}, 15 * 60 * 1000);

module.exports = {
  sendOtp,
  verifyOtp,
  validateSession,
  destroySession,
};
