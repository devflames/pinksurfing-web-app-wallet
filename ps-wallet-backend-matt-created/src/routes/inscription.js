/**
 * Chia Inscription Routes
 *
 * POST /wallet/auto-mint-profile — First login: pin avatar+metadata to IPFS, mint NFT
 * POST /wallet/inscribe-profile  — Pin image+metadata to IPFS + mint profile NFT
 * POST /wallet/update-profile    — Pin new version to IPFS + mint new NFT
 * POST /wallet/sync-profile      — Pin metadata to IPFS only (fast, every save)
 * POST /wallet/pin-image         — Pin an image to IPFS, get CID (for profile pics)
 * GET  /wallet/profile/:address  — Fetch latest profile for a Chia address
 * GET  /wallet/history/:address  — Get all inscription history for an address
 * GET  /wallet/inscription/:id   — Get a specific inscription by ID
 * GET  /wallet/chain-status      — Check Chia node + IPFS status
 */

const express = require('express');
const router = express.Router();
const inscriptionService = require('../services/inscription-service');

/** Standard response shape for inscription results */
function inscriptionResponse(result) {
  return {
    status: result.success ? 'success' : 'partial',
    data: {
      inscriptionId: result.inscriptionId || null,
      nftCoinId: result.nftCoinId || null,
      ipfsCid: result.ipfsCid || null,
      imageCid: result.imageCid || null,
      imageUri: result.imageUri || null,
      imageGatewayUrl: result.imageGatewayUrl || null,
      metadataUri: result.metadataUri || null,
      gatewayUrl: result.gatewayUrl || null,
      error: result.error || null,
      note: result.note || null,
    },
  };
}

// POST /wallet/auto-mint-profile — Called on FIRST wallet login
// Generates a default avatar, pins metadata + avatar to IPFS, tries to mint NFT.
// If NFT mint fails (no Chia node), the IPFS data is still live.
// Idempotent: if profile already exists, returns existing data.
router.post('/auto-mint-profile', async (req, res) => {
  try {
    const { walletPk, chiaAddress, profileData } = req.body;

    if (!walletPk || !chiaAddress) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: walletPk, chiaAddress',
      });
    }

    // Check if profile already exists — don't re-mint
    const existing = inscriptionService.getProfile(chiaAddress);
    if (existing && existing.ipfsCid) {
      console.log(`[API] auto-mint — profile already exists for ${chiaAddress}`);
      return res.json({
        status: 'success',
        data: {
          inscriptionId: existing.inscriptionId,
          nftCoinId: existing.nftCoinId,
          ipfsCid: existing.ipfsCid,
          metadataUri: existing.metadataUri,
          gatewayUrl: existing.gatewayUrl,
          alreadyExists: true,
        },
      });
    }

    console.log(`[API] POST /wallet/auto-mint-profile — address=${chiaAddress}`);

    // Build initial profile data
    const initialProfile = {
      ...(profileData || {}),
      _createdAt: new Date().toISOString(),
      _type: 'pinksurfing-profile',
    };

    // inscribeProfile will auto-generate a default avatar if no image provided
    const result = await inscriptionService.inscribeProfile({
      walletPk,
      chiaAddress,
      profileData: initialProfile,
      // No imageBuffer/imageCid → generates default gradient avatar
    });

    res.json(inscriptionResponse(result));
  } catch (e) {
    console.error(`[API] auto-mint-profile error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /wallet/pin-image — Pin an image to IPFS, return CID
// Accepts base64 image in body. Use before inscribe/update if pre-pinning.
router.post('/pin-image', async (req, res) => {
  try {
    const { imageBase64, filename, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required field: imageBase64',
      });
    }

    console.log(`[API] POST /wallet/pin-image — ${filename || 'image'} (${mimeType || 'auto'})`);
    const result = await inscriptionService.pinImage({
      imageBase64,
      filename: filename || 'avatar.png',
      mimeType: mimeType || 'image/png',
    });

    res.json({
      status: 'success',
      data: {
        cid: result.cid,
        uri: result.uri,
        gatewayUrl: result.gatewayUrl,
        hash: result.hash,
        size: result.size,
        provider: result.provider,
      },
    });
  } catch (e) {
    console.error(`[API] pin-image error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /wallet/inscribe-profile
router.post('/inscribe-profile', async (req, res) => {
  try {
    const { walletPk, chiaAddress, profileData, imageBase64, imageCid } = req.body;

    if (!walletPk || !chiaAddress || !profileData) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: walletPk, chiaAddress, profileData',
      });
    }

    console.log(`[API] POST /wallet/inscribe-profile — address=${chiaAddress}`);
    const imageBuffer = imageBase64 ? Buffer.from(imageBase64, 'base64') : undefined;

    const result = await inscriptionService.inscribeProfile({
      walletPk,
      chiaAddress,
      profileData,
      imageBuffer,
      imageCid,
    });

    res.json(inscriptionResponse(result));
  } catch (e) {
    console.error(`[API] inscribe-profile error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /wallet/update-profile
router.post('/update-profile', async (req, res) => {
  try {
    const { walletPk, chiaAddress, profileData, existingNftCoinId, imageBase64, imageCid } = req.body;

    if (!walletPk || !chiaAddress || !profileData) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: walletPk, chiaAddress, profileData',
      });
    }

    console.log(`[API] POST /wallet/update-profile — address=${chiaAddress}`);
    const imageBuffer = imageBase64 ? Buffer.from(imageBase64, 'base64') : undefined;

    const result = await inscriptionService.updateProfile({
      walletPk,
      chiaAddress,
      profileData: {
        ...profileData,
        _previousNft: existingNftCoinId || null,
        _updatedAt: new Date().toISOString(),
      },
      imageBuffer,
      imageCid,
    });

    res.json(inscriptionResponse(result));
  } catch (e) {
    console.error(`[API] update-profile error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /wallet/sync-profile — Pin to IPFS only (fast, no NFT mint)
router.post('/sync-profile', async (req, res) => {
  try {
    const { walletPk, chiaAddress, profileData } = req.body;

    if (!walletPk || !chiaAddress || !profileData) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: walletPk, chiaAddress, profileData',
      });
    }

    console.log(`[API] POST /wallet/sync-profile — address=${chiaAddress}`);
    const result = await inscriptionService.syncToIpfs({
      walletPk,
      chiaAddress,
      profileData,
    });

    res.json({
      status: result.success ? 'success' : 'error',
      data: result,
    });
  } catch (e) {
    console.error(`[API] sync-profile error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /wallet/profile/:address
router.get('/profile/:address', (req, res) => {
  try {
    const { address } = req.params;
    console.log(`[API] GET /wallet/profile/${address}`);

    const profile = inscriptionService.getProfile(address);
    if (profile) {
      res.json({
        status: 'success',
        data: {
          profileData: profile.profileData,
          ipfsCid: profile.ipfsCid,
          metadataUri: profile.metadataUri,
          gatewayUrl: profile.gatewayUrl,
          nftCoinId: profile.nftCoinId,
          status: profile.status,
          updatedAt: profile.updatedAt,
        },
      });
    } else {
      res.json({ status: 'success', data: null, message: 'No profile found' });
    }
  } catch (e) {
    console.error(`[API] profile error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /wallet/history/:address
router.get('/history/:address', (req, res) => {
  try {
    const { address } = req.params;
    const history = inscriptionService.getHistory(address);
    res.json({ status: 'success', data: history });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /wallet/inscription/:id
router.get('/inscription/:id', (req, res) => {
  try {
    const inscription = inscriptionService.getInscription(req.params.id);
    if (inscription) {
      res.json({ status: 'success', data: inscription });
    } else {
      res.status(404).json({ status: 'error', message: 'Inscription not found' });
    }
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /wallet/chain-status
router.get('/chain-status', async (req, res) => {
  try {
    const status = await inscriptionService.getChainStatus();
    res.json({ status: 'success', data: status });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
