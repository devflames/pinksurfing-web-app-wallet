/**
 * DID + Business Card Routes
 * 
 * Endpoints for DID creation, business card NFT registry,
 * and business profile management.
 */

const express = require('express');
const router = express.Router();
const didService = require('../services/did-service');

// ── DID Creation (2-Step Signing) ───────────────────────────────────

/**
 * POST /did/prepare-create
 * Prepare an unsigned DID creation spend bundle.
 * Client must sign with SYNTHETIC BLS key and submit.
 */
router.post('/prepare-create', async (req, res) => {
  try {
    const { ownerPubkeyHex, feeAmount, walletAddress } = req.body;

    if (!ownerPubkeyHex) {
      return res.status(400).json({
        success: false,
        message: 'ownerPubkeyHex is required',
      });
    }

    const result = await didService.prepareCreateDid({
      ownerPubkeyHex,
      feeAmount: feeAmount || 0,
      walletAddress: walletAddress || '',
    });

    res.json(result);
  } catch (e) {
    console.error('[DID] prepare-create error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * POST /did/submit
 * Submit a client-signed DID creation spend bundle.
 */
router.post('/submit', async (req, res) => {
  try {
    const { coinSpendsJson, signatureHex, launcherId } = req.body;

    if (!coinSpendsJson || !signatureHex) {
      return res.status(400).json({
        success: false,
        message: 'coinSpendsJson and signatureHex are required',
      });
    }

    const result = await didService.submitDidSigned({
      coinSpendsJson,
      signatureHex,
      launcherId,
    });

    res.json(result);
  } catch (e) {
    console.error('[DID] submit error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /did/status/:launcherId
 * Get DID status (checks DB, falls back to chain).
 */
router.get('/status/:launcherId', async (req, res) => {
  try {
    const result = await didService.getDidStatus(req.params.launcherId);
    res.json(result);
  } catch (e) {
    console.error('[DID] status error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /did/lookup/:walletAddress
 * Look up DID by wallet address (DB lookup).
 */
router.get('/lookup/:walletAddress', (req, res) => {
  const did = didService.lookupDidByAddress(req.params.walletAddress);
  if (did) {
    res.json({ success: true, ...did });
  } else {
    res.json({ success: false, message: 'No DID found for this address' });
  }
});

// ── Business Card Registry ──────────────────────────────────────────

/**
 * POST /did/cards/prepare-mint
 * Prepare an unsigned business card NFT mint (2-step signing).
 * Pins metadata to IPFS, builds unsigned spend via Python sidecar.
 * Client signs with BLS synthetic key and calls /did/submit.
 */
router.post('/cards/prepare-mint', async (req, res) => {
  try {
    const {
      ownerPubkeyHex, issuerDid, issuerAddress, recipientAddress,
      businessName, profileCid, imageCid, feeAmount,
    } = req.body;

    if (!ownerPubkeyHex || !issuerDid || !issuerAddress || !recipientAddress) {
      return res.status(400).json({
        success: false,
        message: 'ownerPubkeyHex, issuerDid, issuerAddress, and recipientAddress are required',
      });
    }

    const result = await didService.prepareMintBusinessCard({
      ownerPubkeyHex,
      issuerDid,
      issuerAddress,
      recipientAddress,
      businessName,
      profileCid,
      imageCid,
      feeAmount: feeAmount || 0,
    });

    res.json({ success: true, ...result });
  } catch (e) {
    console.error('[DID] prepare-mint card error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * POST /did/cards/register
 * Register a business card NFT after minting.
 */
router.post('/cards/register', (req, res) => {
  try {
    const {
      nftLauncherId, issuerDid, issuerAddress,
      recipientAddress, recipientPuzzleHash,
      profileCid, cardMetaCid,
    } = req.body;

    if (!nftLauncherId || !issuerDid || !issuerAddress || !recipientAddress) {
      return res.status(400).json({
        success: false,
        message: 'nftLauncherId, issuerDid, issuerAddress, and recipientAddress are required',
      });
    }

    const result = didService.registerBusinessCard({
      nftLauncherId,
      issuerDid,
      issuerAddress,
      recipientAddress,
      recipientPuzzleHash: recipientPuzzleHash || '',
      profileCid,
      cardMetaCid,
    });

    res.json(result);
  } catch (e) {
    console.error('[DID] register card error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /did/cards/verify?holder=<address>&issuer=<didId>
 * Check if a user holds a business card from a specific issuer.
 */
router.get('/cards/verify', (req, res) => {
  const { holder, issuer } = req.query;

  if (!holder || !issuer) {
    return res.status(400).json({
      success: false,
      message: 'holder and issuer query params are required',
    });
  }

  const result = didService.verifyBusinessCard(holder, issuer);
  res.json({ success: true, ...result });
});

/**
 * GET /did/cards/holder/:address
 * List all business cards held by an address.
 */
router.get('/cards/holder/:address', (req, res) => {
  const cards = didService.getCardsForHolder(req.params.address);
  res.json({ success: true, cards });
});

/**
 * GET /did/cards/issuer/:didId
 * List all business cards issued by a DID.
 */
router.get('/cards/issuer/:didId', (req, res) => {
  const cards = didService.getCardsIssuedBy(req.params.didId);
  res.json({ success: true, cards });
});

/**
 * POST /did/cards/revoke
 * Revoke a business card.
 */
router.post('/cards/revoke', (req, res) => {
  try {
    const { nftLauncherId, issuerDid } = req.body;

    if (!nftLauncherId || !issuerDid) {
      return res.status(400).json({
        success: false,
        message: 'nftLauncherId and issuerDid are required',
      });
    }

    const result = didService.revokeBusinessCard(nftLauncherId, issuerDid);
    res.json(result);
  } catch (e) {
    console.error('[DID] revoke card error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Business Profile ────────────────────────────────────────────────

/**
 * POST /did/profile
 * Save or update a business profile.
 */
router.post('/profile', (req, res) => {
  try {
    const result = didService.saveBusinessProfile(req.body);
    res.json(result);
  } catch (e) {
    console.error('[DID] save profile error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /did/profile/:walletAddress
 * Get a business profile by wallet address.
 */
router.get('/profile/:walletAddress', (req, res) => {
  const profile = didService.getBusinessProfile(req.params.walletAddress);
  if (profile) {
    res.json({ success: true, profile });
  } else {
    res.json({ success: false, message: 'No business profile found' });
  }
});

module.exports = router;
