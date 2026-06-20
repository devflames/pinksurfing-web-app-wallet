/**
 * Atomic Swap Routes — BTC ↔ XCH
 *
 * POST /swaps/create          — Create a new swap offer
 * GET  /swaps/open            — List open swap offers
 * GET  /swaps/:id             — Get swap details
 * GET  /swaps/address/:addr   — List swaps for an address
 * POST /swaps/:id/accept      — Accept a swap offer
 * POST /swaps/:id/chia-htlc   — Update Chia HTLC details
 * POST /swaps/:id/reveal      — Record preimage reveal (claim)
 * POST /swaps/:id/complete    — Mark swap as completed
 * POST /swaps/:id/refund      — Mark swap as refunded
 * POST /swaps/:id/cancel      — Cancel an open swap offer
 */

const express = require('express');
const router = express.Router();
const swapService = require('../services/swap-service');
const { requireAuth } = require('../services/auth-middleware');

// POST /swaps/create (requires auth)
router.post('/create', requireAuth, (req, res) => {
  try {
    const {
      initiatorChiaAddress, initiatorBtcPubkey, direction,
      xchAmountMojos, btcAmountSats,
      chiaClawbackPubkey, btcClaimPubkey,
      chiaTimeoutSeconds, btcTimeoutBlocks,
    } = req.body;

    if (!initiatorChiaAddress || !direction || !xchAmountMojos || !btcAmountSats) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: initiatorChiaAddress, direction, xchAmountMojos, btcAmountSats',
      });
    }

    if (!['xch_to_btc', 'btc_to_xch'].includes(direction)) {
      return res.status(400).json({
        status: 'error',
        message: 'direction must be xch_to_btc or btc_to_xch',
      });
    }

    const result = swapService.create({
      initiatorChiaAddress,
      initiatorBtcPubkey,
      direction,
      xchAmountMojos,
      btcAmountSats,
      chiaClawbackPubkey,
      btcClaimPubkey,
      chiaTimeoutSeconds,
      btcTimeoutBlocks,
    });

    // Return swap + secret (secret is ONLY given to initiator, never stored on server)
    res.json({ status: 'success', data: result });
  } catch (e) {
    console.error(`[API] swap create error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /swaps/open?limit=50
router.get('/open', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const swaps = swapService.listOpen(limit);
    res.json({ status: 'success', data: swaps, count: swaps.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /swaps/:id
router.get('/:id', (req, res) => {
  try {
    const swap = swapService.get(req.params.id);
    if (!swap) {
      return res.status(404).json({ status: 'error', message: 'Swap not found' });
    }
    res.json({ status: 'success', data: swap });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /swaps/address/:addr?limit=50
router.get('/address/:addr', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const swaps = swapService.listByAddress(req.params.addr, limit);
    res.json({ status: 'success', data: swaps, count: swaps.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /swaps/:id/accept (requires auth)
router.post('/:id/accept', requireAuth, (req, res) => {
  try {
    const {
      counterpartyChiaAddress, counterpartyBtcPubkey,
      chiaSweepPubkey, btcRefundPubkey,
      btcHtlcAddress, btcHtlcRedeemScript, btcHtlcFundingTxid,
    } = req.body;

    if (!counterpartyChiaAddress) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required field: counterpartyChiaAddress',
      });
    }

    const swap = swapService.accept(req.params.id, {
      counterpartyChiaAddress,
      counterpartyBtcPubkey,
      chiaSweepPubkey,
      btcRefundPubkey,
      btcHtlcAddress,
      btcHtlcRedeemScript,
      btcHtlcFundingTxid,
    });

    res.json({ status: 'success', data: swap });
  } catch (e) {
    console.error(`[API] swap accept error: ${e.message}`);
    res.status(400).json({ status: 'error', message: e.message });
  }
});

// POST /swaps/:id/chia-htlc
router.post('/:id/chia-htlc', (req, res) => {
  try {
    const { puzzleHash, address, coinId } = req.body;
    const swap = swapService.updateChiaHtlcDetails(req.params.id, { puzzleHash, address, coinId });
    res.json({ status: 'success', data: swap });
  } catch (e) {
    res.status(400).json({ status: 'error', message: e.message });
  }
});

// POST /swaps/:id/claim (requires auth)
// SECURITY: No preimage is sent or stored. Server only tracks status.
// Participants discover the preimage by monitoring on-chain transactions.
router.post('/:id/claim', requireAuth, (req, res) => {
  try {
    const swap = swapService.markClaimed(req.params.id);
    res.json({ status: 'success', data: swap });
  } catch (e) {
    console.error(`[API] swap claim error: ${e.message}`);
    res.status(400).json({ status: 'error', message: e.message });
  }
});

// POST /swaps/:id/complete (requires auth)
router.post('/:id/complete', requireAuth, (req, res) => {
  try {
    const swap = swapService.complete(req.params.id);
    res.json({ status: 'success', data: swap });
  } catch (e) {
    res.status(400).json({ status: 'error', message: e.message });
  }
});

// POST /swaps/:id/refund (requires auth)
router.post('/:id/refund', requireAuth, (req, res) => {
  try {
    const swap = swapService.refund(req.params.id);
    res.json({ status: 'success', data: swap });
  } catch (e) {
    res.status(400).json({ status: 'error', message: e.message });
  }
});

// POST /swaps/:id/cancel (requires auth)
router.post('/:id/cancel', requireAuth, (req, res) => {
  try {
    const { requesterAddress } = req.body;
    if (!requesterAddress) {
      return res.status(400).json({ status: 'error', message: 'Missing required field: requesterAddress' });
    }
    const swap = swapService.cancel(req.params.id, requesterAddress);
    res.json({ status: 'success', data: swap });
  } catch (e) {
    console.error(`[API] swap cancel error: ${e.message}`);
    res.status(400).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
