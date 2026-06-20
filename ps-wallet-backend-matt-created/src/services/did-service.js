/**
 * PinkSurfing DID Service
 * 
 * Node.js proxy to the Python DID sidecar service.
 * Manages DID creation, status lookup, and business card NFT operations.
 * 
 * Architecture:
 *   Flutter App → Node.js (this) → Python DID API (Chia ops)
 *                                → SQLite (local tracking)
 * 
 * Private key NEVER touches the server. All signing is 2-step:
 *   1. Server prepares unsigned spend bundle
 *   2. Client signs locally with BLS synthetic key
 *   3. Client submits signature back
 */

const http = require('http');
const db = require('./db');
const ChiaRpcClient = require('./chia-rpc');
const ipfs = require('./ipfs-service');

const chia = new ChiaRpcClient();

// Python KeyVault sidecar URL (DID endpoints share the same service)
const KEYVAULT_PYTHON_URL = process.env.KEYVAULT_PYTHON_URL || 'http://localhost:5002';

/**
 * Forward a request to the Python sidecar service.
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
      reject(new Error(`Python DID service unavailable: ${e.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Python DID service timeout'));
    });

    req.write(data);
    req.end();
  });
}

// ── DID Operations ──────────────────────────────────────────────────

/**
 * Prepare an unsigned DID creation spend (2-step signing).
 * 
 * @param {Object} params
 * @param {string} params.ownerPubkeyHex - Owner's BLS public key (hex)
 * @param {number} [params.feeAmount=0] - Transaction fee in mojos
 * @param {string} [params.walletAddress] - User's Chia address (for DB tracking)
 * @returns {Object} { success, coinSpendsJson, signingMessageHex, launcherId, didId }
 */
async function prepareCreateDid({ ownerPubkeyHex, feeAmount = 0, walletAddress }) {
  const prepResult = await callPythonService('/did/prepare-create', {
    owner_pubkey_hex: ownerPubkeyHex,
    fee_amount: feeAmount,
  });

  if (!prepResult.success) {
    throw new Error(`Prepare DID creation failed: ${prepResult.message}`);
  }

  const { launcher_id, did_id, coin_spends_json, signing_message_hex,
          full_puzzle_hash, inner_puzzle_hash } = prepResult.data;

  console.log(`[DID] Prepared creation — launcher=${launcher_id}, did=${did_id}`);

  // Store pending DID in DB
  try {
    db.prepare(`
      INSERT OR REPLACE INTO dids (launcher_id, wallet_address, owner_pubkey, inner_puzzle_hash, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
    `).run(launcher_id, walletAddress || '', ownerPubkeyHex, inner_puzzle_hash || '');
  } catch (e) {
    console.warn(`[DID] DB insert warning: ${e.message}`);
  }

  return {
    success: true,
    coinSpendsJson: coin_spends_json,
    signingMessageHex: signing_message_hex,
    launcherId: launcher_id,
    didId: did_id,
    fullPuzzleHash: full_puzzle_hash,
    innerPuzzleHash: inner_puzzle_hash,
  };
}

/**
 * Submit a client-signed DID spend bundle to the blockchain.
 * 
 * @param {Object} params
 * @param {Array} params.coinSpendsJson - Serialized coin spends from prepare_*
 * @param {string} params.signatureHex - BLS G2Element signature hex from client
 * @param {string} [params.launcherId] - DID launcher ID to update status in DB
 * @returns {Object} { success, status }
 */
async function submitDidSigned({ coinSpendsJson, signatureHex, launcherId }) {
  const result = await callPythonService('/did/submit', {
    coin_spends_json: coinSpendsJson,
    signature_hex: signatureHex,
  });

  if (!result.success) {
    return { success: false, message: result.message };
  }

  // Update DB status
  if (launcherId) {
    try {
      db.prepare(`
        UPDATE dids SET status = 'submitted', updated_at = datetime('now')
        WHERE launcher_id = ?
      `).run(launcherId);
    } catch (e) {
      console.warn(`[DID] DB update warning: ${e.message}`);
    }
  }

  return {
    success: true,
    status: result.data,
  };
}

/**
 * Get DID status (checks DB first, then chain).
 * 
 * @param {string} launcherId - DID launcher ID (hex)
 * @returns {Object} { success, status, launcherId, didId, ... }
 */
async function getDidStatus(launcherId) {
  // Check DB first for quick response
  try {
    const row = db.prepare(
      'SELECT launcher_id, wallet_address, owner_pubkey, status FROM dids WHERE launcher_id = ?'
    ).get(launcherId);

    if (row && row.status === 'active') {
      return {
        success: true,
        status: 'active',
        launcherId: row.launcher_id,
        walletAddress: row.wallet_address,
        ownerPubkey: row.owner_pubkey,
      };
    }
  } catch (e) {
    // DB not available, check chain
  }

  // Check chain via Python service
  const result = await callPythonService('/did/status', {
    launcher_id: launcherId,
  });

  if (!result.success) {
    return { success: false, message: result.message };
  }

  // Update DB with chain state
  const chainStatus = result.data.status;
  if (chainStatus === 'active') {
    try {
      db.prepare(`
        UPDATE dids SET status = 'active', updated_at = datetime('now')
        WHERE launcher_id = ?
      `).run(launcherId);
    } catch (e) {
      console.warn(`[DID] DB status update warning: ${e.message}`);
    }
  }

  return {
    success: true,
    ...result.data,
  };
}

/**
 * Look up DID by wallet address (DB lookup).
 * 
 * @param {string} walletAddress - Chia bech32m address
 * @returns {Object|null} DID info or null
 */
function lookupDidByAddress(walletAddress) {
  try {
    const row = db.prepare(
      'SELECT launcher_id, owner_pubkey, status FROM dids WHERE wallet_address = ? AND status != ? ORDER BY created_at DESC LIMIT 1'
    ).get(walletAddress, 'failed');

    if (row) {
      return {
        launcherId: row.launcher_id,
        ownerPubkey: row.owner_pubkey,
        status: row.status,
      };
    }
  } catch (e) {
    console.warn(`[DID] Lookup error: ${e.message}`);
  }
  return null;
}

// ── Business Card Operations ────────────────────────────────────────

/**
 * Mint a business card NFT and send it to the recipient.
 * Server-funded: uses the Chia wallet RPC (same as profile inscription).
 * 
 * Flow:
 *   1. Build card metadata JSON (issuer DID, recipient, profile ref)
 *   2. Pin metadata to IPFS
 *   3. Mint NFT to recipient via Chia wallet RPC
 *   4. Register card in local DB
 *   5. Return NFT info
 * 
 * @param {Object} params
 * @param {string} params.issuerDid - Issuer's DID launcher ID
 * @param {string} params.issuerAddress - Issuer's Chia address
 * @param {string} params.recipientAddress - Recipient's Chia address
 * @param {string} [params.businessName] - Business display name
 * @param {string} [params.profileCid] - IPFS CID of issuer's business profile
 * @param {string} [params.imageCid] - IPFS CID of business logo/avatar
 * @returns {Object} { success, nftLauncherId, cardMetaCid, ... }
 */
/**
 * Prepare an unsigned business card NFT mint (2-step signing).
 *
 * Flow:
 *   1. Server builds card metadata JSON
 *   2. Server pins metadata to IPFS
 *   3. Python sidecar builds unsigned NFT1 spend bundle
 *   4. Returns unsigned spend + signing message to client
 *   5. Client signs with BLS synthetic key and calls /did/submit
 *   6. After submit, client calls /did/cards/register to record it
 *
 * Private key NEVER touches the server.
 */
async function prepareMintBusinessCard({
  ownerPubkeyHex, issuerDid, issuerAddress, recipientAddress,
  businessName, profileCid, imageCid, feeAmount = 0,
}) {
  console.log(`[DID] Preparing business card mint: ${issuerDid} → ${recipientAddress}`);

  // 1. Build card metadata — enrich with issuer's business profile from DB
  const issuerProfile = getBusinessProfile(issuerAddress) || {};
  const cardMeta = {
    type: 'pinksurfing_business_card',
    version: 2,
    issuer_did: issuerDid,
    issuer_address: issuerAddress,
    recipient_address: recipientAddress,
    business_name: businessName || issuerProfile.business_name || null,
    profile_cid: profileCid || null,
    issued_at: new Date().toISOString(),
    // OG profile snapshot (verifiable at mint time)
    issuer_profile: {
      email: issuerProfile.email || null,
      phone: issuerProfile.phone || null,
      website: issuerProfile.website || null,
      street_address: issuerProfile.street_address || null,
      unit: issuerProfile.unit || null,
      city: issuerProfile.city || null,
      state: issuerProfile.state || null,
      country: issuerProfile.country || null,
      postal_code: issuerProfile.postal_code || null,
      logo_cid: issuerProfile.logo_cid || null,
      category: issuerProfile.category || null,
    },
    _meta: {
      app: 'pinksurfing',
      format: 'business_card_nft',
    },
  };

  // 2. Pin metadata to IPFS
  let metaPin;
  try {
    metaPin = await ipfs.pinJson(
      cardMeta,
      `ps-card-${issuerDid.substring(0, 12)}-${Date.now()}`,
    );
    console.log(`[DID] ✓ Card metadata pinned — CID=${metaPin.cid}`);
  } catch (e) {
    console.error(`[DID] Card metadata IPFS pin failed: ${e.message}`);
    throw new Error(`IPFS pin failed: ${e.message}`);
  }

  // 3. Resolve image URI (use existing CID or fall back to metadata)
  let imageUri, imageHash;
  if (imageCid) {
    imageUri = ipfs.ipfsUri(imageCid);
    imageHash = ipfs.sha256(imageCid);
  } else {
    imageUri = metaPin.uri;
    imageHash = ipfs.sha256(JSON.stringify(cardMeta));
  }

  const metadataHash = ipfs.sha256(JSON.stringify(cardMeta));

  // 4. Call Python sidecar to build unsigned NFT mint spend
  const prepResult = await callPythonService('/did/prepare-mint-card', {
    owner_pubkey_hex: ownerPubkeyHex,
    recipient_address: recipientAddress,
    metadata_uris: [metaPin.uri],
    metadata_hash: metadataHash,
    image_uris: [imageUri],
    image_hash: imageHash,
    fee_amount: feeAmount,
  });

  if (!prepResult.success) {
    throw new Error(`Prepare NFT mint failed: ${prepResult.message || 'unknown'}`);
  }

  const { coin_spends_json, signing_message_hex, nft_launcher_id } = prepResult.data;

  console.log(`[DID] ✓ NFT mint prepared — nftLauncherId=${nft_launcher_id}`);

  return {
    coinSpendsJson: coin_spends_json,
    signingMessageHex: signing_message_hex,
    nftLauncherId: nft_launcher_id,
    cardMetaCid: metaPin.cid,
    metadataUri: metaPin.uri,
    imageUri,
    issuerDid,
    recipientAddress,
  };
}

/**
 * Register a business card NFT that was minted.
 * Called after the client mints a business card NFT via WASM.
 * 
 * @param {Object} params
 * @param {string} params.nftLauncherId - NFT launcher ID
 * @param {string} params.issuerDid - Issuer's DID launcher ID
 * @param {string} params.issuerAddress - Issuer's Chia address
 * @param {string} params.recipientAddress - Recipient's Chia address
 * @param {string} params.recipientPuzzleHash - Recipient's puzzle hash
 * @param {string} [params.profileCid] - IPFS CID of business profile
 * @param {string} [params.cardMetaCid] - IPFS CID of card metadata
 */
function registerBusinessCard({
  nftLauncherId, issuerDid, issuerAddress, recipientAddress,
  recipientPuzzleHash, profileCid, cardMetaCid,
}) {
  try {
    db.prepare(`
      INSERT OR REPLACE INTO business_cards 
        (nft_launcher_id, issuer_did, issuer_address, recipient_address, 
         recipient_puzzle_hash, profile_cid, card_meta_cid, status, issued_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
    `).run(
      nftLauncherId, issuerDid, issuerAddress, recipientAddress,
      recipientPuzzleHash, profileCid || null, cardMetaCid || null,
    );

    console.log(`[DID] Registered business card: ${nftLauncherId} from ${issuerDid} to ${recipientAddress}`);
    return { success: true };
  } catch (e) {
    console.warn(`[DID] Register card error: ${e.message}`);
    return { success: false, message: e.message };
  }
}

/**
 * Check if a user holds a business card from a specific issuer.
 * Fast path: DB lookup. Trustless verification requires chain query.
 * 
 * @param {string} holderAddress - Recipient's Chia address
 * @param {string} issuerDid - Issuer's DID launcher ID
 * @returns {Object} { hasCard, card }
 */
function verifyBusinessCard(holderAddress, issuerDid) {
  try {
    const card = db.prepare(`
      SELECT * FROM business_cards 
      WHERE recipient_address = ? AND issuer_did = ? AND status = 'active'
      LIMIT 1
    `).get(holderAddress, issuerDid);

    return {
      hasCard: !!card,
      card: card || null,
    };
  } catch (e) {
    console.warn(`[DID] Verify card error: ${e.message}`);
    return { hasCard: false, card: null };
  }
}

/**
 * List all business cards held by an address.
 */
function getCardsForHolder(holderAddress) {
  try {
    return db.prepare(`
      SELECT * FROM business_cards 
      WHERE recipient_address = ? AND status = 'active'
      ORDER BY issued_at DESC
    `).all(holderAddress);
  } catch (e) {
    console.warn(`[DID] Get cards error: ${e.message}`);
    return [];
  }
}

/**
 * List all business cards issued by a DID.
 */
function getCardsIssuedBy(issuerDid) {
  try {
    return db.prepare(`
      SELECT * FROM business_cards 
      WHERE issuer_did = ? AND status = 'active'
      ORDER BY issued_at DESC
    `).all(issuerDid);
  } catch (e) {
    console.warn(`[DID] Get issued cards error: ${e.message}`);
    return [];
  }
}

/**
 * Revoke a business card (mark as revoked in DB).
 */
function revokeBusinessCard(nftLauncherId, issuerDid) {
  try {
    const result = db.prepare(`
      UPDATE business_cards SET status = 'revoked'
      WHERE nft_launcher_id = ? AND issuer_did = ?
    `).run(nftLauncherId, issuerDid);

    return { success: result.changes > 0 };
  } catch (e) {
    console.warn(`[DID] Revoke card error: ${e.message}`);
    return { success: false, message: e.message };
  }
}

// ── Business Profile Operations ─────────────────────────────────────

/**
 * Save or update a business profile.
 */
function saveBusinessProfile({
  walletAddress, didLauncherId, businessName, email, phone,
  countryCode, website, streetAddress, unit, city, state, country,
  postalCode, logoCid, category, description, ipfsCid, metadataUri,
}) {
  try {
    db.prepare(`
      INSERT OR REPLACE INTO business_profiles
        (wallet_address, did_launcher_id, business_name, email, phone,
         country_code, website, street_address, unit, city, state, country,
         postal_code, logo_cid, category, description, ipfs_cid, metadata_uri, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      walletAddress, didLauncherId || null, businessName || null,
      email || null, phone || null, countryCode || null, website || null,
      streetAddress || null, unit || null, city || null, state || null,
      country || null, postalCode || null, logoCid || null,
      category || null, description || null, ipfsCid || null, metadataUri || null,
    );

    return { success: true };
  } catch (e) {
    console.warn(`[DID] Save profile error: ${e.message}`);
    return { success: false, message: e.message };
  }
}

/**
 * Get a business profile by wallet address.
 */
function getBusinessProfile(walletAddress) {
  try {
    return db.prepare(
      'SELECT * FROM business_profiles WHERE wallet_address = ?'
    ).get(walletAddress) || null;
  } catch (e) {
    console.warn(`[DID] Get profile error: ${e.message}`);
    return null;
  }
}

module.exports = {
  prepareCreateDid,
  submitDidSigned,
  getDidStatus,
  lookupDidByAddress,
  prepareMintBusinessCard,
  registerBusinessCard,
  verifyBusinessCard,
  getCardsForHolder,
  getCardsIssuedBy,
  revokeBusinessCard,
  saveBusinessProfile,
  getBusinessProfile,
};
