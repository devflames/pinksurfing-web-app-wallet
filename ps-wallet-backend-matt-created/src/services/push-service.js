/**
 * Push Notification Service
 *
 * Sends FCM push notifications when wallet chat messages arrive.
 * Uses FCM HTTP v1 API with a Google service account.
 *
 * Setup:
 * 1. Go to Firebase Console → Project Settings → Service accounts
 * 2. Click "Generate new private key" → download JSON
 * 3. Place it at /opt/ps-wallet-backend/firebase-service-account.json
 *    (or set GOOGLE_APPLICATION_CREDENTIALS env var)
 *
 * If no service account is configured, push notifications are silently skipped.
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID || 'pinksurfing-488701';
const SA_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.join(__dirname, '..', '..', 'firebase-service-account.json');

let _accessToken = null;
let _tokenExpiry = 0;
let _serviceAccount = null;
let _initialized = false;

function init() {
  try {
    if (fs.existsSync(SA_PATH)) {
      _serviceAccount = JSON.parse(fs.readFileSync(SA_PATH, 'utf-8'));
      _initialized = true;
      console.log(`[Push] ✓ FCM service account loaded from ${SA_PATH}`);
    } else {
      console.log(`[Push] ⚠ No service account at ${SA_PATH} — push notifications disabled`);
      console.log(`[Push]   To enable: place Firebase service account JSON at ${SA_PATH}`);
    }
  } catch (e) {
    console.error(`[Push] Failed to load service account: ${e.message}`);
  }
}

/**
 * Create a JWT and exchange it for an OAuth2 access token.
 * Uses native Node.js crypto — no extra dependencies needed.
 */
async function getAccessToken() {
  if (!_serviceAccount) return null;
  if (_accessToken && Date.now() < _tokenExpiry - 60000) return _accessToken;

  const crypto = require('crypto');
  const now = Math.floor(Date.now() / 1000);

  // JWT header
  const header = Buffer.from(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT',
  })).toString('base64url');

  // JWT claims
  const claims = Buffer.from(JSON.stringify({
    iss: _serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  // Sign with RSA private key
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(_serviceAccount.private_key, 'base64url');

  const jwt = `${header}.${claims}.${signature}`;

  // Exchange JWT for access token
  return new Promise((resolve) => {
    const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.access_token) {
            _accessToken = data.access_token;
            _tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
            resolve(_accessToken);
          } else {
            console.error('[Push] OAuth2 token error:', data);
            resolve(null);
          }
        } catch (e) {
          console.error('[Push] OAuth2 parse error:', e.message);
          resolve(null);
        }
      });
    });
    req.on('error', (e) => {
      console.error('[Push] OAuth2 request error:', e.message);
      resolve(null);
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Send a push notification to a device via FCM HTTP v1 API.
 *
 * @param {string} fcmToken - Recipient's FCM device token
 * @param {string} title - Notification title
 * @param {string} body - Notification body text
 * @param {object} data - Optional data payload (key-value string pairs)
 */
async function sendPush(fcmToken, title, body, data = {}) {
  if (!_initialized || !fcmToken) return false;

  const token = await getAccessToken();
  if (!token) return false;

  const message = {
    message: {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        type: 'wallet_chat',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          channel_id: 'wallet_chat',
          sound: 'default',
        },
      },
    },
  };

  return new Promise((resolve) => {
    const postData = JSON.stringify(message);
    const req = https.request({
      hostname: 'fcm.googleapis.com',
      path: `/v1/projects/${FCM_PROJECT_ID}/messages:send`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          console.error(`[Push] FCM error (${res.statusCode}):`, body);
          resolve(false);
        }
      });
    });
    req.on('error', (e) => {
      console.error('[Push] FCM request error:', e.message);
      resolve(false);
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Send a chat message push notification.
 * Looks up the recipient's FCM token and sends a push.
 *
 * @param {string} recipientAddress - Chia address of the recipient
 * @param {string} senderDisplayName - Display name of the sender
 */
async function notifyNewMessage(recipientAddress, senderDisplayName) {
  if (!_initialized) return;

  const profileResolver = require('./profile-resolver');
  const fcmToken = profileResolver.getFcmToken(recipientAddress);
  if (!fcmToken) {
    return;
  }

  const title = senderDisplayName || 'New Message';
  const body = 'You have a new encrypted message';

  const ok = await sendPush(fcmToken, title, body, {
    sender_display_name: senderDisplayName || '',
    recipient_address: recipientAddress,
  });

  if (ok) {
    console.log(`[Push] ✓ Notified ${recipientAddress.substring(0, 16)}…`);
  }
}

// Initialize on load
init();

module.exports = { sendPush, notifyNewMessage, init };
