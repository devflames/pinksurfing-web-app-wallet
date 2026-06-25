/**
 * Google OAuth2 Routes (Desktop proxy)
 *
 * GET  /auth/google           — Start OAuth flow (redirects to Google)
 * GET  /auth/google/callback  — Handle Google redirect with auth code
 * GET  /auth/google/token/:id — Flutter app retrieves tokens by session ID
 * POST /auth/google/refresh   — Refresh an expired access token
 * GET  /auth/google/status    — Check if OAuth is configured
 */

const express = require('express');
const router = express.Router();
const googleOAuth = require('../services/google-oauth');

// GET /auth/google — Start OAuth flow
router.get('/google', (req, res) => {
  const result = googleOAuth.getAuthUrl();
  if (!result) {
    return res.status(500).json({
      status: 'error',
      message: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env',
    });
  }

  console.log(`[API] GET /auth/google — redirecting, sessionId=${result.sessionId}`);

  // If Flutter app sent ?json=true, return URL instead of redirecting
  if (req.query.json === 'true') {
    return res.json({
      status: 'success',
      data: { url: result.url, sessionId: result.sessionId },
    });
  }

  res.redirect(result.url);
});

// GET /auth/google/callback — Google redirects here
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state: sessionId } = req.query;

    if (!code || !sessionId) {
      return res.status(400).send('Missing code or state parameter');
    }

    console.log(`[API] GET /auth/google/callback — sessionId=${sessionId}`);
    const result = await googleOAuth.handleCallback(code, sessionId);

    // Show success page — wallet Drive backup (not app login)
    const appOrigin = process.env.APP_ORIGIN || process.env.CORS_ORIGINS?.split(',')[0]?.trim() || 'https://app.pinksurfing.com';
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>PinkSurfing - Drive backup</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body {
            background: #0D0D12;
            color: #E6E6EA;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 16px;
          }
          .card {
            text-align: center;
            padding: 32px 24px;
            background: #1A1A24;
            border-radius: 16px;
            max-width: 400px;
          }
          .check { font-size: 48px; margin-bottom: 16px; }
          h2 { margin: 0 0 8px; font-size: 20px; }
          p { color: #A4A4AD; font-size: 14px; margin: 0 0 12px; line-height: 1.45; }
          .email { color: #6EE7FF; font-weight: 600; }
          .note { font-size: 12px; color: #6B4C80; margin-top: 16px; }
          a.btn {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 24px;
            background: #FF7AD1;
            color: #0D0D12;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="check">✓</div>
          <h2>Google Drive Connected</h2>
          <p>Wallet backup only — this is <strong>not</strong> PinkSurfing app sign-in.</p>
          <p>Signed in as <span class="email">${result.email || 'unknown'}</span></p>
          <a class="btn" href="${appOrigin}">Return to PinkSurfing</a>
          <p class="note">If you meant to log in, use &quot;Continue with Google&quot; on the sign-in screen.</p>
        </div>
        <script>
          try { if (window.opener) { window.opener.postMessage({ type: 'ps-drive-oauth-done' }, '*'); window.close(); } } catch (e) {}
        </script>
      </body>
      </html>
    `);
  } catch (e) {
    console.error(`[API] OAuth callback error: ${e.message}`);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title>
      <style>body{background:#0D0D12;color:#FF6B6B;font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;}</style>
      </head>
      <body><div style="text-align:center"><h2>Connection Failed</h2><p>${e.message}</p></div></body>
      </html>
    `);
  }
});

// GET /auth/google/token/:id — Flutter app retrieves tokens
router.get('/google/token/:id', (req, res) => {
  const session = googleOAuth.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({
      status: 'error',
      message: 'Session not found. OAuth flow may not be complete yet.',
    });
  }

  res.json({
    status: 'success',
    data: {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      email: session.email,
    },
  });
});

// POST /auth/google/refresh — Refresh access token
router.post('/google/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ status: 'error', message: 'Missing refreshToken' });
    }

    const result = await googleOAuth.refreshToken(refreshToken);
    res.json({ status: 'success', data: result });
  } catch (e) {
    console.error(`[API] Token refresh error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /auth/google/status — Check OAuth config
router.get('/google/status', (req, res) => {
  const configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  res.json({
    status: 'success',
    data: {
      configured,
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'not set',
    },
  });
});

module.exports = router;
