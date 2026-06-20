/**
 * Call Service
 *
 * Manages voice/video call state for wallet-based users.
 * Uses Agora RTC for media and FCM push for call signaling.
 *
 * Call status flow: initiated → accepted → ended
 *                   initiated → rejected
 *                   initiated → missed (auto after timeout)
 *
 * Identity: wallet addresses (chia_address), NOT email/account IDs.
 */

const crypto = require('crypto');
const db = require('./db');
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const pushService = require('./push-service');
const profileResolver = require('./profile-resolver');

const AGORA_APP_ID = process.env.AGORA_APP_ID || '';
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '';

// Call status constants
const STATUS = {
  INITIATED: 'initiated',
  ACCEPTED: 'accepted',
  ENDED: 'ended',
  REJECTED: 'rejected',
  MISSED: 'missed',
};

// Prepared statements
const stmts = {
  insert: db.prepare(`
    INSERT INTO calls (id, from_address, to_address, call_mode, call_status, channel,
      caller_display_name, caller_avatar_url, receiver_display_name, receiver_avatar_url,
      group_id, group_name, group_image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getByChannel: db.prepare(`SELECT * FROM calls WHERE channel = ?`),
  getById: db.prepare(`SELECT * FROM calls WHERE id = ?`),
  updateStatus: db.prepare(`UPDATE calls SET call_status = ? WHERE channel = ?`),
  accept: db.prepare(`UPDATE calls SET call_status = 'accepted', accepted_at = datetime('now') WHERE channel = ?`),
  end: db.prepare(`
    UPDATE calls SET call_status = 'ended', ended_at = datetime('now'),
      duration_seconds = CASE
        WHEN accepted_at IS NOT NULL THEN CAST((julianday('now') - julianday(accepted_at)) * 86400 AS INTEGER)
        ELSE 0
      END
    WHERE channel = ?
  `),
  activeForAddress: db.prepare(`
    SELECT * FROM calls
    WHERE (from_address = ? OR to_address = ?)
      AND call_status IN ('initiated', 'accepted')
    ORDER BY created_at DESC LIMIT 1
  `),
  historyForAddress: db.prepare(`
    SELECT * FROM calls
    WHERE from_address = ? OR to_address = ?
    ORDER BY created_at DESC LIMIT ?
  `),
};

/**
 * Generate an Agora RTC token for a channel.
 */
function generateToken(channel, uid, role = 'publisher', expireSeconds = 3600) {
  if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
    throw new Error('Agora credentials not configured (set AGORA_APP_ID and AGORA_APP_CERTIFICATE in .env)');
  }

  const rtcRole = role === 'audience' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireSeconds;

  // Use UID-based token (numeric UID for Agora)
  const numericUid = typeof uid === 'number' ? uid : parseInt(uid, 10) || 0;
  const token = RtcTokenBuilder.buildTokenWithUid(
    AGORA_APP_ID,
    AGORA_APP_CERTIFICATE,
    channel,
    numericUid,
    rtcRole,
    privilegeExpireTime,
  );

  return { token, appId: AGORA_APP_ID, channel, uid: numericUid };
}

/**
 * Generate a unique channel name from two wallet addresses.
 */
function generateChannelName(fromAddress, toAddress) {
  const sorted = [fromAddress, toAddress || ''].sort().join(':');
  return crypto.createHash('sha256').update(sorted).digest('hex').substring(0, 16);
}

/**
 * Initiate a call.
 */
function initiateCall({ fromAddress, toAddress, callMode, callerDisplayName, callerAvatarUrl, groupId, groupName }) {
  // Check for active calls involving either party
  const active = stmts.activeForAddress.get(fromAddress, fromAddress);
  if (active) {
    return { error: 'You already have an active call', activeCall: active };
  }

  if (toAddress) {
    const receiverActive = stmts.activeForAddress.get(toAddress, toAddress);
    if (receiverActive) {
      return { error: 'Recipient is busy', activeCall: null };
    }
  }

  // Resolve receiver profile for display info
  let receiverDisplayName = '';
  let receiverAvatarUrl = '';
  if (toAddress) {
    const receiverProfile = profileResolver.getByAddress(toAddress);
    if (receiverProfile) {
      receiverDisplayName = receiverProfile.display_name || '';
      receiverAvatarUrl = receiverProfile.avatar_url || '';
    }
  }

  const id = crypto.randomUUID();
  const channel = generateChannelName(fromAddress, toAddress || id);

  stmts.insert.run(
    id,
    fromAddress,
    toAddress || null,
    callMode || 'voice',
    STATUS.INITIATED,
    channel,
    callerDisplayName || '',
    callerAvatarUrl || '',
    receiverDisplayName,
    receiverAvatarUrl,
    groupId || null,
    groupName || null,
    null, // group_image
  );

  const call = stmts.getById.get(id);

  // Send push notification to receiver
  if (toAddress) {
    const callTypeLabel = callMode === 'video' ? 'Video' : 'Voice';
    _sendCallPush(toAddress, callerDisplayName || fromAddress.substring(0, 12), {
      title: `Incoming ${callTypeLabel} Call`,
      body: `${callerDisplayName || 'Someone'} is calling you`,
      call_status: 'initiate',
      channel,
      from: fromAddress,
      call_mode: callMode || 'voice',
      notification_type: callMode === 'video' ? '5' : '4',
    });
  }

  return { call };
}

/**
 * Accept a call.
 */
function acceptCall(channel, accepterAddress) {
  const call = stmts.getByChannel.get(channel);
  if (!call) return { error: 'Call not found' };
  if (call.call_status !== STATUS.INITIATED) return { error: `Call is already ${call.call_status}` };

  stmts.accept.run(channel);
  const updated = stmts.getByChannel.get(channel);

  // Notify caller that call was accepted
  _sendCallPush(call.from_address, call.receiver_display_name || accepterAddress, {
    title: 'Call Accepted',
    body: `${call.receiver_display_name || 'Recipient'} accepted your call`,
    call_status: 'accept',
    channel,
    from: accepterAddress,
    call_mode: call.call_mode,
    notification_type: call.call_mode === 'video' ? '5' : '4',
  });

  return { call: updated };
}

/**
 * Reject a call.
 */
function rejectCall(channel, rejectorAddress) {
  const call = stmts.getByChannel.get(channel);
  if (!call) return { error: 'Call not found' };
  if (call.call_status !== STATUS.INITIATED) return { error: `Call is already ${call.call_status}` };

  stmts.updateStatus.run(STATUS.REJECTED, channel);
  const updated = stmts.getByChannel.get(channel);

  // Notify caller that call was rejected
  _sendCallPush(call.from_address, rejectorAddress, {
    title: 'Call Rejected',
    body: 'Your call was declined',
    call_status: 'reject',
    channel,
    from: rejectorAddress,
    call_mode: call.call_mode,
    notification_type: call.call_mode === 'video' ? '5' : '4',
  });

  return { call: updated };
}

/**
 * End a call.
 */
function endCall(channel, enderAddress) {
  const call = stmts.getByChannel.get(channel);
  if (!call) return { error: 'Call not found' };
  if (call.call_status === STATUS.ENDED || call.call_status === STATUS.REJECTED) {
    return { error: `Call is already ${call.call_status}` };
  }

  stmts.end.run(channel);
  const updated = stmts.getByChannel.get(channel);

  // Notify the other party
  const otherAddress = enderAddress === call.from_address ? call.to_address : call.from_address;
  if (otherAddress) {
    _sendCallPush(otherAddress, enderAddress, {
      title: 'Call Ended',
      body: 'The call has ended',
      call_status: 'end',
      channel,
      from: enderAddress,
      call_mode: call.call_mode,
      notification_type: call.call_mode === 'video' ? '5' : '4',
    });
  }

  return { call: updated };
}

/**
 * Get active call for an address.
 */
function getActiveCall(address) {
  return stmts.activeForAddress.get(address, address) || null;
}

/**
 * Get call by channel.
 */
function getByChannel(channel) {
  return stmts.getByChannel.get(channel) || null;
}

/**
 * Get call history for an address.
 */
function getHistory(address, limit = 50) {
  return stmts.historyForAddress.all(address, address, Math.min(limit, 200));
}

/**
 * Send a push notification for call events.
 * @private
 */
async function _sendCallPush(recipientAddress, senderName, data) {
  try {
    const fcmToken = profileResolver.getFcmToken(recipientAddress);
    if (!fcmToken) {
      console.log(`[Calls] No FCM token for ${recipientAddress.substring(0, 16)}… — push skipped`);
      return;
    }

    // Convert all data values to strings (FCM requirement)
    const stringData = {};
    for (const [k, v] of Object.entries(data)) {
      stringData[k] = String(v || '');
    }
    stringData.type = 'call';
    stringData.click_action = 'FLUTTER_NOTIFICATION_CLICK';

    await pushService.sendPush(fcmToken, data.title || 'Call', data.body || '', stringData);
    console.log(`[Calls] ✓ Push sent to ${recipientAddress.substring(0, 16)}… (${data.call_status})`);
  } catch (e) {
    console.error(`[Calls] Push error: ${e.message}`);
  }
}

/**
 * Auto-expire stale initiated calls (older than 60 seconds).
 * Run periodically.
 */
function expireStale() {
  const result = db.prepare(`
    UPDATE calls SET call_status = 'missed'
    WHERE call_status = 'initiated'
      AND created_at < datetime('now', '-60 seconds')
  `).run();

  if (result.changes > 0) {
    console.log(`[Calls] Expired ${result.changes} stale calls`);
  }
}

// Run cleanup every 30 seconds
setInterval(expireStale, 30_000);

module.exports = {
  generateToken,
  generateChannelName,
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,
  getActiveCall,
  getByChannel,
  getHistory,
  expireStale,
  STATUS,
  AGORA_APP_ID,
};
