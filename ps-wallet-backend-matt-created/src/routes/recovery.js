/**
 * Recovery Routes — Split-Key MFA-Gated Backup Recovery
 *
 * POST /recovery/setup-totp      — Generate TOTP secret + QR URI
 * POST /recovery/confirm-totp    — Verify first code to activate TOTP
 * POST /recovery/store-share     — Store server key share (called during backup creation)
 * POST /recovery/verify          — Verify MFA + release server key share
 * GET  /recovery/methods/:lid    — List active MFA methods for launcher
 * GET  /recovery/status/:lid     — Check if MFA + key share are configured
 * DELETE /recovery/method/:id    — Remove MFA method (requires MFA proof)
 */

const express = require('express');
const router = express.Router();
const recovery = require('../services/recovery-service');
const { requireAuth } = require('../services/auth-middleware');

// ── POST /recovery/setup-totp ──

router.post('/setup-totp', requireAuth, (req, res) => {
  try {
    const { launcherId, label } = req.body;

    if (!launcherId) {
      return res.status(400).json({ success: false, message: 'launcherId is required' });
    }

    console.log(`[API] POST /recovery/setup-totp — ${launcherId.substring(0, 16)}...`);
    const result = recovery.setupTotp(launcherId, label || 'PinkSurfing Vault');

    if (!result.success) {
      return res.status(409).json(result);
    }

    res.json(result);
  } catch (e) {
    console.error(`[API] setup-totp error: ${e.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /recovery/confirm-totp ──

router.post('/confirm-totp', requireAuth, (req, res) => {
  try {
    const { launcherId, code } = req.body;

    if (!launcherId || !code) {
      return res.status(400).json({ success: false, message: 'launcherId and code are required' });
    }

    if (typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({ success: false, message: 'Code must be 6 digits' });
    }

    console.log(`[API] POST /recovery/confirm-totp — ${launcherId.substring(0, 16)}...`);
    const result = recovery.confirmTotp(launcherId, code);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (e) {
    console.error(`[API] confirm-totp error: ${e.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /recovery/store-share ──
// Called by the client during backup creation to deposit the server key share.

router.post('/store-share', requireAuth, (req, res) => {
  try {
    const { launcherId, keyShareHex, backupVersion } = req.body;

    if (!launcherId || !keyShareHex) {
      return res.status(400).json({ success: false, message: 'launcherId and keyShareHex are required' });
    }

    if (keyShareHex.length !== 64) {
      return res.status(400).json({ success: false, message: 'keyShareHex must be 64 hex chars (32 bytes)' });
    }

    // Verify MFA is set up before accepting key shares
    if (!recovery.hasMfa(launcherId)) {
      return res.status(403).json({
        success: false,
        message: 'Set up MFA before creating a backup. Your backup must be protected.',
      });
    }

    const shareBytes = Buffer.from(keyShareHex, 'hex');
    recovery.storeKeyShare(launcherId, shareBytes, backupVersion || 1);

    console.log(`[API] POST /recovery/store-share — ${launcherId.substring(0, 16)}... v${backupVersion || 1}`);

    res.json({ success: true, message: 'Server key share stored.' });
  } catch (e) {
    console.error(`[API] store-share error: ${e.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /recovery/verify ──
// MFA verification → releases server key share for decryption.

router.post('/verify', (req, res) => {
  try {
    const { launcherId, methodType, proof } = req.body;

    if (!launcherId || !methodType || !proof) {
      return res.status(400).json({
        success: false,
        message: 'launcherId, methodType, and proof are required',
      });
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    console.log(`[API] POST /recovery/verify — ${launcherId.substring(0, 16)}... via ${methodType}`);
    const result = recovery.verifyAndRelease(launcherId, methodType, proof, ipAddress);

    if (!result.success) {
      return res.status(401).json({ success: false, message: result.message });
    }

    // Key share returned ONLY on successful MFA
    res.json({
      success: true,
      keyShareHex: result.keyShareHex,
      message: result.message,
    });
  } catch (e) {
    console.error(`[API] recovery/verify error: ${e.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /recovery/methods/:launcherId ──

router.get('/methods/:launcherId', (req, res) => {
  try {
    const { launcherId } = req.params;
    const methods = recovery.listMethods(launcherId);

    res.json({
      success: true,
      methods: methods.map(m => ({
        id: m.id,
        type: m.method_type,
        label: m.label,
        createdAt: m.created_at,
      })),
    });
  } catch (e) {
    console.error(`[API] methods error: ${e.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /recovery/status/:launcherId ──

router.get('/status/:launcherId', (req, res) => {
  try {
    const { launcherId } = req.params;

    const hasMfa = recovery.hasMfa(launcherId);
    const hasShare = recovery.hasKeyShare(launcherId);
    const methods = recovery.listMethods(launcherId);

    res.json({
      success: true,
      mfaConfigured: hasMfa,
      keyShareStored: hasShare,
      methodTypes: methods.map(m => m.method_type),
      ready: hasMfa && hasShare,
    });
  } catch (e) {
    console.error(`[API] status error: ${e.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── DELETE /recovery/method/:id ──
// Removing MFA requires proving you still have access (anti-lockout).

router.delete('/method/:id', requireAuth, (req, res) => {
  try {
    const methodId = parseInt(req.params.id, 10);
    const { launcherId, methodType, proof } = req.body;

    if (!launcherId || !methodType || !proof) {
      return res.status(400).json({
        success: false,
        message: 'Must verify MFA to remove a method. Provide launcherId, methodType, proof.',
      });
    }

    // Verify MFA before allowing removal
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const verifyResult = recovery.verifyAndRelease(launcherId, methodType, proof, ipAddress);
    if (!verifyResult.success) {
      return res.status(401).json({ success: false, message: 'MFA verification failed.' });
    }

    recovery.removeMethod(methodId);

    console.log(`[API] DELETE /recovery/method/${methodId} — removed`);
    res.json({ success: true, message: 'MFA method removed.' });
  } catch (e) {
    console.error(`[API] delete method error: ${e.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
