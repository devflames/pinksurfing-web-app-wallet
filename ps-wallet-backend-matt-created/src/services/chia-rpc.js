/**
 * Chia RPC Client
 *
 * Talks to a local Chia full node + wallet RPC to:
 * - Mint NFTs with profile metadata (inscriptions)
 * - Query NFTs by address
 * - Submit spend bundles
 *
 * Requires a running Chia node with RPC enabled.
 * Uses self-signed TLS certs from ~/.chia/mainnet/config/ssl/
 */

const https = require('https');
const fs = require('fs');
const { expandHomePath } = require('../utils/paths');

class ChiaRpcClient {
  constructor(config = {}) {
    this.fullNodeHost = config.fullNodeHost || process.env.CHIA_RPC_HOST || 'https://localhost:8555';
    this.walletHost = config.walletHost || process.env.CHIA_WALLET_RPC_HOST || 'https://localhost:9256';
    this.network = config.network || process.env.CHIA_NETWORK || 'testnet10';

    // Load TLS certs for RPC auth
    const certPath = expandHomePath(config.certPath || process.env.CHIA_RPC_CERT_PATH || '');
    const keyPath = expandHomePath(config.keyPath || process.env.CHIA_RPC_KEY_PATH || '');
    const walletCertPath = expandHomePath(config.walletCertPath || process.env.CHIA_WALLET_CERT_PATH || '');
    const walletKeyPath = expandHomePath(config.walletKeyPath || process.env.CHIA_WALLET_KEY_PATH || '');

    this.fullNodeAgent = this._createAgent(certPath, keyPath);
    this.walletAgent = this._createAgent(walletCertPath, walletKeyPath);

    console.log(`[ChiaRPC] Initialized — fullNode=${this.fullNodeHost}, wallet=${this.walletHost}, network=${this.network}`);
  }

  _createAgent(certPath, keyPath) {
    try {
      if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        return new https.Agent({
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
          rejectUnauthorized: false, // Chia uses self-signed certs
        });
      }
    } catch (e) {
      console.warn(`[ChiaRPC] Could not load certs: ${e.message}`);
    }
    // Fallback: no TLS auth (will fail on real Chia RPC but works for mock)
    return new https.Agent({ rejectUnauthorized: false });
  }

  /**
   * Make an RPC call to the Chia full node or wallet.
   */
  async _rpc(host, agent, endpoint, body = {}) {
    const url = new URL(endpoint, host);
    const postData = JSON.stringify(body);

    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.success === false) {
              reject(new Error(json.error || 'RPC call failed'));
            } else {
              resolve(json);
            }
          } catch (e) {
            reject(new Error(`RPC parse error: ${data.substring(0, 200)}`));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy(new Error('RPC timeout'));
      });
      req.write(postData);
      req.end();
    });
  }

  async fullNodeRpc(endpoint, body = {}) {
    return this._rpc(this.fullNodeHost, this.fullNodeAgent, endpoint, body);
  }

  async walletRpc(endpoint, body = {}) {
    return this._rpc(this.walletHost, this.walletAgent, endpoint, body);
  }

  // ── High-level methods ──

  /**
   * Check if the Chia node is reachable and synced.
   */
  async getBlockchainState() {
    try {
      const resp = await this.fullNodeRpc('/get_blockchain_state');
      return {
        synced: resp.blockchain_state?.sync?.synced ?? false,
        peakHeight: resp.blockchain_state?.peak?.height ?? 0,
        network: this.network,
      };
    } catch (e) {
      return { synced: false, peakHeight: 0, network: this.network, error: e.message };
    }
  }

  /**
   * Get wallet balance.
   */
  async getWalletBalance(walletId = 1) {
    const resp = await this.walletRpc('/get_wallet_balance', { wallet_id: walletId });
    return {
      confirmed: resp.wallet_balance?.confirmed_wallet_balance ?? 0,
      spendable: resp.wallet_balance?.spendable_balance ?? 0,
      pending: resp.wallet_balance?.pending_change ?? 0,
    };
  }

  /**
   * Mint a profile NFT on the Chia blockchain.
   *
   * Chia NFTs have three URI fields — all point to IPFS:
   *   - uris:         The NFT image (profile picture)
   *   - meta_uris:    Profile JSON metadata
   *   - license_uris: Dynamic terms/state
   *
   * On profile updates: new image/metadata CIDs → new NFT (old stays on-chain).
   */
  async mintProfileNft({
    walletId = 2,
    targetAddress,
    imageUri,
    imageHash,
    metadataUri,
    metadataHash,
    licenseUri = null,
    licenseHash = null,
    royaltyAddress = null,
  }) {
    console.log(`[ChiaRPC] Minting profile NFT → address=${targetAddress}`);

    const resp = await this.walletRpc('/nft_mint_nft', {
      wallet_id: walletId,
      target_address: targetAddress,
      // Primary content — the profile picture on IPFS
      uris: [imageUri],
      hash: imageHash || this._sha256Placeholder(imageUri),
      // Metadata — the profile JSON on IPFS
      meta_uris: [metadataUri],
      meta_hash: metadataHash || this._sha256Placeholder(metadataUri),
      // License — dynamic profile terms/state on IPFS
      license_uris: [licenseUri || metadataUri],
      license_hash: licenseHash || metadataHash || this._sha256Placeholder(metadataUri),
      royalty_address: royaltyAddress || targetAddress,
      royalty_percentage: 0,
      edition_number: 1,
      edition_count: 1,
      fee: 100, // 100 mojos
    });

    return {
      success: resp.success,
      spendBundle: resp.spend_bundle,
      nftId: resp.nft_id,
    };
  }

  /**
   * Get NFTs owned by a specific address/wallet.
   */
  async getNftsByWallet(walletId = 2) {
    const resp = await this.walletRpc('/nft_get_nfts', {
      wallet_id: walletId,
    });
    return resp.nft_list || [];
  }

  /**
   * Get a specific NFT's info by coin ID.
   */
  async getNftInfo(coinId) {
    const resp = await this.walletRpc('/nft_get_info', {
      coin_id: coinId,
    });
    return resp.nft_info || null;
  }

  _sha256Placeholder(data) {
    // Placeholder — in production, compute actual SHA-256 of the data
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

module.exports = ChiaRpcClient;
