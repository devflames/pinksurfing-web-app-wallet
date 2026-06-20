/**
 * PinkSurfing KeyVault Express Routes
 * 
 * REST API endpoints for on-chain encrypted wallet backup management.
 * Proxies to the Python KeyVault sidecar for Chia blockchain operations
 * and handles IPFS pinning directly.
 */

const express = require('express');
const router = express.Router();
const keyvaultService = require('../services/keyvault-service');

/**
 * POST /keyvault/create
 * Create a new KeyVault singleton with initial encrypted backup.
 * 
 * Body:
 *   ownerPubkeyHex  - Owner's BLS public key (hex)
 *   encryptedBackup  - Encrypted wallet backup (base64 string)
 *   fundingCoin      - Coin to fund singleton creation { parent_coin_info, puzzle_hash, amount }
 *   feeAmount        - Transaction fee in mojos (optional, default 0)
 *   walletAddress    - User's Chia wallet address (for DB tracking)
 */
router.post('/create', async (req, res) => {
  try {
    const { ownerPubkeyHex, encryptedBackup, fundingCoin, feeAmount, walletAddress } = req.body;

    if (!ownerPubkeyHex || !encryptedBackup || !fundingCoin) {
      return res.json({
        success: false,
        message: 'Missing required fields: ownerPubkeyHex, encryptedBackup, fundingCoin',
      });
    }

    const result = await keyvaultService.createKeyvault({
      ownerPubkeyHex,
      encryptedBackup,
      fundingCoin,
      feeAmount: feeAmount || 0,
      walletAddress,
    });

    res.json(result);
  } catch (e) {
    console.error('[KeyVault] Create error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

// REMOVED: POST /keyvault/update (legacy, accepted ownerSkHex over the wire)
// Use POST /keyvault/prepare-update + POST /keyvault/submit instead (2-step signing).

/**
 * POST /keyvault/recover
 * Recover KeyVault state from the blockchain.
 * Works even if our server has no record — all state is on-chain.
 * 
 * Body:
 *   launcherId - KeyVault singleton launcher ID (hex)
 */
router.post('/recover', async (req, res) => {
  try {
    const { launcherId } = req.body;

    if (!launcherId) {
      return res.json({ success: false, message: 'Missing required field: launcherId' });
    }

    const result = await keyvaultService.recoverKeyvault(launcherId);
    res.json(result);
  } catch (e) {
    console.error('[KeyVault] Recover error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

/**
 * GET /keyvault/status/:launcherId
 * Check KeyVault status (active, pending, not_found, melted).
 */
router.get('/status/:launcherId', async (req, res) => {
  try {
    const { launcherId } = req.params;
    const result = await keyvaultService.getStatus(launcherId);
    res.json(result);
  } catch (e) {
    console.error('[KeyVault] Status error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

// REMOVED: POST /keyvault/transfer (legacy, accepted ownerSkHex over the wire)
// Use POST /keyvault/prepare-transfer + POST /keyvault/submit instead (2-step signing).

/**
 * GET /keyvault/fetch-backup/:cid
 * Fetch an encrypted backup blob from IPFS by CID.
 * Returns the encrypted data for client-side decryption.
 */
router.get('/fetch-backup/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    const result = await keyvaultService.fetchBackup(cid);
    res.json(result);
  } catch (e) {
    console.error('[KeyVault] Fetch backup error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

/**
 * GET /keyvault/lookup/:walletAddress
 * Look up the KeyVault launcher ID for a wallet address.
 */
router.get('/lookup/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const launcherId = keyvaultService.getLauncherIdForWallet(walletAddress);

    if (!launcherId) {
      return res.json({ success: false, message: 'No KeyVault found for this wallet' });
    }

    res.json({ success: true, launcherId });
  } catch (e) {
    console.error('[KeyVault] Lookup error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

/**
 * POST /keyvault/pin
 * Pin an encrypted backup to IPFS only (no singleton deploy).
 * Used for immediate backup before the singleton is deployed.
 * 
 * Body:
 *   encryptedBackup  - Encrypted wallet backup (base64 string)
 *   walletAddress    - User's Chia wallet address (optional, for tracking)
 */
router.post('/pin', async (req, res) => {
  try {
    const { encryptedBackup, walletAddress } = req.body;

    if (!encryptedBackup) {
      return res.json({
        success: false,
        message: 'Missing required field: encryptedBackup',
      });
    }

    const result = await keyvaultService.pinBackupOnly({
      encryptedBackup,
      walletAddress,
    });

    res.json(result);
  } catch (e) {
    console.error('[KeyVault] Pin error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

/**
 * POST /keyvault/create-auto
 * Automatically create a KeyVault with server-funded singleton deployment.
 * The server provides the funding coin so new users with 0 XCH can deploy.
 * 
 * Body:
 *   ownerPubkeyHex  - Owner's BLS public key (hex)
 *   encryptedBackup  - Encrypted wallet backup (base64 string)
 *   walletAddress    - User's Chia wallet address (for DB tracking)
 */
router.post('/create-auto', async (req, res) => {
  try {
    const { ownerPubkeyHex, encryptedBackup, walletAddress } = req.body;

    if (!ownerPubkeyHex || !encryptedBackup) {
      return res.json({
        success: false,
        message: 'Missing required fields: ownerPubkeyHex, encryptedBackup',
      });
    }

    const result = await keyvaultService.createServerFunded({
      ownerPubkeyHex,
      encryptedBackup,
      walletAddress,
    });

    res.json(result);
  } catch (e) {
    console.error('[KeyVault] Auto-create error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

// ── 2-Step Signing Routes (solslot pattern) ──────────────────────
// Client never sends private key. Server prepares unsigned spend,
// client signs locally, client sends signature back.

/**
 * POST /keyvault/prepare-update
 * Prepare an unsigned backup update spend.
 * Returns unsigned coin spends + signing message for client-side signing.
 * 
 * Body:
 *   launcherId       - KeyVault singleton launcher ID (hex)
 *   ownerPubkeyHex   - Owner's BLS public key (hex)
 *   encryptedBackup  - New encrypted wallet backup (base64 string)
 */
router.post('/prepare-update', async (req, res) => {
  try {
    const { launcherId, ownerPubkeyHex, encryptedBackup } = req.body;

    if (!launcherId || !ownerPubkeyHex || !encryptedBackup) {
      return res.json({
        success: false,
        message: 'Missing required fields: launcherId, ownerPubkeyHex, encryptedBackup',
      });
    }

    const result = await keyvaultService.prepareUpdate({
      launcherId,
      ownerPubkeyHex,
      encryptedBackup,
    });

    res.json(result);
  } catch (e) {
    console.error('[KeyVault] Prepare-update error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

/**
 * POST /keyvault/prepare-transfer
 * Prepare an unsigned ownership transfer spend.
 * 
 * Body:
 *   launcherId              - KeyVault singleton launcher ID (hex)
 *   currentOwnerPubkeyHex   - Current owner's BLS public key (hex)
 *   newOwnerPubkeyHex       - New owner's BLS public key (hex)
 */
router.post('/prepare-transfer', async (req, res) => {
  try {
    const { launcherId, currentOwnerPubkeyHex, newOwnerPubkeyHex } = req.body;

    if (!launcherId || !currentOwnerPubkeyHex || !newOwnerPubkeyHex) {
      return res.json({
        success: false,
        message: 'Missing required fields: launcherId, currentOwnerPubkeyHex, newOwnerPubkeyHex',
      });
    }

    const result = await keyvaultService.prepareTransfer({
      launcherId,
      currentOwnerPubkeyHex,
      newOwnerPubkeyHex,
    });

    res.json(result);
  } catch (e) {
    console.error('[KeyVault] Prepare-transfer error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

/**
 * POST /vault/prepare-withdraw
 * Prepare an unsigned vault withdrawal spend.
 * 
 * Body:
 *   launcherId          - KeyVault launcher ID (hex)
 *   destinationAddress  - Chia bech32m address
 *   amount              - Amount in mojos
 *   ownerPubkeyHex      - Owner's BLS public key (hex)
 *   currentCidHashes    - All backup CID hashes (hex array)
 *   feeAmount           - Transaction fee in mojos (optional)
 */
router.post('/vault/prepare-withdraw', async (req, res) => {
  try {
    const { launcherId, destinationAddress, amount, ownerPubkeyHex, currentCidHashes, feeAmount } = req.body;

    if (!launcherId || !destinationAddress || !amount || !ownerPubkeyHex || !currentCidHashes) {
      return res.json({
        success: false,
        message: 'Missing required fields: launcherId, destinationAddress, amount, ownerPubkeyHex, currentCidHashes',
      });
    }

    const result = await keyvaultService.prepareWithdraw({
      launcherId,
      destinationAddress,
      amount,
      ownerPubkeyHex,
      currentCidHashes,
      feeAmount: feeAmount || 0,
    });

    res.json(result);
  } catch (e) {
    console.error('[Vault] Prepare-withdraw error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

/**
 * POST /keyvault/submit
 * Submit a client-signed spend bundle to the blockchain.
 * 
 * Body:
 *   coinSpendsJson  - Serialized coin spends from prepare_* response
 *   signatureHex    - BLS G2Element signature hex from client
 */
router.post('/submit', async (req, res) => {
  try {
    const { coinSpendsJson, signatureHex } = req.body;

    if (!coinSpendsJson || !signatureHex) {
      return res.json({
        success: false,
        message: 'Missing required fields: coinSpendsJson, signatureHex',
      });
    }

    const result = await keyvaultService.submitSigned({
      coinSpendsJson,
      signatureHex,
    });

    res.json(result);
  } catch (e) {
    console.error('[KeyVault] Submit error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

// ── Vault Operations (deposit/withdraw/balance) ──────────────────

/**
 * GET /vault/address/:launcherId
 * Get the vault's deposit address for a given KeyVault launcher ID.
 */
router.get('/vault/address/:launcherId', async (req, res) => {
  try {
    const { launcherId } = req.params;
    const result = await keyvaultService.getVaultAddress(launcherId);
    res.json(result);
  } catch (e) {
    console.error('[Vault] Address error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

/**
 * GET /vault/balance/:launcherId
 * Get the vault's XCH balance (unspent p2_keyvault coins).
 */
router.get('/vault/balance/:launcherId', async (req, res) => {
  try {
    const { launcherId } = req.params;
    const result = await keyvaultService.getVaultBalance(launcherId);
    res.json(result);
  } catch (e) {
    console.error('[Vault] Balance error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

// REMOVED: POST /vault/withdraw (legacy, accepted ownerSkHex over the wire)
// Use POST /vault/prepare-withdraw + POST /keyvault/submit instead (2-step signing).

/**
 * POST /vault/deposit
 * Deposit XCH into the vault. Returns the deposit address and instructions.
 * The client sends XCH to the deposit address using a standard Chia wallet transaction.
 * 
 * Body:
 *   launcherId - KeyVault launcher ID (hex)
 */
router.post('/vault/deposit', async (req, res) => {
  try {
    const { launcherId } = req.body;

    if (!launcherId) {
      return res.json({ success: false, message: 'Missing required field: launcherId' });
    }

    const addressResult = await keyvaultService.getVaultAddress(launcherId);
    if (!addressResult.success) {
      return res.json(addressResult);
    }

    const balanceResult = await keyvaultService.getVaultBalance(launcherId);

    res.json({
      success: true,
      depositAddress: addressResult.depositAddress,
      puzzleHash: addressResult.puzzleHash,
      currentBalance: balanceResult.success ? balanceResult.totalBalance : 0,
      message: `Send XCH to ${addressResult.depositAddress} to deposit into your vault.`,
    });
  } catch (e) {
    console.error('[Vault] Deposit info error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

/**
 * POST /vault/send-to-vault
 * Send XCH from the server wallet to the vault.
 * This is a wallet → vault transfer (deposit). Server signs the standard spend.
 * 
 * Body:
 *   launcherId - KeyVault launcher ID (hex)
 *   amount     - Amount in mojos to send to vault
 *   feeAmount  - Transaction fee in mojos (optional, default 0)
 */
router.post('/vault/send-to-vault', async (req, res) => {
  try {
    const { launcherId, amount, feeAmount } = req.body;

    if (!launcherId || !amount) {
      return res.json({
        success: false,
        message: 'Missing required fields: launcherId, amount',
      });
    }

    const result = await keyvaultService.sendToVault({
      launcherId,
      amount,
      feeAmount: feeAmount || 0,
    });

    res.json(result);
  } catch (e) {
    console.error('[Vault] Send-to-vault error:', e.message);
    res.json({ success: false, message: e.message });
  }
});

/**
 * GET /keyvault/health
 * Health check — reports status of both Node.js and Python sidecar.
 */
router.get('/health', async (req, res) => {
  try {
    const pythonHealth = await keyvaultService.healthCheck();
    res.json({
      success: true,
      nodejs: 'healthy',
      python: pythonHealth,
    });
  } catch (e) {
    res.json({
      success: true,
      nodejs: 'healthy',
      python: { success: false, message: e.message },
    });
  }
});

module.exports = router;
