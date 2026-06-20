/**
 * Message Relay Service
 *
 * A "dumb relay" for wallet-to-wallet encrypted messaging.
 * The server NEVER sees plaintext — only opaque encrypted blobs.
 *
 * Flow:
 * 1. Sender encrypts message client-side using DH shared secret
 *    (sender SK + recipient PK → AES-256-GCM key)
 * 2. Sender POSTs encrypted blob to relay
 * 3. Recipient polls relay for new messages
 * 4. Recipient decrypts client-side using same DH shared secret
 *    (recipient SK + sender PK → same AES-256-GCM key)
 *
 * The server only knows: who sent to whom, when, and the blob size.
 * It cannot read any message content.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// Prepared statements
const insertMessage = db.prepare(`
  INSERT INTO messages (id, sender_address, recipient_address, sender_pk, encrypted_payload, nonce, signature, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

const getUndelivered = db.prepare(`
  SELECT * FROM messages
  WHERE recipient_address = ? AND delivered = 0 AND expired = 0
  ORDER BY timestamp ASC
  LIMIT ?
`);

const getConversation = db.prepare(`
  SELECT * FROM messages
  WHERE (sender_address = ? AND recipient_address = ?)
     OR (sender_address = ? AND recipient_address = ?)
  ORDER BY timestamp ASC
  LIMIT ? OFFSET ?
`);

// Sealed-sender conversation query: match by sender_pk instead of sender_address
const getConversationByPk = db.prepare(`
  SELECT * FROM messages
  WHERE (sender_pk = ? AND recipient_address = ?)
     OR (sender_pk = ? AND recipient_address = ?)
  ORDER BY timestamp ASC
  LIMIT ? OFFSET ?
`);

const markDelivered = db.prepare(`
  UPDATE messages
  SET delivered = 1, delivered_at = datetime('now')
  WHERE id = ?
`);

const markBatchDelivered = db.prepare(`
  UPDATE messages
  SET delivered = 1, delivered_at = datetime('now')
  WHERE id IN (SELECT value FROM json_each(?))
`);

const getMessageById = db.prepare(`
  SELECT * FROM messages WHERE id = ?
`);

const getConversationPartners = db.prepare(`
  SELECT DISTINCT
    CASE WHEN sender_address = ? THEN recipient_address ELSE sender_address END as partner_address,
    MAX(timestamp) as last_message_at,
    COUNT(*) as message_count
  FROM messages
  WHERE sender_address = ? OR recipient_address = ?
  GROUP BY partner_address
  ORDER BY last_message_at DESC
  LIMIT ?
`);

// Sealed-sender conversation list: uses sender_pk for identification
// Returns partner_pk (for received msgs) or partner_address (for sent msgs)
const getConversationPartnersByPk = db.prepare(`
  SELECT
    CASE WHEN sender_pk = ? THEN recipient_address ELSE sender_pk END as partner_id,
    CASE WHEN sender_pk = ? THEN 'address' ELSE 'pk' END as partner_id_type,
    MAX(timestamp) as last_message_at,
    COUNT(*) as message_count
  FROM messages
  WHERE sender_pk = ? OR recipient_address = ?
  GROUP BY partner_id
  ORDER BY last_message_at DESC
  LIMIT ?
`);

const countUndelivered = db.prepare(`
  SELECT COUNT(*) as count FROM messages
  WHERE recipient_address = ? AND delivered = 0 AND expired = 0
`);

// Expire old undelivered messages (older than 30 days)
const expireOldMessages = db.prepare(`
  UPDATE messages
  SET expired = 1
  WHERE delivered = 0 AND timestamp < datetime('now', '-30 days')
`);

class MessageService {
  /**
   * Store an encrypted message for relay.
   * The payload is opaque to the server.
   */
  send({ senderAddress, recipientAddress, senderPk, encryptedPayload, nonce, signature }) {
    const id = uuidv4();
    insertMessage.run(id, senderAddress, recipientAddress, senderPk, encryptedPayload, nonce, signature || null);
    console.log(`[MessageRelay] ${senderAddress.substring(0, 16)}… → ${recipientAddress.substring(0, 16)}… (${encryptedPayload.length} bytes)`);
    return {
      messageId: id,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Fetch undelivered messages for a recipient.
   * Returns the messages and marks them as delivered.
   */
  receive(recipientAddress, limit = 100) {
    const rows = getUndelivered.all(recipientAddress, limit);
    const messages = rows.map(r => this._rowToMessage(r));

    // Mark as delivered
    if (rows.length > 0) {
      const ids = JSON.stringify(rows.map(r => r.id));
      markBatchDelivered.run(ids);
      console.log(`[MessageRelay] Delivered ${rows.length} messages to ${recipientAddress.substring(0, 16)}…`);
    }

    return messages;
  }

  /**
   * Peek at undelivered messages without marking them as delivered.
   */
  peek(recipientAddress, limit = 100) {
    const rows = getUndelivered.all(recipientAddress, limit);
    return rows.map(r => this._rowToMessage(r));
  }

  /**
   * Get conversation history between two addresses.
   */
  getConversation(address1, address2, limit = 50, offset = 0) {
    const rows = getConversation.all(address1, address2, address2, address1, limit, offset);
    return rows.map(r => this._rowToMessage(r));
  }

  /**
   * Get conversation history using sender PKs (sealed-sender mode).
   * Matches by sender_pk + recipient_address for both directions.
   */
  getConversationByPk(pk1, addr1, pk2, addr2, limit = 50, offset = 0) {
    const rows = getConversationByPk.all(pk1, addr2, pk2, addr1, limit, offset);
    return rows.map(r => this._rowToMessage(r));
  }

  /**
   * Get list of conversation partners for an address.
   */
  getConversations(address, limit = 50) {
    return getConversationPartners.all(address, address, address, limit);
  }

  /**
   * Get conversation partners using sealed-sender mode.
   * Uses sender_pk for sent-message identification.
   */
  getConversationsByPk(myPk, myAddress, limit = 50) {
    return getConversationPartnersByPk.all(myPk, myPk, myPk, myAddress, limit);
  }

  /**
   * Get a single message by ID.
   */
  getMessage(id) {
    const row = getMessageById.get(id);
    return row ? this._rowToMessage(row) : null;
  }

  /**
   * Acknowledge delivery of specific message IDs.
   */
  acknowledge(messageIds) {
    let count = 0;
    for (const id of messageIds) {
      const info = markDelivered.run(id);
      count += info.changes;
    }
    return count;
  }

  /**
   * Count undelivered messages for an address.
   */
  undeliveredCount(recipientAddress) {
    const row = countUndelivered.get(recipientAddress);
    return row?.count || 0;
  }

  /**
   * Clean up expired messages.
   */
  cleanup() {
    const info = expireOldMessages.run();
    if (info.changes > 0) {
      console.log(`[MessageRelay] Expired ${info.changes} old messages`);
    }
    return info.changes;
  }

  _rowToMessage(row) {
    return {
      messageId: row.id,
      senderAddress: row.sender_address,
      recipientAddress: row.recipient_address,
      senderPk: row.sender_pk,
      encryptedPayload: row.encrypted_payload,
      nonce: row.nonce,
      signature: row.signature || null,
      timestamp: row.timestamp,
      delivered: !!row.delivered,
    };
  }
}

module.exports = new MessageService();
