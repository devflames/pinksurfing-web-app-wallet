/**
 * Email OTP Auth Routes — Pure Authentication Relay
 *
 * This server NEVER stores wallet keys or encrypted blobs.
 * Keys stay on the user's device + their own Google Drive.
 *
 * POST /auth/email/send-otp   — Send 6-digit OTP to email
 * POST /auth/email/verify-otp — Verify OTP, get session token
 * POST /auth/email/logout     — Destroy session
 */

const express = require('express');
const router = express.Router();
const emailOtp = require('../services/email-otp');

// ── Middleware: require valid session ──

function requireSession(req, res, next) {
  const token = req.headers['x-session-token'];
  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Missing session token' });
  }

  const { valid, email } = emailOtp.validateSession(token);
  if (!valid) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired session' });
  }

  req.sessionEmail = email;
  next();
}

// ── POST /auth/email/send-otp ──

router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Email is required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ status: 'error', message: 'Invalid email address' });
    }

    console.log(`[API] POST /auth/email/send-otp — ${email}`);
    const result = await emailOtp.sendOtp(email);

    if (!result.success) {
      return res.status(429).json({ status: 'error', message: result.message });
    }

    res.json({
      status: 'success',
      message: result.message,
    });
  } catch (e) {
    console.error(`[API] send-otp error: ${e.message}`);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── POST /auth/email/verify-otp ──

router.post('/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ status: 'error', message: 'Email and OTP are required' });
    }

    if (typeof otp !== 'string' || otp.length !== 6) {
      return res.status(400).json({ status: 'error', message: 'OTP must be 6 digits' });
    }

    console.log(`[API] POST /auth/email/verify-otp — ${email}`);
    const result = emailOtp.verifyOtp(email, otp);

    if (!result.success) {
      return res.status(401).json({ status: 'error', message: result.message });
    }

    res.json({
      status: 'success',
      data: {
        sessionToken: result.sessionToken,
        email: result.email,
      },
    });
  } catch (e) {
    console.error(`[API] verify-otp error: ${e.message}`);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── POST /auth/email/logout ──

router.post('/logout', requireSession, (req, res) => {
  const token = req.headers['x-session-token'];
  emailOtp.destroySession(token);
  res.json({ status: 'success', message: 'Logged out.' });
});

module.exports = router;
