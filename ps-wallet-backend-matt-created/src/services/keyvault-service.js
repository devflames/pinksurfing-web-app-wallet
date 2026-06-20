/**
 * PinkSurfing KeyVault Service
 * 
 * Node.js proxy to the Python KeyVault sidecar service.
 * Handles IPFS pinning of encrypted backups + forwards blockchain
 * operations to the Python Chia SDK service.
 * 
 * Architecture:
 *   Flutter App → Node.js (this) → Python KeyVault API (Chia ops)
 *                               → IPFS (Pinata) for encrypted blobs
 * 
 * If our server goes down, users can still recover:
 *   1. They know their launcher_id (stored locally on device)
 *   2. Scan Chia blockchain for singleton → get all CID hashes
 *   3. Fetch encrypted blobs from IPFS → decrypt with password
 */

const http = require('http');
const ipfsService = require('./ipfs-service');
const db = require('./db');
const crypto = require('crypto');

// Python KeyVault sidecar URL
const KEYVAULT_PYTHON_URL = process.env.KEYVAULT_PYTHON_URL || 'http://localhost:5002';

/**
 * Forward a request to the Python KeyVault sidecar service.
 */
async function callPythonService(endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, KEYVAULT_PYTHON_URL);
    const data = JSON.stringify(body);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 120000, // 2 min timeout for blockchain ops
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          reject(new Error(`Invalid JSON from Python service: ${responseData}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Python KeyVault service unavailable: ${e.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Python KeyVault service timeout'));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Create a new KeyVault: encrypt backup → pin to IPFS → deploy singleton.
 * 
 * @param {Object} params
 * @param {string} params.ownerPubkeyHex - Owner's BLS public key (hex)
 * @param {Buffer|string} params.encryptedBackup - Encrypted wallet backup blob
 * @param {Object} params.fundingCoin - Coin to fund singleton creation
 * @param {number} params.feeAmount - Transaction fee in mojos
 * @param {string} params.walletAddress - User's Chia wallet address (for DB tracking)
 * @returns {Object} { success, launcherId, ipfsCid, gatewayUrl }
 */
async function createKeyvault({ ownerPubkeyHex, encryptedBackup, fundingCoin, feeAmount = 0, walletAddress }) {
  // 1. Pin encrypted backup to IPFS
  const backupJson = {
    type: 'ps-keyvault-backup',
    version: 1,
    timestamp: new Date().toISOString(),
    encrypted_data: typeof encryptedBackup === 'string' 
      ? encryptedBackup 
      : encryptedBackup.toString('base64'),
  };

  const pinResult = await ipfsService.pinJson(backupJson, `keyvault-backup-${Date.now()}`);

  if (!pinResult || !pinResult.cid) {
    throw new Error('Failed to pin encrypted backup to IPFS');
  }

  const ipfsCid = pinResult.cid;
  console.log(`[KeyVault] Pinned backup to IPFS: ${ipfsCid}`);

  // 2. Deploy singleton on Chia blockchain via Python service
  const deployResult = await callPythonService('/keyvault/deploy', {
    owner_pubkey_hex: ownerPubkeyHex,
    initial_cid: ipfsCid,
    funding_coin: fundingCoin,
    fee_amount: feeAmount,
  });

  if (!deployResult.success) {
    throw new Error(`Singleton deploy failed: ${deployResult.message}`);
  }

  const launcherId = deployResult.data.launcher_id;
  console.log(`[KeyVault] Deployed singleton: ${launcherId}`);

  // 3. Store in local DB for tracking
  try {
    db.prepare(`
      INSERT INTO keyvaults (launcher_id, wallet_address, owner_pubkey, latest_cid, encrypted_data, backup_count, status, created_at)
      VALUES (?, ?, ?, ?, ?, 1, 'pending', datetime('now'))
    `).run(launcherId, walletAddress || '', ownerPubkeyHex, ipfsCid, typeof encryptedBackup === 'string' ? encryptedBackup : encryptedBackup.toString('base64'));
  } catch (e) {
    console.warn(`[KeyVault] DB insert warning: ${e.message}`);
  }

  return {
    success: true,
    launcherId,
    ipfsCid,
    gatewayUrl: pinResult.gatewayUrl || `https://gateway.pinata.cloud/ipfs/${ipfsCid}`,
  };
}

// REMOVED: updateBackup() — legacy function that accepted ownerSkHex.
// Use prepareUpdate() + submitSigned() instead (2-step signing, key never leaves device).

/**
 * Recover KeyVault from the blockchain — no server state needed.
 * 
 * @param {string} launcherId - KeyVault singleton launcher ID (hex)
 * @returns {Object} { success, state: { owner_pubkey, all_cid_hashes, latest_cid_hash, ... } }
 */
async function recoverKeyvault(launcherId) {
  const result = await callPythonService('/keyvault/recover', {
    launcher_id: launcherId,
  });

  if (!result.success) {
    // Fallback: try local DB if chain recovery fails (e.g. singleton pending confirmation)
    try {
      const row = db.prepare(
        'SELECT owner_pubkey, latest_cid, backup_count, status FROM keyvaults WHERE launcher_id = ?'
      ).get(launcherId);
      if (row && row.latest_cid) {
        console.warn(`[KeyVault] Chain recovery failed, using DB fallback for ${launcherId}`);
        const isHex64 = /^[0-9a-f]{64}$/i.test(row.latest_cid);
        const cidHash = isHex64
          ? row.latest_cid
          : crypto.createHash('sha256').update(row.latest_cid).digest('hex');
        const response = {
          success: true,
          state: {
            owner_pubkey: row.owner_pubkey,
            backup_count: row.backup_count || 1,
            latest_cid_hash: cidHash,
            latest_cid: row.latest_cid,
            all_cid_hashes: [cidHash],
            status: row.status || 'pending',
            source: 'db_fallback',
          },
        };
        // Include encrypted_data if available in DB (eliminates IPFS dependency)
        if (row.encrypted_data) {
          response.state.encrypted_data = row.encrypted_data;
          console.log(`[KeyVault] DB fallback includes encrypted_data for ${launcherId}`);
        }
        return response;
      }
    } catch (dbErr) {
      console.warn(`[KeyVault] DB fallback also failed: ${dbErr.message}`);
    }
    return { success: false, message: result.message };
  }

  // Also update our local DB if we have one
  try {
    const existing = db.prepare('SELECT launcher_id FROM keyvaults WHERE launcher_id = ?').get(launcherId);
    if (existing) {
      db.prepare(`
        UPDATE keyvaults SET owner_pubkey = ?, latest_cid = ?, backup_count = ?, status = 'active', updated_at = datetime('now')
        WHERE launcher_id = ?
      `).run(
        result.data.owner_pubkey,
        result.data.latest_cid_hash,
        result.data.backup_count,
        launcherId
      );
    }
  } catch (e) {
    console.warn(`[KeyVault] DB recovery sync warning: ${e.message}`);
  }

  // Augment chain result with encrypted_data from DB if available
  try {
    const dbRow = db.prepare('SELECT encrypted_data, latest_cid FROM keyvaults WHERE launcher_id = ?').get(launcherId);
    if (dbRow && dbRow.encrypted_data) {
      result.data.encrypted_data = dbRow.encrypted_data;
      result.data.latest_cid = dbRow.latest_cid;
      console.log(`[KeyVault] Augmented chain recovery with DB encrypted_data for ${launcherId}`);
    }
  } catch (e) {
    // DB augmentation is best-effort
  }

  return {
    success: true,
    state: result.data,
  };
}

/**
 * Check KeyVault status (active, pending, not_found, melted).
 */
async function getStatus(launcherId) {
  // Check DB first for quick response
  try {
    const row = db.prepare('SELECT status, latest_cid, backup_count FROM keyvaults WHERE launcher_id = ?').get(launcherId);
    if (row && row.status === 'active') {
      return {
        success: true,
        status: 'active',
        latestCid: row.latest_cid,
        backupCount: row.backup_count,
      };
    }
  } catch (e) {
    // DB not available, check chain directly
  }

  // Check chain via Python service
  const result = await callPythonService('/keyvault/status', {
    launcher_id: launcherId,
  });

  if (!result.success) {
    return { success: false, message: result.message };
  }

  // Update DB if status changed to active
  if (result.data.status === 'active') {
    try {
      db.prepare(`
        UPDATE keyvaults SET status = 'active', updated_at = datetime('now')
        WHERE launcher_id = ?
      `).run(launcherId);
    } catch (e) {
      // ignore
    }
  }

  return {
    success: true,
    status: result.data.status,
  };
}

// REMOVED: transferOwnership() — legacy function that accepted ownerSkHex.
// Use prepareTransfer() + submitSigned() instead (2-step signing, key never leaves device).

/**
 * Fetch an encrypted backup blob — checks our DB first, IPFS as fallback.
 * Accepts either a CID, a launcher_id, or a CID hash.
 */
async function fetchBackup(cidOrLauncher) {
  // 1. Try DB first (by launcher_id or CID match)
  try {
    let row = db.prepare(
      'SELECT launcher_id, latest_cid, encrypted_data FROM keyvaults WHERE launcher_id = ? AND encrypted_data IS NOT NULL'
    ).get(cidOrLauncher);

    if (!row) {
      row = db.prepare(
        'SELECT launcher_id, latest_cid, encrypted_data FROM keyvaults WHERE latest_cid = ? AND encrypted_data IS NOT NULL'
      ).get(cidOrLauncher);
    }

    if (row && row.encrypted_data) {
      console.log(`[KeyVault] Fetched backup from DB for ${cidOrLauncher}`);
      return {
        success: true,
        cid: row.latest_cid,
        data: {
          type: 'ps-keyvault-backup',
          version: 1,
          encrypted_data: row.encrypted_data,
          source: 'database',
        },
      };
    }
  } catch (e) {
    console.warn(`[KeyVault] DB backup lookup failed: ${e.message}`);
  }

  // 2. Reject hex hashes — they are NOT valid IPFS CIDs
  const isHex64 = /^[0-9a-f]{64}$/i.test(cidOrLauncher);
  if (isHex64) {
    console.warn(`[KeyVault] Cannot fetch from IPFS: ${cidOrLauncher} is a hash, not a CID`);
    return { success: false, message: `Value is a CID hash, not a fetchable CID` };
  }

  // 3. Fallback to IPFS gateway
  try {
    console.log(`[KeyVault] Fetching backup from IPFS: ${cidOrLauncher}`);
    const nodeFetch = (await import('node-fetch')).default;
    const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${cidOrLauncher}`;
    const response = await nodeFetch(gatewayUrl, { timeout: 15000 });

    if (!response.ok) {
      console.error(`[KeyVault] IPFS fetch failed: ${response.status} ${response.statusText}`);
      return { success: false, message: `IPFS fetch failed: ${response.status}` };
    }

    const data = await response.json();
    console.log(`[KeyVault] Got backup from IPFS (${cidOrLauncher})`);
    return { success: true, cid: cidOrLauncher, data };
  } catch (e) {
    console.error(`[KeyVault] IPFS fetch error: ${e.message}`);
    return { success: false, message: `IPFS fetch error: ${e.message}` };
  }
}

// Legacy alias
async function fetchBackupFromIpfs(cid) {
  return fetchBackup(cid);
}

/**
 * Get the KeyVault launcher ID for a wallet address from our DB.
 */
function getLauncherIdForWallet(walletAddress) {
  try {
    const row = db.prepare('SELECT launcher_id FROM keyvaults WHERE wallet_address = ? ORDER BY created_at DESC LIMIT 1').get(walletAddress);
    return row ? row.launcher_id : null;
  } catch (e) {
    return null;
  }
}

/**
 * Check if Python KeyVault sidecar is healthy.
 */
async function healthCheck() {
  try {
    return new Promise((resolve) => {
      const url = new URL('/keyvault/health', KEYVAULT_PYTHON_URL);
      http.get(url.toString(), { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ success: false, message: 'Invalid response' });
          }
        });
      }).on('error', () => {
        resolve({ success: false, message: 'Python service not reachable' });
      });
    });
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Pin an encrypted backup to IPFS only (no singleton deploy).
 * Used for immediate backup before the singleton is deployed.
 * 
 * @param {Object} params
 * @param {string} params.encryptedBackup - Encrypted wallet backup (base64 string)
 * @param {string} params.walletAddress - User's wallet address (for DB tracking)
 * @returns {Object} { success, ipfsCid, gatewayUrl }
 */
async function pinBackupOnly({ encryptedBackup, walletAddress }) {
  const backupJson = {
    type: 'ps-keyvault-backup',
    version: 1,
    timestamp: new Date().toISOString(),
    encrypted_data: typeof encryptedBackup === 'string'
      ? encryptedBackup
      : encryptedBackup.toString('base64'),
  };

  const pinResult = await ipfsService.pinJson(backupJson, `keyvault-backup-${Date.now()}`);

  if (!pinResult || !pinResult.cid) {
    throw new Error('Failed to pin encrypted backup to IPFS');
  }

  console.log(`[KeyVault] Pinned backup to IPFS (no deploy): ${pinResult.cid}`);

  return {
    success: true,
    ipfsCid: pinResult.cid,
    gatewayUrl: pinResult.gatewayUrl || `https://gateway.pinata.cloud/ipfs/${pinResult.cid}`,
  };
}

/**
 * Create a KeyVault with server-funded singleton deployment.
 * The server provides the funding coin so new users with 0 XCH can still deploy.
 * 
 * @param {Object} params
 * @param {string} params.ownerPubkeyHex - Owner's BLS public key (hex)
 * @param {string} params.encryptedBackup - Encrypted wallet backup (base64 string)
 * @param {string} params.walletAddress - User's Chia wallet address
 * @returns {Object} { success, launcherId, ipfsCid, gatewayUrl }
 */
async function createServerFunded({ ownerPubkeyHex, encryptedBackup, walletAddress }) {
  // 1. Pin encrypted backup to IPFS
  const backupJson = {
    type: 'ps-keyvault-backup',
    version: 1,
    timestamp: new Date().toISOString(),
    encrypted_data: typeof encryptedBackup === 'string'
      ? encryptedBackup
      : encryptedBackup.toString('base64'),
  };

  const pinResult = await ipfsService.pinJson(backupJson, `keyvault-backup-${Date.now()}`);

  if (!pinResult || !pinResult.cid) {
    throw new Error('Failed to pin encrypted backup to IPFS');
  }

  const ipfsCid = pinResult.cid;
  console.log(`[KeyVault] Pinned backup to IPFS: ${ipfsCid}`);

  // 2. Deploy singleton using server's wallet as funding source
  let deployResult;
  try {
    deployResult = await callPythonService('/keyvault/deploy-server-funded', {
      owner_pubkey_hex: ownerPubkeyHex,
      initial_cid: ipfsCid,
      fee_amount: 0,
    });
  } catch (pyErr) {
    console.warn(`[KeyVault] Python sidecar unavailable: ${pyErr.message}`);
    deployResult = { success: false, message: pyErr.message };
  }

  if (!deployResult.success) {
    // Singleton deploy failed but IPFS pin succeeded — return CID so client can still recover
    console.warn(`[KeyVault] Server-funded deploy failed: ${deployResult.message}`);
    return {
      success: true,
      deployPending: true,
      launcherId: null,
      ipfsCid,
      gatewayUrl: pinResult.gatewayUrl || `https://gateway.pinata.cloud/ipfs/${ipfsCid}`,
      message: 'Backup pinned to IPFS. Singleton deploy pending.',
    };
  }

  const launcherId = deployResult.data.launcher_id;
  console.log(`[KeyVault] Server-funded deploy: ${launcherId}`);

  // 3. Store in local DB
  try {
    db.prepare(`
      INSERT INTO keyvaults (launcher_id, wallet_address, owner_pubkey, latest_cid, encrypted_data, backup_count, status, created_at)
      VALUES (?, ?, ?, ?, ?, 1, 'active', datetime('now'))
    `).run(launcherId, walletAddress || '', ownerPubkeyHex, ipfsCid, typeof encryptedBackup === 'string' ? encryptedBackup : encryptedBackup.toString('base64'));
  } catch (e) {
    console.warn(`[KeyVault] DB insert warning: ${e.message}`);
  }

  return {
    success: true,
    deployPending: false,
    launcherId,
    ipfsCid,
    gatewayUrl: pinResult.gatewayUrl || `https://gateway.pinata.cloud/ipfs/${ipfsCid}`,
  };
}

// ── 2-Step Signing (solslot pattern) ─────────────────────────────
// Client never sends private key. Server prepares unsigned spend,
// client signs locally with blsSign(), client sends signature back.

/**
 * Prepare an unsigned backup update spend.
 * Pins new backup to IPFS, recovers current state from chain,
 * then asks Python sidecar to build the unsigned coin spend.
 * 
 * @param {Object} params
 * @param {string} params.launcherId - KeyVault singleton launcher ID (hex)
 * @param {string} params.ownerPubkeyHex - Owner's BLS public key (hex)
 * @param {string} params.encryptedBackup - New encrypted backup (base64)
 * @returns {Object} { success, coinSpendsJson, signingMessageHex, newCid, backupCount }
 */
async function prepareUpdate({ launcherId, ownerPubkeyHex, encryptedBackup }) {
  // 1. Pin new encrypted backup to IPFS
  const backupJson = {
    type: 'ps-keyvault-backup',
    version: 1,
    timestamp: new Date().toISOString(),
    encrypted_data: typeof encryptedBackup === 'string'
      ? encryptedBackup
      : encryptedBackup.toString('base64'),
  };

  const pinResult = await ipfsService.pinJson(backupJson, `keyvault-backup-${launcherId.substring(0, 8)}-${Date.now()}`);

  if (!pinResult || !pinResult.cid) {
    throw new Error('Failed to pin updated backup to IPFS');
  }

  const newCid = pinResult.cid;

  // 2. Get current state from chain
  const recoverResult = await callPythonService('/keyvault/recover', {
    launcher_id: launcherId,
  });

  if (!recoverResult.success) {
    throw new Error(`Cannot recover current state: ${recoverResult.message}`);
  }

  const currentCidHashes = recoverResult.data.all_cid_hashes;

  // 3. Prepare unsigned spend via Python sidecar
  const prepResult = await callPythonService('/keyvault/prepare-update', {
    launcher_id: launcherId,
    owner_pubkey_hex: ownerPubkeyHex,
    current_cid_hashes: currentCidHashes,
    new_cid: newCid,
    fee_amount: 0,
  });

  if (!prepResult.success) {
    throw new Error(`Prepare update failed: ${prepResult.message}`);
  }

  // 4. Store encrypted_data in DB (best-effort)
  try {
    db.prepare(`
      UPDATE keyvaults SET encrypted_data = ?, updated_at = datetime('now')
      WHERE launcher_id = ?
    `).run(typeof encryptedBackup === 'string' ? encryptedBackup : encryptedBackup.toString('base64'), launcherId);
  } catch (e) {
    console.warn(`[KeyVault] DB update warning: ${e.message}`);
  }

  return {
    success: true,
    coinSpendsJson: prepResult.data.coin_spends_json,
    signingMessageHex: prepResult.data.signing_message_hex,
    newCid,
    backupCount: prepResult.data.backup_count,
    gatewayUrl: pinResult.gatewayUrl || `https://gateway.pinata.cloud/ipfs/${newCid}`,
  };
}

/**
 * Prepare an unsigned ownership transfer spend.
 * 
 * @param {Object} params
 * @param {string} params.launcherId - KeyVault singleton launcher ID (hex)
 * @param {string} params.currentOwnerPubkeyHex - Current owner's BLS public key (hex)
 * @param {string} params.newOwnerPubkeyHex - New owner's BLS public key (hex)
 * @returns {Object} { success, coinSpendsJson, signingMessageHex }
 */
async function prepareTransfer({ launcherId, currentOwnerPubkeyHex, newOwnerPubkeyHex }) {
  // Get current state from chain
  const recoverResult = await callPythonService('/keyvault/recover', {
    launcher_id: launcherId,
  });

  if (!recoverResult.success) {
    throw new Error(`Cannot recover state for transfer: ${recoverResult.message}`);
  }

  const prepResult = await callPythonService('/keyvault/prepare-transfer', {
    launcher_id: launcherId,
    current_owner_pubkey_hex: currentOwnerPubkeyHex,
    new_owner_pubkey_hex: newOwnerPubkeyHex,
    current_state: {
      backups_merkle_root: recoverResult.data.backups_merkle_root,
      backup_count: recoverResult.data.backup_count,
      latest_cid_hash: recoverResult.data.latest_cid_hash,
    },
    fee_amount: 0,
  });

  if (!prepResult.success) {
    throw new Error(`Prepare transfer failed: ${prepResult.message}`);
  }

  return {
    success: true,
    coinSpendsJson: prepResult.data.coin_spends_json,
    signingMessageHex: prepResult.data.signing_message_hex,
  };
}

/**
 * Prepare an unsigned vault withdrawal spend.
 * 
 * @param {Object} params
 * @param {string} params.launcherId - KeyVault launcher ID (hex)
 * @param {string} params.destinationAddress - Chia bech32m address
 * @param {number} params.amount - Amount in mojos
 * @param {string} params.ownerPubkeyHex - Owner's BLS public key (hex)
 * @param {string[]} params.currentCidHashes - All backup CID hashes (hex)
 * @param {number} [params.feeAmount=0] - Transaction fee in mojos
 * @returns {Object} { success, coinSpendsJson, signingMessageHex, amount, fee, destination, coinsSpent }
 */
async function prepareWithdraw({ launcherId, destinationAddress, amount, ownerPubkeyHex, currentCidHashes, feeAmount = 0 }) {
  const prepResult = await callPythonService('/vault/prepare-withdraw', {
    launcher_id: launcherId,
    destination_address: destinationAddress,
    amount,
    owner_pubkey_hex: ownerPubkeyHex,
    current_cid_hashes: currentCidHashes,
    fee_amount: feeAmount,
  });

  if (!prepResult.success) {
    return { success: false, message: prepResult.message };
  }

  return {
    success: true,
    coinSpendsJson: prepResult.data.coin_spends_json,
    signingMessageHex: prepResult.data.signing_message_hex,
    amount: prepResult.data.amount,
    fee: prepResult.data.fee,
    destination: prepResult.data.destination,
    coinsSpent: prepResult.data.coins_spent,
  };
}

/**
 * Submit a client-signed spend bundle to the blockchain.
 * 
 * @param {Object} params
 * @param {Array} params.coinSpendsJson - Serialized coin spends from prepare_*
 * @param {string} params.signatureHex - BLS G2Element signature hex from client
 * @returns {Object} { success, status }
 */
async function submitSigned({ coinSpendsJson, signatureHex }) {
  const result = await callPythonService('/keyvault/submit', {
    coin_spends_json: coinSpendsJson,
    signature_hex: signatureHex,
  });

  if (!result.success) {
    return { success: false, message: result.message };
  }

  return {
    success: true,
    status: result.data,
  };
}

// ── Vault Operations (deposit/withdraw/balance) ──────────────────

/**
 * Get the vault's deposit address for a given KeyVault launcher ID.
 * 
 * @param {string} launcherId - KeyVault singleton launcher ID (hex)
 * @returns {Object} { success, depositAddress, puzzleHash, launcherId }
 */
async function getVaultAddress(launcherId) {
  const result = await callPythonService('/vault/address', {
    launcher_id: launcherId,
  });

  if (!result.success) {
    return { success: false, message: result.message };
  }

  return {
    success: true,
    depositAddress: result.data.deposit_address,
    puzzleHash: result.data.puzzle_hash,
    launcherId: result.data.launcher_id,
  };
}

/**
 * Get the vault's XCH balance (unspent p2_keyvault coins).
 * 
 * @param {string} launcherId - KeyVault singleton launcher ID (hex)
 * @returns {Object} { success, totalBalance, coinCount, coins, depositAddress }
 */
async function getVaultBalance(launcherId) {
  const result = await callPythonService('/vault/balance', {
    launcher_id: launcherId,
  });

  if (!result.success) {
    return { success: false, message: result.message };
  }

  return {
    success: true,
    totalBalance: result.data.total_balance,
    coinCount: result.data.coin_count,
    coins: result.data.coins,
    depositAddress: result.data.deposit_address,
  };
}

// REMOVED: withdrawFromVault() — legacy function that accepted ownerSkHex.
// Use prepareWithdraw() + submitSigned() instead (2-step signing, key never leaves device).

/**
 * Send XCH from the server wallet to the vault deposit address.
 * 
 * @param {Object} params
 * @param {string} params.launcherId - KeyVault launcher ID (hex)
 * @param {number} params.amount - Amount in mojos to deposit
 * @param {number} [params.feeAmount=0] - Transaction fee in mojos
 * @returns {Object} { success, amount, fee, vaultAddress, walletAddress, coinsSpent }
 */
async function sendToVault({ launcherId, amount, feeAmount = 0 }) {
  const result = await callPythonService('/vault/send-to-vault', {
    launcher_id: launcherId,
    amount,
    fee_amount: feeAmount,
  });

  if (!result.success) {
    return { success: false, message: result.message };
  }

  return {
    success: true,
    amount: result.data.amount,
    fee: result.data.fee,
    vaultAddress: result.data.vault_address,
    walletAddress: result.data.wallet_address,
    coinsSpent: result.data.coins_spent,
  };
}

module.exports = {
  createKeyvault,
  recoverKeyvault,
  getStatus,
  fetchBackup,
  fetchBackupFromIpfs,
  getLauncherIdForWallet,
  healthCheck,
  pinBackupOnly,
  createServerFunded,
  getVaultAddress,
  getVaultBalance,
  sendToVault,
  // 2-step signing (solslot pattern)
  prepareUpdate,
  prepareTransfer,
  prepareWithdraw,
  submitSigned,
};
