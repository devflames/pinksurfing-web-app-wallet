/**
 * Atomic Swap Service — BTC ↔ XCH
 *
 * Coordinates trustless cross-chain atomic swaps using Hash Time-Locked Contracts (HTLCs).
 * Based on the submarine swap protocol from richardkiss/chiaswap.
 *
 * Flow (Alice has XCH, wants BTC):
 * 1. Alice creates swap offer: generates secret, locks XCH in Chialisp HTLC
 * 2. Bob accepts: sees XCH locked, locks BTC in Bitcoin HTLC (same hash, shorter timeout)
 * 3. Alice claims BTC by revealing preimage on Bitcoin chain
 * 4. Bob uses revealed preimage to sweep XCH on Chia chain
 *
 * The server NEVER holds funds or secrets — it only coordinates metadata.
 */

const crypto = require('crypto');
const db = require('./db');

// ── Prepared Statements ──

const createSwap = db.prepare(`
  INSERT INTO swaps (
    id, initiator_chia_address, initiator_btc_pubkey, direction,
    xch_amount_mojos, btc_amount_sats, secret_hash,
    chia_clawback_pubkey, btc_claim_pubkey,
    chia_timeout_seconds, btc_timeout_blocks,
    status, expires_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', datetime('now', '+1 hour'))
`);

const getSwap = db.prepare(`SELECT * FROM swaps WHERE id = ?`);

const getOpenSwaps = db.prepare(`
  SELECT * FROM swaps
  WHERE status = 'created' AND (expires_at IS NULL OR expires_at > datetime('now'))
  ORDER BY created_at DESC
  LIMIT ?
`);

const getSwapsByAddress = db.prepare(`
  SELECT * FROM swaps
  WHERE initiator_chia_address = ? OR counterparty_chia_address = ?
  ORDER BY created_at DESC
  LIMIT ?
`);

const updateSwapStatus = db.prepare(`
  UPDATE swaps SET status = ?, updated_at = datetime('now') WHERE id = ?
`);

const acceptSwap = db.prepare(`
  UPDATE swaps SET
    counterparty_chia_address = ?,
    counterparty_btc_pubkey = ?,
    chia_sweep_pubkey = ?,
    btc_refund_pubkey = ?,
    btc_htlc_address = ?,
    btc_htlc_redeem_script = ?,
    btc_htlc_funding_txid = ?,
    status = 'accepted',
    updated_at = datetime('now')
  WHERE id = ? AND status = 'created'
`);

const updateChiaHtlc = db.prepare(`
  UPDATE swaps SET
    chia_htlc_puzzle_hash = ?,
    chia_htlc_address = ?,
    chia_htlc_coin_id = ?,
    updated_at = datetime('now')
  WHERE id = ?
`);

// SECURITY: We no longer store the preimage in the DB.
// Participants discover it by monitoring on-chain transactions.
const markClaimed = db.prepare(`
  UPDATE swaps SET
    status = 'claimed',
    updated_at = datetime('now')
  WHERE id = ?
`);

const completeSwap = db.prepare(`
  UPDATE swaps SET status = 'completed', updated_at = datetime('now') WHERE id = ?
`);

const refundSwap = db.prepare(`
  UPDATE swaps SET status = 'refunded', updated_at = datetime('now') WHERE id = ?
`);

class SwapService {
  /**
   * Create a new swap offer.
   *
   * @param {object} params
   * @param {string} params.initiatorChiaAddress - Chia address of the initiator
   * @param {string} params.initiatorBtcPubkey - BTC public key of the initiator
   * @param {string} params.direction - 'xch_to_btc' or 'btc_to_xch'
   * @param {string} params.xchAmountMojos - XCH amount in mojos
   * @param {string} params.btcAmountSats - BTC amount in satoshis
   * @param {string} params.chiaClawbackPubkey - BLS pubkey for Chia HTLC clawback
   * @param {string} params.btcClaimPubkey - secp256k1 pubkey for BTC HTLC claim
   * @param {number} [params.chiaTimeoutSeconds=86400] - Chia HTLC timeout (default 24h)
   * @param {number} [params.btcTimeoutBlocks=144] - BTC HTLC timeout (default ~24h)
   */
  create({
    initiatorChiaAddress,
    initiatorBtcPubkey,
    direction,
    xchAmountMojos,
    btcAmountSats,
    chiaClawbackPubkey,
    btcClaimPubkey,
    chiaTimeoutSeconds = 86400,
    btcTimeoutBlocks = 144,
  }) {
    // Generate swap ID and secret hash
    const id = crypto.randomUUID();
    const secret = crypto.randomBytes(32);
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

    createSwap.run(
      id,
      initiatorChiaAddress,
      initiatorBtcPubkey || null,
      direction,
      xchAmountMojos,
      btcAmountSats,
      secretHash,
      chiaClawbackPubkey || null,
      btcClaimPubkey || null,
      chiaTimeoutSeconds,
      btcTimeoutBlocks
    );

    console.log(`[Swap] Created ${id} — ${direction} ${xchAmountMojos} mojos ↔ ${btcAmountSats} sats`);

    // Return swap data + the secret (ONLY returned to the initiator, NEVER stored on server)
    return {
      swap: this.get(id),
      secret: secret.toString('hex'),
    };
  }

  /**
   * Get a swap by ID.
   */
  get(id) {
    const row = getSwap.get(id);
    return row ? this._rowToSwap(row) : null;
  }

  /**
   * List open swap offers available for acceptance.
   */
  listOpen(limit = 50) {
    const rows = getOpenSwaps.all(Math.min(limit, 200));
    return rows.map(r => this._rowToSwap(r));
  }

  /**
   * List swaps for a specific address (as initiator or counterparty).
   */
  listByAddress(chiaAddress, limit = 50) {
    const rows = getSwapsByAddress.all(chiaAddress, chiaAddress, Math.min(limit, 200));
    return rows.map(r => this._rowToSwap(r));
  }

  /**
   * Accept a swap offer.
   * The counterparty provides their keys and the BTC HTLC details.
   */
  accept(id, {
    counterpartyChiaAddress,
    counterpartyBtcPubkey,
    chiaSweepPubkey,
    btcRefundPubkey,
    btcHtlcAddress,
    btcHtlcRedeemScript,
    btcHtlcFundingTxid,
  }) {
    const swap = this.get(id);
    if (!swap) throw new Error('Swap not found');
    if (swap.status !== 'created') throw new Error(`Cannot accept swap in status: ${swap.status}`);
    if (swap.initiatorChiaAddress === counterpartyChiaAddress) {
      throw new Error('Cannot accept your own swap');
    }

    const result = acceptSwap.run(
      counterpartyChiaAddress,
      counterpartyBtcPubkey || null,
      chiaSweepPubkey || null,
      btcRefundPubkey || null,
      btcHtlcAddress || null,
      btcHtlcRedeemScript || null,
      btcHtlcFundingTxid || null,
      id
    );

    if (result.changes === 0) throw new Error('Failed to accept swap (race condition or invalid state)');

    console.log(`[Swap] Accepted ${id} by ${counterpartyChiaAddress}`);
    return this.get(id);
  }

  /**
   * Update Chia HTLC details after the initiator locks XCH.
   */
  updateChiaHtlcDetails(id, { puzzleHash, address, coinId }) {
    updateChiaHtlc.run(puzzleHash || null, address || null, coinId || null, id);
    return this.get(id);
  }

  /**
   * Mark a swap as claimed (preimage revealed on-chain).
   * SECURITY: We do NOT store the preimage on the server.
   * Participants discover it by monitoring on-chain transactions.
   */
  markClaimed(id) {
    const swap = this.get(id);
    if (!swap) throw new Error('Swap not found');
    if (swap.status !== 'accepted') throw new Error(`Cannot claim swap in status: ${swap.status}`);

    markClaimed.run(id);
    console.log(`[Swap] Marked as claimed: ${id}`);
    return this.get(id);
  }

  /**
   * Mark swap as completed (both sides claimed).
   */
  complete(id) {
    completeSwap.run(id);
    console.log(`[Swap] Completed ${id}`);
    return this.get(id);
  }

  /**
   * Mark swap as refunded (timeout expired, funds returned).
   */
  refund(id) {
    refundSwap.run(id);
    console.log(`[Swap] Refunded ${id}`);
    return this.get(id);
  }

  /**
   * Cancel an unclaimed swap offer.
   */
  cancel(id, requesterAddress) {
    const swap = this.get(id);
    if (!swap) throw new Error('Swap not found');
    if (swap.status !== 'created') throw new Error(`Cannot cancel swap in status: ${swap.status}`);
    if (swap.initiatorChiaAddress !== requesterAddress) throw new Error('Only the initiator can cancel');

    updateSwapStatus.run('cancelled', id);
    console.log(`[Swap] Cancelled ${id}`);
    return this.get(id);
  }

  _rowToSwap(row) {
    return {
      id: row.id,
      initiatorChiaAddress: row.initiator_chia_address,
      initiatorBtcPubkey: row.initiator_btc_pubkey,
      counterpartyChiaAddress: row.counterparty_chia_address,
      counterpartyBtcPubkey: row.counterparty_btc_pubkey,
      direction: row.direction,
      xchAmountMojos: row.xch_amount_mojos,
      btcAmountSats: row.btc_amount_sats,
      secretHash: row.secret_hash,
      // SECURITY: secretPreimage is NEVER stored or returned by the server
      chiaHtlc: {
        puzzleHash: row.chia_htlc_puzzle_hash,
        address: row.chia_htlc_address,
        coinId: row.chia_htlc_coin_id,
        clawbackPubkey: row.chia_clawback_pubkey,
        sweepPubkey: row.chia_sweep_pubkey,
        timeoutSeconds: row.chia_timeout_seconds,
      },
      btcHtlc: {
        address: row.btc_htlc_address,
        redeemScript: row.btc_htlc_redeem_script,
        fundingTxid: row.btc_htlc_funding_txid,
        claimPubkey: row.btc_claim_pubkey,
        refundPubkey: row.btc_refund_pubkey,
        timeoutBlocks: row.btc_timeout_blocks,
      },
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    };
  }
}

module.exports = new SwapService();
