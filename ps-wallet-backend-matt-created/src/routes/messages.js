/**
 * Message Relay Routes
 *
 * The server is a "dumb relay" — it stores and forwards encrypted blobs.
 * It NEVER sees plaintext message content.
 *
 * POST /messages/send              — Send an encrypted message
 * GET  /messages/receive/:address  — Fetch & mark undelivered messages
 * GET  /messages/peek/:address     — Peek at undelivered (don't mark)
 * GET  /messages/conversation      — Get conversation history between two addresses
 * GET  /messages/conversations/:address — List conversation partners
 * GET  /messages/count/:address    — Count undelivered messages
 * POST /messages/ack               — Acknowledge message delivery
 */

const express = require('express');
const router = express.Router();
const messageService = require('../services/message-service');
const pushService = require('../services/push-service');
const profileResolver = require('../services/profile-resolver');
const { requireAuth } = require('../services/auth-middleware');

// POST /messages/send (requires Ed25519 auth)
router.post('/send', requireAuth, (req, res) => {
  try {
    const { senderAddress, recipientAddress, senderPk, encryptedPayload, nonce, signature } = req.body;

    if (!senderAddress || !recipientAddress || !senderPk || !encryptedPayload || !nonce) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: senderAddress, recipientAddress, senderPk, encryptedPayload, nonce',
      });
    }

    const result = messageService.send({
      senderAddress,
      recipientAddress,
      senderPk,
      encryptedPayload,
      nonce,
      signature,
    });

    // Fire-and-forget push notification to recipient
    try {
      const senderProfile = profileResolver.getByAddress(senderAddress);
      const senderName = senderProfile?.displayName || senderProfile?.username || senderAddress.substring(0, 16) + '…';
      pushService.notifyNewMessage(recipientAddress, senderName).catch(() => {});
    } catch (_) {}

    res.json({ status: 'success', data: result });
  } catch (e) {
    console.error(`[API] send error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /messages/receive/:address?limit=100 (requires Ed25519 auth)
router.get('/receive/:address', requireAuth, (req, res) => {
  try {
    const { address } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);

    // Verify the authenticated user is requesting their own messages
    if (req.verifiedAddress !== address) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only receive your own messages',
      });
    }

    const messages = messageService.receive(address, limit);
    res.json({
      status: 'success',
      data: messages,
      count: messages.length,
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /messages/peek/:address?limit=100
router.get('/peek/:address', (req, res) => {
  try {
    const { address } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);

    const messages = messageService.peek(address, limit);
    res.json({
      status: 'success',
      data: messages,
      count: messages.length,
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /messages/conversation?addr1=...&addr2=...&limit=50&offset=0
// Sealed-sender mode: ?pk1=myPK&pk2=theirPK&addr1=myAddr&addr2=theirAddr
router.get('/conversation', (req, res) => {
  try {
    const { addr1, addr2, pk1, pk2, limit: limitStr, offset: offsetStr } = req.query;
    const limit = Math.min(parseInt(limitStr) || 50, 200);
    const offset = parseInt(offsetStr) || 0;

    let messages;
    if (pk1 && pk2 && addr1 && addr2) {
      // Sealed-sender: match by sender_pk + recipient_address
      messages = messageService.getConversationByPk(pk1, addr1, pk2, addr2, limit, offset);
    } else if (addr1 && addr2) {
      // Legacy: match by sender_address + recipient_address
      messages = messageService.getConversation(addr1, addr2, limit, offset);
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required query params: addr1, addr2 (or pk1, pk2, addr1, addr2 for sealed mode)',
      });
    }

    res.json({
      status: 'success',
      data: messages,
      count: messages.length,
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /messages/conversations/:address?limit=50&myPk=...
router.get('/conversations/:address', (req, res) => {
  try {
    const { address } = req.params;
    const { myPk } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    let conversations;
    if (myPk) {
      // Sealed-sender: use sender_pk for grouping
      conversations = messageService.getConversationsByPk(myPk, address, limit);
    } else {
      // Legacy: use sender_address for grouping
      conversations = messageService.getConversations(address, limit);
    }
    res.json({
      status: 'success',
      data: conversations,
      count: conversations.length,
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /messages/count/:address
router.get('/count/:address', (req, res) => {
  try {
    const { address } = req.params;
    const count = messageService.undeliveredCount(address);
    res.json({ status: 'success', data: { count } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /messages/ack (requires Ed25519 auth)
router.post('/ack', requireAuth, (req, res) => {
  try {
    const { messageIds } = req.body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required field: messageIds (array)',
      });
    }

    const count = messageService.acknowledge(messageIds);
    res.json({ status: 'success', data: { acknowledged: count } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
