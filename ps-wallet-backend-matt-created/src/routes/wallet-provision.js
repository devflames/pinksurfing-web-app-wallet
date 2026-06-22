/**
 * SSO ↔ wallet provisioning (Jilani sequence diagram — Phase 3).
 *
 * GET  /wallet/status — Bearer SSO JWT → { provisioned, chiaAddress?, launcherId? }
 * POST /wallet/link   — Link SSO user to Chia address + wallet public key
 */

const express = require('express');
const router = express.Router();
const { requireSsoJwt } = require('../services/sso-jwt');
const {
  getLinkBySsoUserId,
  getLinkByChiaAddress,
  upsertLink,
  resolveLauncherId,
} = require('../services/sso-wallet-link');

router.get('/status', requireSsoJwt, (req, res) => {
  const link = getLinkBySsoUserId(req.sso.ssoUserId);
  if (!link) {
    return res.json({
      status: 'success',
      provisioned: false,
    });
  }

  const launcherId =
    link.launcher_id || resolveLauncherId(link.chia_address, null);

  return res.json({
    status: 'success',
    provisioned: true,
    chiaAddress: link.chia_address,
    walletPk: link.wallet_pk,
    launcherId: launcherId || null,
    email: link.email || req.sso.email || null,
    linkedAt: link.updated_at || link.created_at,
  });
});

router.post('/link', requireSsoJwt, (req, res) => {
  const { chiaAddress, walletPk, launcherId } = req.body || {};

  if (!chiaAddress || !String(chiaAddress).trim()) {
    return res.status(400).json({
      status: 'error',
      message: 'chiaAddress is required',
    });
  }
  if (!walletPk || !String(walletPk).trim()) {
    return res.status(400).json({
      status: 'error',
      message: 'walletPk is required',
    });
  }

  const normalizedAddress = String(chiaAddress).trim();
  const existingForAddress = getLinkByChiaAddress(normalizedAddress);
  if (
    existingForAddress &&
    existingForAddress.sso_user_id !== req.sso.ssoUserId
  ) {
    return res.status(409).json({
      status: 'error',
      message: 'This wallet address is already linked to another account',
    });
  }

  const link = upsertLink({
    ssoUserId: req.sso.ssoUserId,
    email: req.sso.email,
    chiaAddress: normalizedAddress,
    walletPk: String(walletPk).trim(),
    launcherId: launcherId ? String(launcherId).trim() : null,
  });

  const resolvedLauncherId =
    link.launcher_id || resolveLauncherId(link.chia_address, null);

  return res.json({
    status: 'success',
    provisioned: true,
    chiaAddress: link.chia_address,
    walletPk: link.wallet_pk,
    launcherId: resolvedLauncherId || null,
    email: link.email || req.sso.email || null,
  });
});

module.exports = router;
