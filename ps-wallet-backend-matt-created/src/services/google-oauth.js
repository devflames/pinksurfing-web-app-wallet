/**
 * Google OAuth2 Proxy Service
 *
 * Provides OAuth2 flow for desktop platforms where google_sign_in
 * doesn't have native support (Linux, etc.).
 *
 * Flow:
 * 1. Flutter app opens browser to /auth/google → redirects to Google consent
 * 2. User grants Drive appdata scope
 * 3. Google redirects back to /auth/google/callback with auth code
 * 4. Server exchanges code for access + refresh tokens
 * 5. Flutter app retrieves tokens via /auth/google/token/:sessionId
 * 6. Flutter app uses tokens directly with Google Drive API
 */

const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.email',
];

const insertSession = db.prepare(`
  INSERT INTO oauth_sessions (id, provider, access_token, refresh_token, expires_at, email)
  VALUES (?, 'google', ?, ?, ?, ?)
`);

const getSession = db.prepare(`
  SELECT * FROM oauth_sessions WHERE id = ?
`);

class GoogleOAuthService {
  constructor() {
    this._client = null;
  }

  get client() {
    if (!this._client) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI;

      if (!clientId || !clientSecret) {
        console.warn('[GoogleOAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
        return null;
      }

      this._client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    }
    return this._client;
  }

  /**
   * Generate the Google OAuth consent URL.
   * Returns { url, sessionId } — sessionId is used to retrieve tokens later.
   */
  getAuthUrl() {
    if (!this.client) return null;

    const sessionId = uuidv4();
    const url = this.client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: sessionId,
      prompt: 'consent',
    });

    return { url, sessionId };
  }

  /**
   * Exchange the auth code from Google callback for tokens.
   */
  async handleCallback(code, sessionId) {
    if (!this.client) throw new Error('OAuth not configured');

    const { tokens } = await this.client.getToken(code);
    this.client.setCredentials(tokens);

    // Get user email
    let email = null;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.client });
      const userInfo = await oauth2.userinfo.get();
      email = userInfo.data.email;
    } catch (e) {
      console.warn(`[GoogleOAuth] Could not get user email: ${e.message}`);
    }

    // Store session
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
    insertSession.run(sessionId, tokens.access_token, tokens.refresh_token || null, expiresAt, email);

    console.log(`[GoogleOAuth] ✓ Token exchange complete — session=${sessionId}, email=${email}`);

    return {
      sessionId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      email,
    };
  }

  /**
   * Get stored tokens for a session.
   */
  getSession(sessionId) {
    const row = getSession.get(sessionId);
    if (!row) return null;
    return {
      sessionId: row.id,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at,
      email: row.email,
    };
  }

  /**
   * Refresh an expired access token.
   */
  async refreshToken(refreshToken) {
    if (!this.client) throw new Error('OAuth not configured');

    this.client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.client.refreshAccessToken();

    return {
      accessToken: credentials.access_token,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
    };
  }
}

module.exports = new GoogleOAuthService();
