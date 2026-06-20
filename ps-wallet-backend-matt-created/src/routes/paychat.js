/**
 * PayChat Routes — Pay-per-message with Chia offer files
 *
 * POST /paychat/set-ask-price       — Set per-message ask price
 * GET  /paychat/ask-price/:address   — Get ask price for an address
 * POST /paychat/prepare-offer        — Prepare unsigned offer (proxy to sidecar)
 * POST /paychat/store-offer          — Store signed offer (not broadcast yet)
 * POST /paychat/accept-offer/:id     — Accept offer (broadcast on-chain)
 * POST /paychat/cancel-offer/:id     — Cancel a pending offer
 * GET  /paychat/offers/sent/:address — List offers sent by address
 * GET  /paychat/offers/received/:address — List offers received by address
 * GET  /paychat/offers/pending/:address  — List pending offers for recipient
 * GET  /paychat/offer/:id            — Get offer details
 * GET  /paychat/offer/message/:messageId — Get offer by message ID
 * POST /paychat/check-valid/:id      — Check if offer is still valid
 * POST /paychat/deactivate           — Deactivate PayChat for address
 */

const express = require('express');
const router = express.Router();
const paychatService = require('../services/paychat-service');

// ── Ask Price ──

// POST /paychat/set-ask-price
router.post('/set-ask-price', (req, res) => {
  try {
    const { chiaAddress, askAmountMojos } = req.body;
    if (!chiaAddress || askAmountMojos === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: chiaAddress, askAmountMojos',
      });
    }

    const result = paychatService.setAskPrice(chiaAddress, parseInt(askAmountMojos));
    res.json({ status: 'success', data: result });
  } catch (e) {
    console.error(`[API] set-ask-price error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /paychat/ask-price/:address
router.get('/ask-price/:address', (req, res) => {
  try {
    const result = paychatService.getAskPriceForAddress(req.params.address);
    res.json({ status: 'success', data: result });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ── Offer Lifecycle ──

// POST /paychat/prepare-offer — proxy to Python sidecar
router.post('/prepare-offer', async (req, res) => {
  try {
    const { senderPubkeyHex, recipientAddress, amountMojos, memo, feeAmount } = req.body;
    if (!senderPubkeyHex || !recipientAddress || !amountMojos) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: senderPubkeyHex, recipientAddress, amountMojos',
      });
    }

    const result = await paychatService.prepareOffer({
      senderPubkeyHex,
      recipientAddress,
      amountMojos: parseInt(amountMojos),
      memo,
      feeAmount: parseInt(feeAmount) || 0,
    });

    res.json({ status: 'success', data: result });
  } catch (e) {
    console.error(`[API] prepare-offer error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /paychat/store-offer — store signed offer (not broadcast yet)
router.post('/store-offer', (req, res) => {
  try {
    const {
      senderAddress, recipientAddress, amountMojos, memo,
      coinSpendsJson, signatureHex, coinIds, messageId,
    } = req.body;

    if (!senderAddress || !recipientAddress || !amountMojos || !coinSpendsJson || !signatureHex || !coinIds) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields',
      });
    }

    const offer = paychatService.storeSignedOffer({
      senderAddress,
      recipientAddress,
      amountMojos: parseInt(amountMojos),
      memo,
      coinSpendsJson,
      signatureHex,
      coinIds,
      messageId,
    });

    res.json({ status: 'success', data: offer });
  } catch (e) {
    console.error(`[API] store-offer error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /paychat/accept-offer/:id — accept (broadcast on-chain)
router.post('/accept-offer/:id', async (req, res) => {
  try {
    const result = await paychatService.acceptOffer(req.params.id);
    res.json({ status: 'success', data: result });
  } catch (e) {
    console.error(`[API] accept-offer error: ${e.message}`);
    res.status(400).json({ status: 'error', message: e.message });
  }
});

// POST /paychat/cancel-offer/:id
router.post('/cancel-offer/:id', (req, res) => {
  try {
    const { requesterAddress } = req.body;
    if (!requesterAddress) {
      return res.status(400).json({ status: 'error', message: 'Missing requesterAddress' });
    }
    const result = paychatService.cancelOffer(req.params.id, requesterAddress);
    res.json({ status: 'success', data: result });
  } catch (e) {
    console.error(`[API] cancel-offer error: ${e.message}`);
    res.status(400).json({ status: 'error', message: e.message });
  }
});

// ── Offer Queries ──

// GET /paychat/offers/sent/:address
router.get('/offers/sent/:address', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offers = paychatService.getOffersBySender(req.params.address, limit);
    res.json({ status: 'success', data: offers, count: offers.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /paychat/offers/received/:address
router.get('/offers/received/:address', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offers = paychatService.getOffersForRecipient(req.params.address, limit);
    res.json({ status: 'success', data: offers, count: offers.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /paychat/offers/pending/:address
router.get('/offers/pending/:address', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offers = paychatService.getPendingForRecipient(req.params.address, limit);
    res.json({ status: 'success', data: offers, count: offers.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /paychat/offer/:id
router.get('/offer/:id', (req, res) => {
  try {
    const offer = paychatService.get(req.params.id);
    if (!offer) {
      return res.status(404).json({ status: 'error', message: 'Offer not found' });
    }
    res.json({ status: 'success', data: offer });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /paychat/offer/message/:messageId
router.get('/offer/message/:messageId', (req, res) => {
  try {
    const offer = paychatService.getByMessageId(req.params.messageId);
    if (!offer) {
      return res.status(404).json({ status: 'error', message: 'Offer not found for message' });
    }
    res.json({ status: 'success', data: offer });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /paychat/check-valid/:id
router.post('/check-valid/:id', async (req, res) => {
  try {
    const valid = await paychatService.checkOfferValid(req.params.id);
    res.json({ status: 'success', data: { valid } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /paychat/deactivate
router.post('/deactivate', (req, res) => {
  try {
    const { chiaAddress } = req.body;
    if (!chiaAddress) {
      return res.status(400).json({ status: 'error', message: 'Missing chiaAddress' });
    }
    const result = paychatService.deactivate(chiaAddress);
    res.json({ status: 'success', data: result });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
