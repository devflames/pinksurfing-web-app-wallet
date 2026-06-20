/**
 * Profile Resolver Routes
 *
 * POST /profiles/register        — Register/update a wallet profile
 * GET  /profiles/resolve/:address — Resolve profile by Chia address
 * GET  /profiles/pk/:publicKey    — Resolve profile by public key
 * GET  /profiles/search?q=...     — Search profiles by name/address
 * GET  /profiles/directory         — List all registered profiles
 */

const express = require('express');
const router = express.Router();
const profileResolver = require('../services/profile-resolver');
const { requireSelfSignedAuth } = require('../services/auth-middleware');

// POST /profiles/register (requires self-signed Ed25519 auth)
router.post('/register', requireSelfSignedAuth, (req, res) => {
  try {
    const { chiaAddress, walletPk, displayName, username, bio, avatarUrl, profileData, fcmToken } = req.body;

    if (!chiaAddress || !walletPk) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: chiaAddress, walletPk',
      });
    }

    console.log(`[API] POST /profiles/register — ${chiaAddress} (${displayName || 'unnamed'}, @${username || 'none'})`);
    const profile = profileResolver.register({
      chiaAddress,
      walletPk,
      displayName,
      username,
      bio,
      avatarUrl,
      profileData,
      fcmToken,
    });

    res.json({ status: 'success', data: profile });
  } catch (e) {
    console.error(`[API] register error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /profiles/resolve/:address
router.get('/resolve/:address', async (req, res) => {
  try {
    const { address } = req.params;
    console.log(`[API] GET /profiles/resolve/${address}`);

    const profile = await profileResolver.resolve(address);
    if (profile) {
      res.json({ status: 'success', data: profile });
    } else {
      res.json({ status: 'success', data: null, message: 'Profile not found' });
    }
  } catch (e) {
    console.error(`[API] resolve error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /profiles/pk/:publicKey
router.get('/pk/:publicKey', (req, res) => {
  try {
    const { publicKey } = req.params;
    const profile = profileResolver.getByPublicKey(publicKey);
    if (profile) {
      res.json({ status: 'success', data: profile });
    } else {
      res.json({ status: 'success', data: null, message: 'Profile not found' });
    }
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /profiles/check-username/:username?address=xch1...
router.get('/check-username/:username', (req, res) => {
  try {
    const { username } = req.params;
    const requestingAddress = req.query.address || null;
    console.log(`[API] GET /profiles/check-username/${username} (requester=${requestingAddress || 'anon'})`);
    const result = profileResolver.checkUsername(username, requestingAddress);
    res.json({ status: 'success', data: result });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /profiles/username/:username
router.get('/username/:username', (req, res) => {
  try {
    const { username } = req.params;
    const profile = profileResolver.getByUsername(username);
    if (profile) {
      res.json({ status: 'success', data: profile });
    } else {
      res.json({ status: 'success', data: null, message: 'Profile not found' });
    }
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /profiles/messaging-pk/:pk — Resolve profile by messaging (X25519) public key
router.get('/messaging-pk/:pk', (req, res) => {
  try {
    const { pk } = req.params;
    const profile = profileResolver.getByMessagingPk(pk);
    if (profile) {
      res.json({ status: 'success', data: profile });
    } else {
      res.json({ status: 'success', data: null, message: 'Profile not found' });
    }
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /profiles/search?q=...&limit=20
router.get('/search', (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    if (!query || query.length < 2) {
      return res.status(400).json({
        status: 'error',
        message: 'Search query must be at least 2 characters',
      });
    }

    const results = profileResolver.search(query, limit);
    res.json({ status: 'success', data: results, count: results.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /profiles/directory?limit=50
router.get('/directory', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const profiles = profileResolver.list(limit);
    res.json({ status: 'success', data: profiles, count: profiles.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
