/**
 * Call Routes
 *
 * Voice/video call management for wallet-based users.
 * Uses Agora RTC for media transport and FCM for call signaling.
 *
 * GET  /calls/token/:channel/:uid        — Generate Agora RTC token
 * POST /calls/initiate                    — Initiate a call
 * POST /calls/accept                      — Accept a call
 * POST /calls/reject                      — Reject a call
 * POST /calls/end                         — End a call
 * GET  /calls/status/:address             — Get active call for address
 * GET  /calls/channel/:channel            — Get call by channel name
 * GET  /calls/history/:address            — Get call history for address
 */

const express = require('express');
const router = express.Router();
const callService = require('../services/call-service');

// GET /calls/token/:channel/:uid?role=publisher&expiry=3600
router.get('/token/:channel/:uid', (req, res) => {
  try {
    const { channel, uid } = req.params;
    const role = req.query.role || 'publisher';
    const expiry = parseInt(req.query.expiry, 10) || 3600;

    if (!channel) return res.status(400).json({ status: 'error', message: 'channel is required' });
    if (!uid) return res.status(400).json({ status: 'error', message: 'uid is required' });

    const result = callService.generateToken(channel, uid, role, expiry);
    res.json({ status: 'success', data: result });
  } catch (e) {
    console.error(`[Calls] Token error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /calls/initiate
// Body: { fromAddress, toAddress, callMode ('voice'|'video'), callerDisplayName, callerAvatarUrl, groupId?, groupName? }
router.post('/initiate', (req, res) => {
  try {
    const { fromAddress, toAddress, callMode, callerDisplayName, callerAvatarUrl, groupId, groupName } = req.body;

    if (!fromAddress) return res.status(400).json({ status: 'error', message: 'fromAddress is required' });
    if (!toAddress && !groupId) return res.status(400).json({ status: 'error', message: 'toAddress or groupId is required' });

    const result = callService.initiateCall({
      fromAddress,
      toAddress,
      callMode,
      callerDisplayName,
      callerAvatarUrl,
      groupId,
      groupName,
    });

    if (result.error) {
      return res.status(409).json({ status: 'fail', message: result.error });
    }

    // Generate token for the caller
    const tokenResult = callService.generateToken(result.call.channel, 0);

    res.json({
      status: 'success',
      data: {
        ...result.call,
        rtcToken: tokenResult.token,
        appId: tokenResult.appId,
      },
    });
  } catch (e) {
    console.error(`[Calls] Initiate error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /calls/accept
// Body: { channel, accepterAddress }
router.post('/accept', (req, res) => {
  try {
    const { channel, accepterAddress } = req.body;
    if (!channel) return res.status(400).json({ status: 'error', message: 'channel is required' });

    const result = callService.acceptCall(channel, accepterAddress || '');
    if (result.error) {
      return res.status(409).json({ status: 'fail', message: result.error });
    }

    // Generate token for the accepter
    const tokenResult = callService.generateToken(channel, 1);

    res.json({
      status: 'success',
      data: {
        ...result.call,
        rtcToken: tokenResult.token,
        appId: tokenResult.appId,
      },
    });
  } catch (e) {
    console.error(`[Calls] Accept error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /calls/reject
// Body: { channel, rejectorAddress }
router.post('/reject', (req, res) => {
  try {
    const { channel, rejectorAddress } = req.body;
    if (!channel) return res.status(400).json({ status: 'error', message: 'channel is required' });

    const result = callService.rejectCall(channel, rejectorAddress || '');
    if (result.error) {
      return res.status(409).json({ status: 'fail', message: result.error });
    }

    res.json({ status: 'success', data: result.call });
  } catch (e) {
    console.error(`[Calls] Reject error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /calls/end
// Body: { channel, enderAddress }
router.post('/end', (req, res) => {
  try {
    const { channel, enderAddress } = req.body;
    if (!channel) return res.status(400).json({ status: 'error', message: 'channel is required' });

    const result = callService.endCall(channel, enderAddress || '');
    if (result.error) {
      return res.status(409).json({ status: 'fail', message: result.error });
    }

    res.json({ status: 'success', data: result.call });
  } catch (e) {
    console.error(`[Calls] End error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /calls/status/:address — active call for this wallet address
router.get('/status/:address', (req, res) => {
  try {
    const call = callService.getActiveCall(req.params.address);
    res.json({
      status: 'success',
      data: call,
      hasActiveCall: !!call,
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /calls/channel/:channel — get call details by channel
router.get('/channel/:channel', (req, res) => {
  try {
    const call = callService.getByChannel(req.params.channel);
    if (!call) return res.status(404).json({ status: 'error', message: 'Call not found' });
    res.json({ status: 'success', data: call });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /calls/history/:address?limit=50
router.get('/history/:address', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const calls = callService.getHistory(req.params.address, limit);
    res.json({ status: 'success', data: calls, count: calls.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
