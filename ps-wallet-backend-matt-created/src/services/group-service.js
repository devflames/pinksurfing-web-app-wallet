/**
 * Group Chat Service — Signal-grade E2E
 *
 * The server manages group metadata and membership only.
 * Message content is NEVER visible to the server.
 *
 * E2E model (same as 1-on-1 wallet chat):
 * - Sender encrypts message N times (once per member's X25519 public key)
 * - Server receives N opaque blobs in one POST, fans them into the messages table
 * - Each member fetches their individually-encrypted copy via /messages/receive/:address
 * - Server sees: who sent, to which group, blob size. NEVER sees plaintext.
 *
 * Identity: wallet addresses (chia_address). No email, no MongoDB ObjectIDs.
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const pushService = require('./push-service');
const profileResolver = require('./profile-resolver');

// ── Prepared Statements ──

const stmts = {
  // Groups CRUD
  createGroup: db.prepare(`
    INSERT INTO groups (id, name, description, avatar_url, creator_address, visibility, max_members)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  getGroup: db.prepare(`SELECT * FROM groups WHERE id = ?`),
  updateGroup: db.prepare(`
    UPDATE groups SET name = ?, description = ?, avatar_url = ?, updated_at = datetime('now')
    WHERE id = ?
  `),
  updateGroupVisibility: db.prepare(`
    UPDATE groups SET visibility = ?, updated_at = datetime('now') WHERE id = ?
  `),
  deleteGroup: db.prepare(`DELETE FROM groups WHERE id = ?`),
  discoverPublic: db.prepare(`
    SELECT g.*, (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
    FROM groups g
    WHERE g.visibility = 'public'
    ORDER BY g.updated_at DESC
    LIMIT ? OFFSET ?
  `),
  searchPublic: db.prepare(`
    SELECT g.*, (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
    FROM groups g
    WHERE g.visibility = 'public'
      AND (g.name LIKE ? OR g.description LIKE ?)
    ORDER BY g.updated_at DESC
    LIMIT ? OFFSET ?
  `),

  // Members
  addMember: db.prepare(`
    INSERT OR IGNORE INTO group_members (group_id, member_address, role, display_name, invited_by)
    VALUES (?, ?, ?, ?, ?)
  `),
  removeMember: db.prepare(`
    DELETE FROM group_members WHERE group_id = ? AND member_address = ?
  `),
  getMembers: db.prepare(`
    SELECT * FROM group_members WHERE group_id = ? ORDER BY joined_at ASC
  `),
  getMember: db.prepare(`
    SELECT * FROM group_members WHERE group_id = ? AND member_address = ?
  `),
  updateMemberRole: db.prepare(`
    UPDATE group_members SET role = ? WHERE group_id = ? AND member_address = ?
  `),
  getGroupsForAddress: db.prepare(`
    SELECT g.*, gm.role, gm.joined_at as member_since
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.member_address = ?
    ORDER BY g.updated_at DESC
  `),
  getMemberCount: db.prepare(`
    SELECT COUNT(*) as count FROM group_members WHERE group_id = ?
  `),
  updateLastRead: db.prepare(`
    UPDATE group_members SET last_read_at = datetime('now') WHERE group_id = ? AND member_address = ?
  `),
  getReadStatus: db.prepare(`
    SELECT member_address, last_read_at FROM group_members WHERE group_id = ? AND last_read_at IS NOT NULL
  `),
  getUnreadCount: db.prepare(`
    SELECT COUNT(*) as count FROM messages
    WHERE group_id = ? AND recipient_address = ?
      AND timestamp > COALESCE(?, '1970-01-01')
  `),

  // Group messages (fan-out into existing messages table)
  insertGroupMessage: db.prepare(`
    INSERT INTO messages (id, sender_address, recipient_address, sender_pk, encrypted_payload, nonce, signature, group_id, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `),
  getGroupMessages: db.prepare(`
    SELECT * FROM messages
    WHERE group_id = ? AND recipient_address = ?
    ORDER BY timestamp ASC
    LIMIT ? OFFSET ?
  `),
  getGroupMessageHistory: db.prepare(`
    SELECT DISTINCT m.* FROM messages m
    WHERE m.group_id = ?
    ORDER BY m.timestamp ASC
    LIMIT ? OFFSET ?
  `),
};

// Transaction for atomic fan-out
const fanOutTransaction = db.transaction((messages) => {
  for (const msg of messages) {
    stmts.insertGroupMessage.run(
      msg.id,
      msg.senderAddress,
      msg.recipientAddress,
      msg.senderPk,
      msg.encryptedPayload,
      msg.nonce,
      msg.signature || null,
      msg.groupId,
    );
  }
  return messages.length;
});

/**
 * Create a new group.
 * Creator is automatically added as admin.
 */
function createGroup({ name, description, avatarUrl, creatorAddress, creatorDisplayName, memberAddresses, visibility, maxMembers }) {
  if (!name || !creatorAddress) {
    return { error: 'name and creatorAddress are required' };
  }

  const vis = (visibility === 'public') ? 'public' : 'private';
  const maxMem = Math.min(Math.max(parseInt(maxMembers) || 500, 2), 10000);
  const id = uuidv4();
  stmts.createGroup.run(id, name, description || null, avatarUrl || null, creatorAddress, vis, maxMem);

  // Add creator as admin
  stmts.addMember.run(id, creatorAddress, 'admin', creatorDisplayName || null, null);

  // Add initial members
  if (Array.isArray(memberAddresses)) {
    for (const addr of memberAddresses) {
      if (addr && addr !== creatorAddress) {
        const profile = profileResolver.getByAddress(addr);
        stmts.addMember.run(id, addr, 'member', profile?.displayName || null, creatorAddress);
      }
    }
  }

  const group = stmts.getGroup.get(id);
  const members = stmts.getMembers.all(id);

  console.log(`[Groups] Created ${vis} room "${name}" (${id}) by ${creatorAddress.substring(0, 16)}… with ${members.length} members`);

  // Push notification to invited members
  if (Array.isArray(memberAddresses)) {
    for (const addr of memberAddresses) {
      if (addr && addr !== creatorAddress) {
        _sendGroupPush(addr, creatorDisplayName || creatorAddress.substring(0, 12), {
          title: 'Added to Group',
          body: `You were added to "${name}"`,
          group_id: id,
          group_name: name,
          notification_type: 'group_invite',
        });
      }
    }
  }

  return { group: _formatGroup(group, members) };
}

/**
 * Get group details with members.
 */
function getGroup(groupId) {
  const group = stmts.getGroup.get(groupId);
  if (!group) return null;
  const members = stmts.getMembers.all(groupId);
  return _formatGroup(group, members);
}

/**
 * Update group metadata (name, description, avatar).
 * Only admins can update.
 */
function updateGroup(groupId, requesterAddress, { name, description, avatarUrl }) {
  const member = stmts.getMember.get(groupId, requesterAddress);
  if (!member) return { error: 'You are not a member of this group' };
  if (member.role !== 'admin') return { error: 'Only admins can update group details' };

  const group = stmts.getGroup.get(groupId);
  if (!group) return { error: 'Group not found' };

  stmts.updateGroup.run(
    name || group.name,
    description !== undefined ? description : group.description,
    avatarUrl !== undefined ? avatarUrl : group.avatar_url,
    groupId,
  );

  const updated = stmts.getGroup.get(groupId);
  const members = stmts.getMembers.all(groupId);
  return { group: _formatGroup(updated, members) };
}

/**
 * Add members to a group.
 * Only admins can add.
 */
function addMembers(groupId, requesterAddress, newMemberAddresses) {
  const member = stmts.getMember.get(groupId, requesterAddress);
  if (!member) return { error: 'You are not a member of this group' };
  if (member.role !== 'admin') return { error: 'Only admins can add members' };

  const group = stmts.getGroup.get(groupId);
  if (!group) return { error: 'Group not found' };

  const added = [];
  for (const addr of newMemberAddresses) {
    if (!addr) continue;
    const existing = stmts.getMember.get(groupId, addr);
    if (existing) continue;

    const profile = profileResolver.getByAddress(addr);
    stmts.addMember.run(groupId, addr, 'member', profile?.displayName || null, requesterAddress);
    added.push(addr);

    _sendGroupPush(addr, member.display_name || requesterAddress.substring(0, 12), {
      title: 'Added to Group',
      body: `You were added to "${group.name}"`,
      group_id: groupId,
      group_name: group.name,
      notification_type: 'group_invite',
    });
  }

  // Touch group updated_at
  db.prepare(`UPDATE groups SET updated_at = datetime('now') WHERE id = ?`).run(groupId);

  const members = stmts.getMembers.all(groupId);
  return { added, group: _formatGroup(stmts.getGroup.get(groupId), members) };
}

/**
 * Remove a member from a group.
 * Admins can remove anyone. Members can only remove themselves (leave).
 */
function removeMember(groupId, requesterAddress, targetAddress) {
  const requester = stmts.getMember.get(groupId, requesterAddress);
  if (!requester) return { error: 'You are not a member of this group' };

  const isSelf = requesterAddress === targetAddress;
  if (!isSelf && requester.role !== 'admin') {
    return { error: 'Only admins can remove other members' };
  }

  const target = stmts.getMember.get(groupId, targetAddress);
  if (!target) return { error: 'Target is not a member of this group' };

  stmts.removeMember.run(groupId, targetAddress);

  // If last admin leaves, promote the next oldest member
  const remainingMembers = stmts.getMembers.all(groupId);
  if (remainingMembers.length === 0) {
    // No members left — delete the group
    stmts.deleteGroup.run(groupId);
    return { removed: targetAddress, groupDeleted: true };
  }

  const hasAdmin = remainingMembers.some(m => m.role === 'admin');
  if (!hasAdmin && remainingMembers.length > 0) {
    stmts.updateMemberRole.run('admin', groupId, remainingMembers[0].member_address);
  }

  db.prepare(`UPDATE groups SET updated_at = datetime('now') WHERE id = ?`).run(groupId);

  return { removed: targetAddress, group: _formatGroup(stmts.getGroup.get(groupId), stmts.getMembers.all(groupId)) };
}

/**
 * List groups for a wallet address.
 */
function getGroupsForAddress(address) {
  const rows = stmts.getGroupsForAddress.all(address);
  return rows.map(row => {
    const members = stmts.getMembers.all(row.id);
    // Unread count: messages after this member's last_read_at
    const memberRow = stmts.getMember.get(row.id, address);
    const lastRead = memberRow?.last_read_at || null;
    const { count: unreadCount } = stmts.getUnreadCount.get(row.id, address, lastRead);
    return {
      ..._formatGroup(row, members),
      myRole: row.role,
      memberSince: row.member_since,
      unreadCount,
    };
  });
}

/**
 * Mark all messages in a group as read for a member.
 */
function markRead(groupId, memberAddress) {
  const member = stmts.getMember.get(groupId, memberAddress);
  if (!member) return { error: 'Not a member' };
  stmts.updateLastRead.run(groupId, memberAddress);
  return { ok: true };
}

/**
 * Get read status for all members of a group.
 * Returns array of { memberAddress, lastReadAt }.
 */
function getReadStatus(groupId) {
  const rows = stmts.getReadStatus.all(groupId);
  return rows.map(r => ({
    memberAddress: r.member_address,
    lastReadAt: r.last_read_at,
  }));
}

/**
 * Send an encrypted message to a group (fan-out).
 *
 * The client encrypts the message separately for each member using their
 * X25519 public key (same as 1-on-1 chat). The server receives an array
 * of per-recipient encrypted payloads and fans them into the messages table.
 *
 * @param {string} groupId
 * @param {string} senderAddress - Wallet address of sender
 * @param {string} senderPk - Sender's public key (for sealed-sender resolution)
 * @param {Array} encryptedMessages - Array of { recipientAddress, encryptedPayload, nonce, signature }
 */
function sendGroupMessage(groupId, senderAddress, senderPk, encryptedMessages) {
  const group = stmts.getGroup.get(groupId);
  if (!group) return { error: 'Group not found' };

  const senderMember = stmts.getMember.get(groupId, senderAddress);
  if (!senderMember) return { error: 'You are not a member of this group' };

  if (!Array.isArray(encryptedMessages) || encryptedMessages.length === 0) {
    return { error: 'encryptedMessages array is required' };
  }

  // Validate all recipients are group members
  const members = stmts.getMembers.all(groupId);
  const memberSet = new Set(members.map(m => m.member_address));

  const messages = [];
  for (const em of encryptedMessages) {
    if (!em.recipientAddress || !em.encryptedPayload || !em.nonce) {
      return { error: 'Each message must have recipientAddress, encryptedPayload, and nonce' };
    }
    if (!memberSet.has(em.recipientAddress)) {
      return { error: `Recipient ${em.recipientAddress} is not a member of this group` };
    }

    messages.push({
      id: uuidv4(),
      senderAddress,
      recipientAddress: em.recipientAddress,
      senderPk: senderPk || '',
      encryptedPayload: em.encryptedPayload,
      nonce: em.nonce,
      signature: em.signature || null,
      groupId,
    });
  }

  // Atomic fan-out: all messages inserted in one transaction
  const count = fanOutTransaction(messages);

  // Touch group updated_at
  db.prepare(`UPDATE groups SET updated_at = datetime('now') WHERE id = ?`).run(groupId);

  console.log(`[Groups] ${senderAddress.substring(0, 16)}… → "${group.name}" (${count} copies fan-out)`);

  // Push notifications to all other members
  const senderProfile = profileResolver.getByAddress(senderAddress);
  const senderName = senderProfile?.displayName || senderAddress.substring(0, 12);
  for (const m of members) {
    if (m.member_address === senderAddress) continue;
    _sendGroupPush(m.member_address, senderName, {
      title: group.name,
      body: `${senderName}: New message`,
      group_id: groupId,
      group_name: group.name,
      from: senderAddress,
      notification_type: 'group_message',
    });
  }

  return {
    messageCount: count,
    groupId,
    messageIds: messages.map(m => m.id),
  };
}

/**
 * Get group message history for a specific member.
 * Returns only messages encrypted for this address.
 */
function getGroupMessages(groupId, memberAddress, limit = 50, offset = 0) {
  const member = stmts.getMember.get(groupId, memberAddress);
  if (!member) return { error: 'You are not a member of this group' };

  const rows = stmts.getGroupMessages.all(groupId, memberAddress, Math.min(limit, 200), offset);
  return {
    messages: rows.map(r => ({
      messageId: r.id,
      senderAddress: r.sender_address,
      recipientAddress: r.recipient_address,
      senderPk: r.sender_pk,
      encryptedPayload: r.encrypted_payload,
      nonce: r.nonce,
      signature: r.signature || null,
      groupId: r.group_id,
      timestamp: r.timestamp,
      delivered: !!r.delivered,
    })),
    count: rows.length,
  };
}

/**
 * Discover public rooms. Optional search query.
 */
function discoverPublicGroups(query, limit = 30, offset = 0) {
  const lim = Math.min(Math.max(limit, 1), 100);
  let rows;
  if (query && query.trim()) {
    const pattern = `%${query.trim()}%`;
    rows = stmts.searchPublic.all(pattern, pattern, lim, offset);
  } else {
    rows = stmts.discoverPublic.all(lim, offset);
  }
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description || null,
    avatarUrl: row.avatar_url || null,
    visibility: row.visibility || 'private',
    creatorAddress: row.creator_address,
    memberCount: row.member_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Join a public group (self-join). Private groups require admin invite.
 */
function joinGroup(groupId, joinerAddress) {
  const group = stmts.getGroup.get(groupId);
  if (!group) return { error: 'Group not found' };

  // Check if already a member
  const existing = stmts.getMember.get(groupId, joinerAddress);
  if (existing) return { error: 'Already a member of this group' };

  // Only public groups allow self-join
  if (group.visibility !== 'public') {
    return { error: 'This is a private group. You need an invite to join.' };
  }

  // Check max members
  const { count } = stmts.getMemberCount.get(groupId);
  const maxMem = group.max_members || 500;
  if (count >= maxMem) {
    return { error: `Group is full (${maxMem} members max)` };
  }

  const profile = profileResolver.getByAddress(joinerAddress);
  stmts.addMember.run(groupId, joinerAddress, 'member', profile?.displayName || null, null);

  db.prepare(`UPDATE groups SET updated_at = datetime('now') WHERE id = ?`).run(groupId);

  const members = stmts.getMembers.all(groupId);
  console.log(`[Groups] ${joinerAddress.substring(0, 16)}… joined public room "${group.name}"`);

  return { group: _formatGroup(stmts.getGroup.get(groupId), members) };
}

/**
 * Get member public keys for a group (needed by sender to encrypt for each).
 * Returns messaging PKs so the client can DH-encrypt for each member.
 */
function getMemberKeys(groupId, requesterAddress) {
  const requester = stmts.getMember.get(groupId, requesterAddress);
  if (!requester) return { error: 'You are not a member of this group' };

  const members = stmts.getMembers.all(groupId);
  const keys = [];

  for (const m of members) {
    const profile = profileResolver.getByAddress(m.member_address);
    keys.push({
      address: m.member_address,
      displayName: profile?.displayName || m.display_name || null,
      messagingPk: profile?.profileData?.messagingPk || null,
      walletPk: profile?.walletPk || null,
    });
  }

  return { members: keys };
}

// ── Helpers ──

function _formatGroup(group, members) {
  return {
    id: group.id,
    name: group.name,
    description: group.description || null,
    avatarUrl: group.avatar_url || null,
    visibility: group.visibility || 'private',
    maxMembers: group.max_members || 500,
    creatorAddress: group.creator_address,
    createdAt: group.created_at,
    updatedAt: group.updated_at,
    memberCount: members.length,
    members: members.map(m => ({
      address: m.member_address,
      role: m.role,
      displayName: m.display_name || null,
      invitedBy: m.invited_by || null,
      joinedAt: m.joined_at,
    })),
  };
}

async function _sendGroupPush(recipientAddress, senderName, data) {
  try {
    const fcmToken = profileResolver.getFcmToken(recipientAddress);
    if (!fcmToken) return;

    const stringData = {};
    for (const [k, v] of Object.entries(data)) {
      stringData[k] = String(v || '');
    }
    stringData.type = 'group_chat';
    stringData.click_action = 'FLUTTER_NOTIFICATION_CLICK';

    await pushService.sendPush(fcmToken, data.title || 'Group', data.body || '', stringData);
  } catch (e) {
    console.error(`[Groups] Push error: ${e.message}`);
  }
}

// ── Typing Indicators (in-memory, ephemeral) ──

// Map<groupId, Map<memberAddress, expiresAtMs>>
const _typingState = new Map();
const TYPING_TTL_MS = 5000;

/**
 * Signal that a member is currently typing in a group.
 * Expires automatically after TYPING_TTL_MS.
 */
function setTyping(groupId, memberAddress) {
  if (!_typingState.has(groupId)) _typingState.set(groupId, new Map());
  _typingState.get(groupId).set(memberAddress, Date.now() + TYPING_TTL_MS);
}

/**
 * Get list of members currently typing in a group (excluding requester).
 */
function getTyping(groupId, excludeAddress) {
  const now = Date.now();
  const groupMap = _typingState.get(groupId);
  if (!groupMap) return [];

  const typing = [];
  for (const [addr, expiresAt] of groupMap) {
    if (expiresAt < now) {
      groupMap.delete(addr); // expired
    } else if (addr !== excludeAddress) {
      typing.push(addr);
    }
  }
  // Clean up empty group entries
  if (groupMap.size === 0) _typingState.delete(groupId);
  return typing;
}

module.exports = {
  createGroup,
  getGroup,
  updateGroup,
  addMembers,
  removeMember,
  getGroupsForAddress,
  sendGroupMessage,
  getGroupMessages,
  getMemberKeys,
  discoverPublicGroups,
  joinGroup,
  markRead,
  getReadStatus,
  setTyping,
  getTyping,
};
