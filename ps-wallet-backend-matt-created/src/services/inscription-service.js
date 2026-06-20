/**
 * Inscription Service
 *
 * Manages profile inscriptions on the Chia blockchain via IPFS.
 *
 * Flow (initial mint):
 * 1. Client sends profile data + wallet pubkey + chia address
 * 2. Service pins profile JSON to IPFS → gets CID
 * 3. Calls Chia wallet RPC to mint an NFT with metadata_uri = ipfs://<CID>
 * 4. Tracks the inscription in SQLite
 *
 * Flow (profile update):
 * 1. Client sends updated profile data
 * 2. Service pins NEW content to IPFS → new CID (old content stays pinned)
 * 3. Mints a new NFT version pointing to the new CID
 *    (Chia NFT metadata is immutable per-coin, so each update = new NFT)
 * 4. On-chain history preserves all previous versions (audit trail)
 *
 * The NFT's data_uri always points to IPFS, making profiles:
 * - Redundant (IPFS is decentralized)
 * - Dynamic (new CID on each update, NFT tracks latest)
 * - Permanent (pinned content stays on IPFS indefinitely)
 * - Verifiable (CID is content-addressed, tamper-proof)
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const ChiaRpcClient = require('./chia-rpc');
const ipfs = require('./ipfs-service');

const chia = new ChiaRpcClient();

// Prepared statements
const insertInscription = db.prepare(`
  INSERT INTO inscriptions (id, wallet_pk, chia_address, profile_data, ipfs_cid, metadata_uri, status)
  VALUES (?, ?, ?, ?, ?, ?, 'pending')
`);

const updateInscriptionStatus = db.prepare(`
  UPDATE inscriptions
  SET nft_coin_id = ?, spend_bundle_json = ?, status = ?, tx_id = ?, error = ?, updated_at = datetime('now')
  WHERE id = ?
`);

const getByAddress = db.prepare(`
  SELECT * FROM inscriptions
  WHERE chia_address = ?
  ORDER BY created_at DESC
  LIMIT 1
`);

const getConfirmedByAddress = db.prepare(`
  SELECT * FROM inscriptions
  WHERE chia_address = ? AND status IN ('confirmed', 'submitted')
  ORDER BY created_at DESC
  LIMIT 1
`);

const getById = db.prepare(`
  SELECT * FROM inscriptions WHERE id = ?
`);

const getAllByAddress = db.prepare(`
  SELECT * FROM inscriptions
  WHERE chia_address = ?
  ORDER BY created_at DESC
`);

const updateProfileIpfs = db.prepare(`
  UPDATE profiles
  SET ipfs_cid = ?, metadata_uri = ?, nft_coin_id = ?, source = ?, updated_at = datetime('now')
  WHERE chia_address = ?
`);

class InscriptionService {
  /**
   * Generate a default SVG avatar from a Chia address.
   * Creates a unique gradient avatar based on the address hash — no external deps.
   */
  generateDefaultAvatar(chiaAddress) {
    const hash = ipfs.sha256(chiaAddress);
    const h1 = parseInt(hash.substring(0, 3), 16) % 360;
    const h2 = (h1 + 120) % 360;
    const h3 = (h1 + 240) % 360;
    const initials = chiaAddress.substring(4, 6).toUpperCase();

    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(${h1},70%,50%)"/>
      <stop offset="50%" style="stop-color:hsl(${h2},70%,45%)"/>
      <stop offset="100%" style="stop-color:hsl(${h3},70%,40%)"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="64" fill="url(#g)"/>
  <text x="256" y="280" font-family="Arial,sans-serif" font-size="180" font-weight="bold" fill="white" text-anchor="middle">${initials}</text>
</svg>`);
  }

  /**
   * Pin an image to IPFS. Accepts a Buffer or base64 string.
   * Returns { cid, uri, gatewayUrl, hash }
   */
  async pinImage({ imageBuffer, imageBase64, filename = 'avatar.png', mimeType = 'image/png' }) {
    let buffer;
    if (imageBuffer) {
      buffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
    } else if (imageBase64) {
      buffer = Buffer.from(imageBase64, 'base64');
    } else {
      throw new Error('Either imageBuffer or imageBase64 is required');
    }

    const pinResult = await ipfs.pinFile(buffer, filename, mimeType);
    const hash = ipfs.sha256Buffer(buffer);
    return { ...pinResult, hash };
  }

  /**
   * Inscribe a profile on-chain by pinning image + metadata to IPFS then minting an NFT.
   *
   * NFT structure:
   *   uris         → profile picture (image on IPFS)
   *   meta_uris    → profile JSON metadata (on IPFS)
   *   license_uris → profile metadata (same as meta_uris, dynamic)
   */
  async inscribeProfile({ walletPk, chiaAddress, profileData, imageBuffer, imageCid }) {
    const id = uuidv4();
    const profileJson = JSON.stringify(profileData);

    // 1. Pin profile metadata JSON to IPFS
    let metaPin;
    try {
      metaPin = await ipfs.pinJson({
        ...profileData,
        _meta: {
          app: 'pinksurfing',
          type: 'profile',
          address: chiaAddress,
          walletPk,
          version: 1,
          timestamp: new Date().toISOString(),
        },
      }, `ps-profile-${chiaAddress.substring(0, 16)}`);
      console.log(`[Inscription] ✓ Metadata IPFS pin — CID=${metaPin.cid}`);
    } catch (e) {
      console.error(`[Inscription] Metadata IPFS pin failed: ${e.message}`);
      metaPin = ipfs._pinAsDataUri(profileJson);
    }

    // 2. Pin image to IPFS (or use existing CID, or generate default avatar)
    let imagePin;
    try {
      if (imageCid) {
        // Reuse an already-pinned image CID
        imagePin = { cid: imageCid, uri: ipfs.ipfsUri(imageCid), gatewayUrl: ipfs.gatewayUrl(imageCid), hash: null };
      } else if (imageBuffer) {
        imagePin = await this.pinImage({ imageBuffer });
      } else {
        // Generate and pin a default avatar
        const svg = this.generateDefaultAvatar(chiaAddress);
        imagePin = await this.pinImage({ imageBuffer: svg, filename: 'avatar.svg', mimeType: 'image/svg+xml' });
        console.log(`[Inscription] Generated default avatar → CID=${imagePin.cid}`);
      }
    } catch (e) {
      console.error(`[Inscription] Image pin failed: ${e.message}, using metadata as fallback`);
      imagePin = { cid: metaPin.cid, uri: metaPin.uri, gatewayUrl: metaPin.gatewayUrl, hash: null };
    }

    // 3. Store pending inscription
    insertInscription.run(id, walletPk, chiaAddress, profileJson, metaPin.cid, metaPin.uri);
    console.log(`[Inscription] Created ${id} — image=${imagePin.cid}, meta=${metaPin.cid}`);

    // 4. Mint NFT: uris=image, meta_uris=metadata, license_uris=metadata
    try {
      const metadataHash = ipfs.sha256(profileJson);
      const result = await chia.mintProfileNft({
        targetAddress: chiaAddress,
        imageUri: imagePin.uri,
        imageHash: imagePin.hash || ipfs.sha256(imagePin.cid),
        metadataUri: metaPin.uri,
        metadataHash: metadataHash,
      });

      if (result.success) {
        updateInscriptionStatus.run(
          result.nftId || null,
          JSON.stringify(result.spendBundle || {}),
          'submitted',
          null,
          null,
          id
        );
        updateProfileIpfs.run(metaPin.cid, metaPin.uri, result.nftId || null, 'on-chain', chiaAddress);

        console.log(`[Inscription] ✓ NFT minted — nftId=${result.nftId}`);
        return {
          success: true,
          inscriptionId: id,
          nftCoinId: result.nftId,
          ipfsCid: metaPin.cid,
          imageCid: imagePin.cid,
          imageUri: imagePin.uri,
          imageGatewayUrl: imagePin.gatewayUrl,
          metadataUri: metaPin.uri,
          gatewayUrl: metaPin.gatewayUrl,
        };
      } else {
        updateInscriptionStatus.run(null, null, 'failed', null, 'Mint returned success=false', id);
        return { success: false, inscriptionId: id, ipfsCid: metaPin.cid, imageCid: imagePin.cid, error: 'NFT mint failed' };
      }
    } catch (e) {
      console.error(`[Inscription] ✗ Mint error: ${e.message}`);
      updateInscriptionStatus.run(null, null, 'ipfs_only', null, e.message, id);
      return {
        success: false,
        inscriptionId: id,
        ipfsCid: metaPin.cid,
        imageCid: imagePin.cid,
        imageUri: imagePin.uri,
        imageGatewayUrl: imagePin.gatewayUrl,
        metadataUri: metaPin.uri,
        gatewayUrl: metaPin.gatewayUrl,
        error: e.message,
        note: 'Pinned to IPFS but NFT mint failed. Will retry on next sync.',
      };
    }
  }

  /**
   * Update an existing profile: pin new content to IPFS, mint new NFT version.
   * The previous version stays on-chain (immutable audit trail).
   */
  async updateProfile({ walletPk, chiaAddress, profileData, imageBuffer, imageCid }) {
    // Find the current version number
    const existing = getAllByAddress.all(chiaAddress);
    const version = existing.length + 1;

    console.log(`[Inscription] Updating profile v${version} for ${chiaAddress}`);
    return this.inscribeProfile({
      walletPk,
      chiaAddress,
      profileData: {
        ...profileData,
        _version: version,
      },
      imageBuffer,
      imageCid,
    });
  }

  /**
   * Sync a profile to IPFS only (no NFT mint).
   * Useful when the Chia node is unavailable or for pre-staging.
   */
  async syncToIpfs({ walletPk, chiaAddress, profileData }) {
    const id = uuidv4();
    const profileJson = JSON.stringify(profileData);

    try {
      const pinResult = await ipfs.pinJson({
        ...profileData,
        _meta: {
          app: 'pinksurfing',
          type: 'profile',
          address: chiaAddress,
          walletPk,
          timestamp: new Date().toISOString(),
        },
      }, `ps-profile-${chiaAddress.substring(0, 16)}`);

      // Store as ipfs_only inscription
      insertInscription.run(id, walletPk, chiaAddress, profileJson, pinResult.cid, pinResult.uri);
      updateInscriptionStatus.run(null, null, 'ipfs_only', null, null, id);

      // Update profile directory
      updateProfileIpfs.run(pinResult.cid, pinResult.uri, null, 'ipfs', chiaAddress);

      console.log(`[Inscription] ✓ IPFS sync — CID=${pinResult.cid}`);
      return {
        success: true,
        inscriptionId: id,
        ipfsCid: pinResult.cid,
        metadataUri: pinResult.uri,
        gatewayUrl: pinResult.gatewayUrl,
        provider: pinResult.provider,
      };
    } catch (e) {
      console.error(`[Inscription] IPFS sync failed: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  /**
   * Fetch the latest profile inscription for an address.
   */
  getProfile(chiaAddress) {
    const row = getByAddress.get(chiaAddress);
    if (!row) return null;
    return this._rowToResult(row);
  }

  /**
   * Get all inscriptions for an address (including pending/failed).
   */
  getHistory(chiaAddress) {
    const rows = getAllByAddress.all(chiaAddress);
    return rows.map(row => this._rowToResult(row));
  }

  /**
   * Get inscription by ID.
   */
  getInscription(id) {
    const row = getById.get(id);
    if (!row) return null;
    return this._rowToResult(row);
  }

  /**
   * Check blockchain state.
   */
  async getChainStatus() {
    const chain = await chia.getBlockchainState();
    const ipfsStatus = await ipfs.status();
    return {
      ...chain,
      ipfs: ipfsStatus,
    };
  }

  _rowToResult(row) {
    return {
      inscriptionId: row.id,
      walletPk: row.wallet_pk,
      chiaAddress: row.chia_address,
      profileData: JSON.parse(row.profile_data),
      ipfsCid: row.ipfs_cid || null,
      metadataUri: row.metadata_uri || null,
      gatewayUrl: row.ipfs_cid ? ipfs.gatewayUrl(row.ipfs_cid) : null,
      nftCoinId: row.nft_coin_id,
      status: row.status,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = new InscriptionService();
