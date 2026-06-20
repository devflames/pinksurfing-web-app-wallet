/**
 * PayChat Service — Pay-per-message with Chia offer files
 *
 * Flow:
 * 1. Recipient sets ask price (mojos per message)
 * 2. Sender creates offer: Python sidecar prepares unsigned XCH send,
 *    sender signs on device, Node stores signed spend bundle as "offer"
 * 3. Recipient responds → Node broadcasts the stored spend bundle on-chain
 * 4. XCH moves from sender to recipient, reply message is sent
 *
 * The server stores signed-but-unbroadcast spend bundles.
 * Private keys NEVER touch the server.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const SIDECAR_URL =
  process.env.KEYVAULT_PYTHON_URL ||
  process.env.KEYVAULT_SIDECAR_URL ||
  'http://localhost:5002';

// ── Prepared Statements ──

const insertOffer = db.prepare(`
  INSERT INTO paychat_offers (
    id, sender_address, recipient_address, amount_mojos, memo,
    coin_spends_json, signature_hex, coin_ids, message_id, status, expires_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now', '+24 hours'))
`);

const getOffer = db.prepare(`SELECT * FROM paychat_offers WHERE id = ?`);

const getOfferByMessage = db.prepare(`
  SELECT * FROM paychat_offers WHERE message_id = ?
`);

const getPendingOffersForRecipient = db.prepare(`
  SELECT * FROM paychat_offers
  WHERE recipient_address = ? AND status = 'pending'
    AND expires_at > datetime('now')
  ORDER BY created_at DESC
  LIMIT ?
`);

const getOffersBySender = db.prepare(`
  SELECT * FROM paychat_offers
  WHERE sender_address = ?
  ORDER BY created_at DESC
  LIMIT ?
`);

const getOffersByRecipient = db.prepare(`
  SELECT * FROM paychat_offers
  WHERE recipient_address = ?
  ORDER BY created_at DESC
  LIMIT ?
`);

const updateOfferStatus = db.prepare(`
  UPDATE paychat_offers
  SET status = ?, tx_status = ?, accepted_at = CASE WHEN ? = 'accepted' THEN datetime('now') ELSE accepted_at END
  WHERE id = ?
`);

const expireOldOffers = db.prepare(`
  UPDATE paychat_offers
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < datetime('now')
`);

// Ask price settings
const upsertAskPrice = db.prepare(`
  INSERT INTO paychat_settings (chia_address, ask_amount_mojos, is_active, updated_at)
  VALUES (?, ?, 1, datetime('now'))
  ON CONFLICT(chia_address) DO UPDATE SET
    ask_amount_mojos = excluded.ask_amount_mojos,
    is_active = excluded.is_active,
    updated_at = datetime('now')
`);

const getAskPrice = db.prepare(`
  SELECT * FROM paychat_settings WHERE chia_address = ?
`);

const deactivatePaychat = db.prepare(`
  UPDATE paychat_settings SET is_active = 0, updated_at = datetime('now')
  WHERE chia_address = ?
`);


class PayChatService {

  /**
   * Prepare a PayChat offer via the Python sidecar.
   * Returns unsigned coin spends + signing message for the sender.
   */
  async prepareOffer({ senderPubkeyHex, recipientAddress, amountMojos, memo, feeAmount = 0 }) {
    const resp = await fetch(`${SIDECAR_URL}/paychat/prepare-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_pubkey_hex: senderPubkeyHex,
        recipient_address: recipientAddress,
        amount_mojos: amountMojos,
        memo: memo || '',
        fee_amount: feeAmount,
      }),
    });

    const data = await resp.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to prepare offer');
    }

    return data.data;
  }

  /**
   * Store a signed offer (sender has signed on device).
   * The spend bundle is NOT broadcast yet — stored until recipient responds.
   */
  storeSignedOffer({
    senderAddress,
    recipientAddress,
    amountMojos,
    memo,
    coinSpendsJson,
    signatureHex,
    coinIds,
    messageId,
  }) {
    const id = uuidv4();

    insertOffer.run(
      id,
      senderAddress,
      recipientAddress,
      amountMojos,
      memo || null,
      JSON.stringify(coinSpendsJson),
      signatureHex,
      JSON.stringify(coinIds),
      messageId || null,
    );

    console.log(`[PayChat] Stored offer ${id}: ${amountMojos} mojos ${senderAddress.substring(0, 12)}… → ${recipientAddress.substring(0, 12)}…`);

    return this.get(id);
  }

  /**
   * Accept an offer — broadcast the stored spend bundle on-chain.
   * Called when the recipient responds to the message.
   */
  async acceptOffer(offerId) {
    const offer = this.get(offerId);
    if (!offer) throw new Error('Offer not found');
    if (offer.status !== 'pending') throw new Error(`Cannot accept offer in status: ${offer.status}`);

    // Check expiration
    if (new Date(offer.expiresAt) < new Date()) {
      updateOfferStatus.run('expired', null, 'expired', offerId);
      throw new Error('Offer has expired');
    }

    // Broadcast via Python sidecar
    const resp = await fetch(`${SIDECAR_URL}/paychat/broadcast-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coin_spends_json: JSON.parse(offer.coinSpendsJson),
        signature_hex: offer.signatureHex,
      }),
    });

    const data = await resp.json();

    if (data.success) {
      updateOfferStatus.run('accepted', 'broadcast', 'accepted', offerId);
      console.log(`[PayChat] Offer ${offerId} accepted and broadcast`);
      return { ...this.get(offerId), txResult: data.data };
    } else {
      // Mark as failed but don't delete — could be coins-already-spent
      updateOfferStatus.run('failed', data.message, 'failed', offerId);
      throw new Error(`Broadcast failed: ${data.message}`);
    }
  }

  /**
   * Check if an offer is still valid (coins unspent).
   */
  async checkOfferValid(offerId) {
    const offer = this.get(offerId);
    if (!offer) throw new Error('Offer not found');

    const resp = await fetch(`${SIDECAR_URL}/paychat/check-coins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coin_ids: JSON.parse(offer.coinIds),
      }),
    });

    const data = await resp.json();
    return data.success && data.data?.valid === true;
  }

  /**
   * Get an offer by ID.
   */
  get(id) {
    const row = getOffer.get(id);
    return row ? this._rowToOffer(row) : null;
  }

  /**
   * Get offer by associated message ID.
   */
  getByMessageId(messageId) {
    const row = getOfferByMessage.get(messageId);
    return row ? this._rowToOffer(row) : null;
  }

  /**
   * Get pending offers for a recipient.
   */
  getPendingForRecipient(recipientAddress, limit = 50) {
    const rows = getPendingOffersForRecipient.all(recipientAddress, limit);
    return rows.map(r => this._rowToOffer(r));
  }

  /**
   * Get offers sent by an address.
   */
  getOffersBySender(senderAddress, limit = 50) {
    const rows = getOffersBySender.all(senderAddress, limit);
    return rows.map(r => this._rowToOffer(r));
  }

  /**
   * Get offers received by an address.
   */
  getOffersForRecipient(recipientAddress, limit = 50) {
    const rows = getOffersByRecipient.all(recipientAddress, limit);
    return rows.map(r => this._rowToOffer(r));
  }

  /**
   * Cancel an offer (only sender can cancel).
   */
  cancelOffer(offerId, requesterAddress) {
    const offer = this.get(offerId);
    if (!offer) throw new Error('Offer not found');
    if (offer.status !== 'pending') throw new Error(`Cannot cancel offer in status: ${offer.status}`);
    if (offer.senderAddress !== requesterAddress) throw new Error('Only sender can cancel');

    updateOfferStatus.run('cancelled', null, 'cancelled', offerId);
    console.log(`[PayChat] Offer ${offerId} cancelled`);
    return this.get(offerId);
  }

  // ── Ask Price Management ──

  /**
   * Set or update the ask price for an address.
   */
  setAskPrice(chiaAddress, amountMojos) {
    upsertAskPrice.run(chiaAddress, amountMojos);
    console.log(`[PayChat] Ask price set: ${chiaAddress.substring(0, 12)}… = ${amountMojos} mojos`);
    return this.getAskPriceForAddress(chiaAddress);
  }

  /**
   * Get the ask price for an address.
   */
  getAskPriceForAddress(chiaAddress) {
    const row = getAskPrice.get(chiaAddress);
    if (!row) return { chiaAddress, askAmountMojos: 0, isActive: false };
    return {
      chiaAddress: row.chia_address,
      askAmountMojos: row.ask_amount_mojos,
      isActive: !!row.is_active,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Deactivate PayChat for an address.
   */
  deactivate(chiaAddress) {
    deactivatePaychat.run(chiaAddress);
    return this.getAskPriceForAddress(chiaAddress);
  }

  /**
   * Clean up expired offers.
   */
  cleanup() {
    const info = expireOldOffers.run();
    if (info.changes > 0) {
      console.log(`[PayChat] Expired ${info.changes} old offers`);
    }
    return info.changes;
  }

  _rowToOffer(row) {
    return {
      id: row.id,
      senderAddress: row.sender_address,
      recipientAddress: row.recipient_address,
      amountMojos: row.amount_mojos,
      memo: row.memo,
      coinSpendsJson: row.coin_spends_json,
      signatureHex: row.signature_hex,
      coinIds: row.coin_ids,
      messageId: row.message_id,
      status: row.status,
      txStatus: row.tx_status,
      createdAt: row.created_at,
      acceptedAt: row.accepted_at,
      expiresAt: row.expires_at,
    };
  }
}

module.exports = new PayChatService();
