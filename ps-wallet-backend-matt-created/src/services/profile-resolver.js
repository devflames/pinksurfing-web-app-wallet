/**
 * Profile Resolver Service
 *
 * Resolves Chia addresses to public profiles. Two sources:
 * 1. Local registry (SQLite profiles table) — fast, always available
 * 2. On-chain NFT lookup — queries Chia full node for profile NFTs
 *
 * The local registry is populated when users:
 * - Register their profile via POST /profiles/register
 * - Have a confirmed inscription (synced from inscriptions table)
 *
 * On-chain resolution queries the blockchain for NFTs owned by an address
 * that contain PinkSurfing profile metadata.
 */

const db = require('./db');
const ChiaRpcClient = require('./chia-rpc');

const chia = new ChiaRpcClient();

// Prepared statements
const upsertProfile = db.prepare(`
  INSERT INTO profiles (chia_address, wallet_pk, username, display_name, bio, avatar_url, profile_data, messaging_pk, nft_coin_id, source, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(chia_address) DO UPDATE SET
    wallet_pk = excluded.wallet_pk,
    username = COALESCE(excluded.username, profiles.username),
    display_name = COALESCE(excluded.display_name, profiles.display_name),
    bio = COALESCE(excluded.bio, profiles.bio),
    avatar_url = COALESCE(excluded.avatar_url, profiles.avatar_url),
    profile_data = excluded.profile_data,
    messaging_pk = COALESCE(excluded.messaging_pk, profiles.messaging_pk),
    nft_coin_id = COALESCE(excluded.nft_coin_id, profiles.nft_coin_id),
    source = excluded.source,
    updated_at = datetime('now')
`);

const getProfileByUsername = db.prepare(`
  SELECT * FROM profiles WHERE username = ?
`);

const checkUsernameOwner = db.prepare(`
  SELECT chia_address FROM profiles WHERE username = ?
`);

const getProfileByAddress = db.prepare(`
  SELECT * FROM profiles WHERE chia_address = ?
`);

const getProfileByPk = db.prepare(`
  SELECT * FROM profiles WHERE wallet_pk = ?
`);

const getProfileByMessagingPk = db.prepare(`
  SELECT * FROM profiles WHERE messaging_pk = ?
`);

const searchProfiles = db.prepare(`
  SELECT * FROM profiles
  WHERE display_name LIKE ? OR chia_address LIKE ? OR username LIKE ?
  ORDER BY updated_at DESC
  LIMIT ?
`);

const getAllProfiles = db.prepare(`
  SELECT chia_address, wallet_pk, display_name, bio, avatar_url, source, updated_at
  FROM profiles
  ORDER BY updated_at DESC
  LIMIT ?
`);

const deleteStaleByWalletPk = db.prepare(`
  DELETE FROM profiles WHERE wallet_pk = ? AND chia_address != ?
`);

const updateFcmToken = db.prepare(`
  UPDATE profiles SET fcm_token = ? WHERE chia_address = ?
`);

const getFcmTokenByAddress = db.prepare(`
  SELECT fcm_token FROM profiles WHERE chia_address = ?
`);

class ProfileResolver {
  /**
   * Register or update a profile in the local directory.
   * This is how wallets announce themselves to the relay.
   */
  register({ chiaAddress, walletPk, displayName, username, bio, avatarUrl, profileData, fcmToken }) {
    // Normalize username
    let cleanUsername = null;
    if (username && typeof username === 'string') {
      cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
      if (cleanUsername.length === 0) cleanUsername = null;
    }

    // Enforce uniqueness: if someone else already claimed this username, reject
    if (cleanUsername) {
      const owner = checkUsernameOwner.get(cleanUsername);
      if (owner && owner.chia_address !== chiaAddress) {
        throw new Error(`Username @${cleanUsername} is already taken`);
      }
    }

    // Network switch cleanup: if same walletPk registered with a different
    // chiaAddress (e.g. mainnet → testnet), delete the stale entry first.
    // One wallet = one active profile on the relay.
    if (walletPk) {
      const removed = deleteStaleByWalletPk.run(walletPk, chiaAddress);
      if (removed.changes > 0) {
        console.log(`[ProfileResolver] Cleaned up ${removed.changes} stale profile(s) for walletPk ${walletPk.substring(0, 16)}…`);
      }
    }

    const profileJson = profileData ? JSON.stringify(profileData) : null;
    const messagingPk = profileData?.messagingPk || null;
    upsertProfile.run(
      chiaAddress,
      walletPk,
      cleanUsername,
      displayName || null,
      bio || null,
      avatarUrl || null,
      profileJson,
      messagingPk,
      null, // nft_coin_id filled by on-chain sync
      'registered'
    );
    // Update FCM token separately (always overwrite with latest)
    if (fcmToken) {
      updateFcmToken.run(fcmToken, chiaAddress);
    }

    console.log(`[ProfileResolver] Registered profile for ${chiaAddress} (${displayName || 'unnamed'}, @${cleanUsername || 'none'})`);
    return this.getByAddress(chiaAddress);
  }

  /**
   * Resolve a profile by Chia address.
   * Checks local registry first, then attempts on-chain lookup.
   */
  async resolve(chiaAddress) {
    // 1. Check local registry
    const local = this.getByAddress(chiaAddress);
    if (local) return { ...local, source: local.source };

    // 2. Try on-chain lookup (if Chia node is available)
    try {
      const onChain = await this._resolveOnChain(chiaAddress);
      if (onChain) return onChain;
    } catch (e) {
      console.log(`[ProfileResolver] On-chain lookup failed for ${chiaAddress}: ${e.message}`);
    }

    return null;
  }

  /**
   * Get profile from local DB by address.
   */
  getByAddress(chiaAddress) {
    const row = getProfileByAddress.get(chiaAddress);
    return row ? this._rowToProfile(row) : null;
  }

  /**
   * Get profile from local DB by public key.
   */
  getByPublicKey(walletPk) {
    const row = getProfileByPk.get(walletPk);
    return row ? this._rowToProfile(row) : null;
  }

  /**
   * Get FCM push token for an address (for sending push notifications).
   */
  getFcmToken(chiaAddress) {
    const row = getFcmTokenByAddress.get(chiaAddress);
    return row?.fcm_token || null;
  }

  /**
   * Get profile from local DB by messaging public key (X25519).
   */
  getByMessagingPk(messagingPk) {
    const row = getProfileByMessagingPk.get(messagingPk);
    return row ? this._rowToProfile(row) : null;
  }

  /**
   * Search profiles by display name or address.
   */
  search(query, limit = 20) {
    const pattern = `%${query}%`;
    const rows = searchProfiles.all(pattern, pattern, pattern, limit);
    return rows.map(r => this._rowToProfile(r));
  }

  /**
   * Get profile by username (exact match, case-insensitive).
   */
  getByUsername(username) {
    const clean = (username || '').trim().toLowerCase().replace(/^@/, '');
    if (!clean) return null;
    const row = getProfileByUsername.get(clean);
    return row ? this._rowToProfile(row) : null;
  }

  /**
   * Check if a username is available.
   * Returns { available: true } or { available: false, owner: 'xch1...' }.
   */
  checkUsername(username, requestingAddress) {
    const clean = (username || '').trim().toLowerCase().replace(/^@/, '');
    if (!clean) return { available: false, reason: 'Username is empty' };
    if (clean.length < 3) return { available: false, reason: 'Username must be at least 3 characters' };
    if (clean.length > 30) return { available: false, reason: 'Username must be 30 characters or less' };
    if (!/^[a-z0-9_]+$/.test(clean)) return { available: false, reason: 'Username can only contain letters, numbers, and underscores' };

    const owner = checkUsernameOwner.get(clean);
    if (!owner) return { available: true };
    // If the requesting address already owns it, it's "available" to them
    if (requestingAddress && owner.chia_address === requestingAddress) return { available: true, owner: owner.chia_address };
    return { available: false, reason: 'Username is already taken' };
  }

  /**
   * List all registered profiles (for directory browsing).
   */
  list(limit = 50) {
    const rows = getAllProfiles.all(limit);
    return rows.map(r => ({
      chiaAddress: r.chia_address,
      walletPk: r.wallet_pk,
      displayName: r.display_name,
      bio: r.bio,
      avatarUrl: r.avatar_url,
      source: r.source,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Query Chia blockchain for profile NFTs owned by an address.
   */
  async _resolveOnChain(chiaAddress) {
    try {
      // Query full node for coins at this address
      // Then filter for NFTs with PinkSurfing profile metadata
      const nfts = await chia.getNftsByWallet();

      for (const nft of nfts) {
        if (!nft.data_uris || nft.data_uris.length === 0) continue;

        const uri = nft.data_uris[0];
        // Check if it's a PinkSurfing profile data URI
        if (uri.startsWith('data:application/json;base64,')) {
          try {
            const jsonStr = Buffer.from(
              uri.replace('data:application/json;base64,', ''),
              'base64'
            ).toString('utf-8');
            const profileData = JSON.parse(jsonStr);

            // Cache it in local DB
            upsertProfile.run(
              chiaAddress,
              profileData.walletPk || '',
              profileData.firstName || profileData.displayName || null,
              profileData.bio || null,
              profileData.avatarUrl || null,
              jsonStr,
              nft.nft_coin_id || null,
              'on-chain'
            );

            console.log(`[ProfileResolver] Resolved on-chain profile for ${chiaAddress}`);
            return this.getByAddress(chiaAddress);
          } catch (_) {
            // Not a valid profile NFT, skip
          }
        }
      }
    } catch (e) {
      throw new Error(`Chain query failed: ${e.message}`);
    }
    return null;
  }

  _rowToProfile(row) {
    let profileData = null;
    try {
      profileData = row.profile_data ? JSON.parse(row.profile_data) : null;
    } catch (_) {}

    return {
      chiaAddress: row.chia_address,
      walletPk: row.wallet_pk,
      username: row.username || null,
      displayName: row.display_name,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      profileData,
      nftCoinId: row.nft_coin_id || null,
      source: row.source,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = new ProfileResolver();
