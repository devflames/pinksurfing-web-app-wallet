/**
 * Group Chat Routes — Signal-grade E2E + IRC/Clubhouse-style Rooms
 *
 * Server is a dumb relay for group metadata + encrypted message fan-out.
 * Message content is NEVER visible to the server.
 *
 * POST /groups/create                     — Create a group (public or private)
 * GET  /groups/discover                   — Discover public rooms (search, pagination)
 * POST /groups/join                       — Join a public room (self-join)
 * GET  /groups/for/:address               — List groups for a wallet address
 * GET  /groups/:id                        — Get group details + members
 * PUT  /groups/:id                        — Update group metadata (admin)
 * POST /groups/:id/members                — Add members (admin)
 * DELETE /groups/:id/members/:address     — Remove member / leave
 * GET  /groups/:id/keys                   — Get member public keys (for E2E encryption)
 * POST /groups/:id/send                   — Send encrypted message (fan-out to all members)
 * GET  /groups/:id/messages/:address      — Get group message history for a member
 * POST /groups/:id/read                  — Mark messages as read for a member
 * GET  /groups/:id/read-status           — Get read receipts for all members
 * POST /groups/:id/typing               — Signal typing state
 * GET  /groups/:id/typing               — Get who's typing
 */

const express = require('express');
const router = express.Router();
const groupService = require('../services/group-service');

// POST /groups/create
// Body: { name, description?, avatarUrl?, creatorAddress, creatorDisplayName?, memberAddresses?: string[], visibility?: 'public'|'private', maxMembers?: number }
router.post('/create', (req, res) => {
  try {
    const { name, description, avatarUrl, creatorAddress, creatorDisplayName, memberAddresses, visibility, maxMembers } = req.body;

    if (!name || !creatorAddress) {
      return res.status(400).json({ status: 'error', message: 'name and creatorAddress are required' });
    }

    const result = groupService.createGroup({
      name,
      description,
      avatarUrl,
      creatorAddress,
      creatorDisplayName,
      memberAddresses,
      visibility,
      maxMembers,
    });

    if (result.error) {
      return res.status(400).json({ status: 'fail', message: result.error });
    }

    res.json({ status: 'success', data: result.group });
  } catch (e) {
    console.error(`[Groups] Create error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /groups/discover?q=search&limit=30&offset=0 — discover public rooms
router.get('/discover', (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit, 10) || 30;
    const offset = parseInt(req.query.offset, 10) || 0;

    const rooms = groupService.discoverPublicGroups(query, limit, offset);
    res.json({ status: 'success', data: rooms, count: rooms.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /groups/join — join a public room (self-join)
// Body: { groupId, joinerAddress }
router.post('/join', (req, res) => {
  try {
    const { groupId, joinerAddress } = req.body;
    if (!groupId || !joinerAddress) {
      return res.status(400).json({ status: 'error', message: 'groupId and joinerAddress are required' });
    }

    const result = groupService.joinGroup(groupId, joinerAddress);
    if (result.error) {
      const status = result.error.includes('not found') ? 404 : 403;
      return res.status(status).json({ status: 'fail', message: result.error });
    }

    res.json({ status: 'success', data: result.group });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /groups/for/:address — list all groups this wallet belongs to
router.get('/for/:address', (req, res) => {
  try {
    const groups = groupService.getGroupsForAddress(req.params.address);
    res.json({ status: 'success', data: groups, count: groups.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /groups/:id — group details + members
router.get('/:id', (req, res) => {
  try {
    const group = groupService.getGroup(req.params.id);
    if (!group) return res.status(404).json({ status: 'error', message: 'Group not found' });
    res.json({ status: 'success', data: group });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// PUT /groups/:id — update group metadata
// Body: { requesterAddress, name?, description?, avatarUrl? }
router.put('/:id', (req, res) => {
  try {
    const { requesterAddress, name, description, avatarUrl } = req.body;
    if (!requesterAddress) {
      return res.status(400).json({ status: 'error', message: 'requesterAddress is required' });
    }

    const result = groupService.updateGroup(req.params.id, requesterAddress, { name, description, avatarUrl });
    if (result.error) {
      return res.status(403).json({ status: 'fail', message: result.error });
    }

    res.json({ status: 'success', data: result.group });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /groups/:id/members — add members
// Body: { requesterAddress, memberAddresses: string[] }
router.post('/:id/members', (req, res) => {
  try {
    const { requesterAddress, memberAddresses } = req.body;
    if (!requesterAddress || !Array.isArray(memberAddresses)) {
      return res.status(400).json({ status: 'error', message: 'requesterAddress and memberAddresses[] are required' });
    }

    const result = groupService.addMembers(req.params.id, requesterAddress, memberAddresses);
    if (result.error) {
      return res.status(403).json({ status: 'fail', message: result.error });
    }

    res.json({ status: 'success', data: result });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// DELETE /groups/:id/members/:address — remove member or leave group
// Query: ?requesterAddress=xch1...
router.delete('/:id/members/:address', (req, res) => {
  try {
    const requesterAddress = req.query.requesterAddress;
    if (!requesterAddress) {
      return res.status(400).json({ status: 'error', message: 'requesterAddress query param is required' });
    }

    const result = groupService.removeMember(req.params.id, requesterAddress, req.params.address);
    if (result.error) {
      return res.status(403).json({ status: 'fail', message: result.error });
    }

    res.json({ status: 'success', data: result });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /groups/:id/keys — get member public keys for E2E encryption
// Query: ?requesterAddress=xch1...
router.get('/:id/keys', (req, res) => {
  try {
    const requesterAddress = req.query.requesterAddress;
    if (!requesterAddress) {
      return res.status(400).json({ status: 'error', message: 'requesterAddress query param is required' });
    }

    const result = groupService.getMemberKeys(req.params.id, requesterAddress);
    if (result.error) {
      return res.status(403).json({ status: 'fail', message: result.error });
    }

    res.json({ status: 'success', data: result.members });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /groups/:id/send — send encrypted group message (fan-out)
// Body: {
//   senderAddress, senderPk,
//   encryptedMessages: [{ recipientAddress, encryptedPayload, nonce, signature? }, ...]
// }
router.post('/:id/send', (req, res) => {
  try {
    const { senderAddress, senderPk, encryptedMessages } = req.body;

    if (!senderAddress || !senderPk) {
      return res.status(400).json({ status: 'error', message: 'senderAddress and senderPk are required' });
    }
    if (!Array.isArray(encryptedMessages) || encryptedMessages.length === 0) {
      return res.status(400).json({ status: 'error', message: 'encryptedMessages array is required' });
    }

    const result = groupService.sendGroupMessage(req.params.id, senderAddress, senderPk, encryptedMessages);
    if (result.error) {
      return res.status(403).json({ status: 'fail', message: result.error });
    }

    res.json({ status: 'success', data: result });
  } catch (e) {
    console.error(`[Groups] Send error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /groups/:id/messages/:address?limit=50&offset=0
router.get('/:id/messages/:address', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    const result = groupService.getGroupMessages(req.params.id, req.params.address, limit, offset);
    if (result.error) {
      return res.status(403).json({ status: 'fail', message: result.error });
    }

    res.json({ status: 'success', data: result.messages, count: result.count });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /groups/:id/read — mark messages as read for a member
// Body: { memberAddress }
router.post('/:id/read', (req, res) => {
  try {
    const { memberAddress } = req.body;
    if (!memberAddress) {
      return res.status(400).json({ status: 'error', message: 'memberAddress is required' });
    }

    const result = groupService.markRead(req.params.id, memberAddress);
    if (result.error) {
      return res.status(403).json({ status: 'fail', message: result.error });
    }

    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /groups/:id/read-status — get read receipts for all members
router.get('/:id/read-status', (req, res) => {
  try {
    const data = groupService.getReadStatus(req.params.id);
    res.json({ status: 'success', data });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /groups/:id/typing — signal that a member is typing
// Body: { memberAddress }
router.post('/:id/typing', (req, res) => {
  try {
    const { memberAddress } = req.body;
    if (!memberAddress) {
      return res.status(400).json({ status: 'error', message: 'memberAddress is required' });
    }
    groupService.setTyping(req.params.id, memberAddress);
    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /groups/:id/typing?exclude=xch1... — get who's currently typing
router.get('/:id/typing', (req, res) => {
  try {
    const exclude = req.query.exclude || '';
    const typing = groupService.getTyping(req.params.id, exclude);
    res.json({ status: 'success', data: typing });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
