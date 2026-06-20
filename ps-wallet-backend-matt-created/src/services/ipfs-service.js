/**
 * IPFS Pinning Service
 *
 * Pins profile data (JSON) to IPFS and returns a content-addressed CID.
 * Each profile update creates a new immutable CID — the Chia NFT metadata URI
 * then points to ipfs://<CID>.
 *
 * Supports multiple backends:
 * 1. Pinata (recommended for production — free tier, reliable)
 * 2. Local IPFS node (for development)
 * 3. Fallback: data URI (inline, no pinning — works without any IPFS setup)
 *
 * The CID is deterministic: same content → same CID, so duplicate pins are free.
 *
 * Config via .env:
 *   IPFS_PROVIDER=pinata|local|data_uri
 *   PINATA_JWT=your-jwt-token
 *   IPFS_LOCAL_API=http://localhost:5001
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

class IpfsService {
  constructor() {
    this.provider = (process.env.IPFS_PROVIDER || 'data_uri').toLowerCase();
    this.pinataJwt = process.env.PINATA_JWT || '';
    this.localApiUrl = process.env.IPFS_LOCAL_API || 'http://localhost:5001';

    if (this.provider === 'pinata' && !this.pinataJwt) {
      console.warn('[IPFS] Pinata selected but PINATA_JWT is empty — falling back to data_uri');
      this.provider = 'data_uri';
    }

    console.log(`[IPFS] Provider: ${this.provider}`);
  }

  /**
   * Pin JSON data to IPFS.
   * Returns { cid, uri, size, provider }
   */
  async pinJson(data, name = 'pinksurfing-profile') {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    const hash = crypto.createHash('sha256').update(jsonStr).digest('hex');

    console.log(`[IPFS] Pinning ${jsonStr.length} bytes (sha256=${hash.substring(0, 16)}…) via ${this.provider}`);

    switch (this.provider) {
      case 'pinata':
        return this._pinViaPinata(jsonStr, name);
      case 'local':
        return this._pinViaLocalNode(jsonStr, name);
      case 'data_uri':
      default:
        return this._pinAsDataUri(jsonStr);
    }
  }

  /**
   * Generate the IPFS gateway URL for a CID.
   */
  gatewayUrl(cid) {
    if (cid.startsWith('data:')) return cid; // Already a data URI
    // Use multiple gateways for redundancy
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }

  /**
   * Generate the canonical IPFS URI for a CID.
   */
  ipfsUri(cid) {
    if (cid.startsWith('data:')) return cid;
    return `ipfs://${cid}`;
  }

  /**
   * Pin a binary file (image, etc.) to IPFS.
   * Returns { cid, uri, gatewayUrl, size, provider }
   *
   * @param {Buffer} buffer — the file bytes
   * @param {string} filename — e.g. 'avatar.png'
   * @param {string} mimeType — e.g. 'image/png'
   */
  async pinFile(buffer, filename = 'file', mimeType = 'application/octet-stream') {
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    console.log(`[IPFS] Pinning file ${filename} (${buffer.length} bytes, sha256=${hash.substring(0, 16)}…) via ${this.provider}`);

    switch (this.provider) {
      case 'pinata':
        return this._pinFilePinata(buffer, filename, mimeType);
      case 'local':
        return this._pinFileLocalNode(buffer, filename, mimeType);
      case 'data_uri':
      default:
        return this._pinFileAsDataUri(buffer, mimeType);
    }
  }

  /**
   * Compute the SHA-256 hash of content (needed for Chia NFT minting).
   */
  sha256(content) {
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Compute SHA-256 of a Buffer.
   */
  sha256Buffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  // ── Pinata (JSON) ──

  async _pinViaPinata(jsonStr, name) {
    const body = JSON.stringify({
      pinataOptions: { cidVersion: 1 },
      pinataMetadata: { name, keyvalues: { app: 'pinksurfing', type: 'profile' } },
      pinataContent: JSON.parse(jsonStr),
    });

    return new Promise((resolve, reject) => {
      const url = new URL('https://api.pinata.cloud/pinning/pinJSONToIPFS');
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.pinataJwt}`,
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300 && json.IpfsHash) {
              const cid = json.IpfsHash;
              console.log(`[IPFS] ✓ Pinata pin — CID=${cid}`);
              resolve({
                cid,
                uri: `ipfs://${cid}`,
                gatewayUrl: this.gatewayUrl(cid),
                size: json.PinSize || jsonStr.length,
                provider: 'pinata',
              });
            } else {
              reject(new Error(`Pinata error (${res.statusCode}): ${data.substring(0, 300)}`));
            }
          } catch (e) {
            reject(new Error(`Pinata parse error: ${e.message}`));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(30000, () => req.destroy(new Error('Pinata timeout')));
      req.write(body);
      req.end();
    });
  }

  // ── Local IPFS Node ──

  async _pinViaLocalNode(jsonStr) {
    // Uses the IPFS HTTP API: POST /api/v0/add
    const boundary = `----IPFSBoundary${Date.now()}`;
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="profile.json"',
      'Content-Type: application/json',
      '',
      jsonStr,
      `--${boundary}--`,
    ].join('\r\n');

    const url = new URL('/api/v0/add?cid-version=1', this.localApiUrl);
    const transport = url.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = transport.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.Hash) {
              const cid = json.Hash;
              console.log(`[IPFS] ✓ Local pin — CID=${cid}`);
              resolve({
                cid,
                uri: `ipfs://${cid}`,
                gatewayUrl: this.gatewayUrl(cid),
                size: parseInt(json.Size) || jsonStr.length,
                provider: 'local',
              });
            } else {
              reject(new Error(`Local IPFS error: ${data.substring(0, 300)}`));
            }
          } catch (e) {
            reject(new Error(`Local IPFS parse error: ${e.message}`));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => req.destroy(new Error('Local IPFS timeout')));
      req.write(body);
      req.end();
    });
  }

  // ── Data URI fallback (no pinning, inline) ──

  _pinAsDataUri(jsonStr) {
    const b64 = Buffer.from(jsonStr).toString('base64');
    const uri = `data:application/json;base64,${b64}`;
    const cid = `data_uri_${this.sha256(jsonStr).substring(0, 16)}`;
    console.log(`[IPFS] Using data URI fallback (${jsonStr.length} bytes)`);
    return {
      cid,
      uri,
      gatewayUrl: uri,
      size: jsonStr.length,
      provider: 'data_uri',
    };
  }

  // ── Pinata (File/Image) ──

  async _pinFilePinata(buffer, filename, mimeType) {
    const boundary = `----PinataFileBoundary${Date.now()}`;
    const metadataJson = JSON.stringify({
      name: filename,
      keyvalues: { app: 'pinksurfing', type: 'avatar' },
    });
    const optionsJson = JSON.stringify({ cidVersion: 1 });

    // Build multipart body
    const parts = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="pinataOptions"\r\n\r\n`,
      `${optionsJson}\r\n`,
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="pinataMetadata"\r\n\r\n`,
      `${metadataJson}\r\n`,
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`,
      `Content-Type: ${mimeType}\r\n\r\n`,
    ];

    const head = Buffer.from(parts.join(''));
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, buffer, tail]);

    return new Promise((resolve, reject) => {
      const url = new URL('https://api.pinata.cloud/pinning/pinFileToIPFS');
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Authorization': `Bearer ${this.pinataJwt}`,
          'Content-Length': body.length,
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300 && json.IpfsHash) {
              const cid = json.IpfsHash;
              console.log(`[IPFS] ✓ Pinata file pin — CID=${cid}`);
              resolve({
                cid,
                uri: `ipfs://${cid}`,
                gatewayUrl: this.gatewayUrl(cid),
                size: json.PinSize || buffer.length,
                provider: 'pinata',
              });
            } else {
              reject(new Error(`Pinata file error (${res.statusCode}): ${data.substring(0, 300)}`));
            }
          } catch (e) {
            reject(new Error(`Pinata file parse error: ${e.message}`));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(60000, () => req.destroy(new Error('Pinata file timeout')));
      req.write(body);
      req.end();
    });
  }

  // ── Local IPFS Node (File) ──

  async _pinFileLocalNode(buffer, filename, mimeType) {
    const boundary = `----IPFSFileBoundary${Date.now()}`;
    const head = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, buffer, tail]);

    const url = new URL('/api/v0/add?cid-version=1', this.localApiUrl);
    const transport = url.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = transport.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.Hash) {
              const cid = json.Hash;
              console.log(`[IPFS] ✓ Local file pin — CID=${cid}`);
              resolve({
                cid,
                uri: `ipfs://${cid}`,
                gatewayUrl: this.gatewayUrl(cid),
                size: parseInt(json.Size) || buffer.length,
                provider: 'local',
              });
            } else {
              reject(new Error(`Local IPFS file error: ${data.substring(0, 300)}`));
            }
          } catch (e) {
            reject(new Error(`Local IPFS file parse error: ${e.message}`));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(30000, () => req.destroy(new Error('Local IPFS file timeout')));
      req.write(body);
      req.end();
    });
  }

  // ── Data URI fallback (File) ──

  _pinFileAsDataUri(buffer, mimeType) {
    const b64 = buffer.toString('base64');
    const uri = `data:${mimeType};base64,${b64}`;
    const cid = `data_uri_${this.sha256Buffer(buffer).substring(0, 16)}`;
    console.log(`[IPFS] Using data URI fallback for file (${buffer.length} bytes)`);
    return {
      cid,
      uri,
      gatewayUrl: uri,
      size: buffer.length,
      provider: 'data_uri',
    };
  }

  /**
   * Check which provider is active and test connectivity.
   */
  async status() {
    const result = {
      provider: this.provider,
      configured: false,
      reachable: false,
    };

    switch (this.provider) {
      case 'pinata':
        result.configured = !!this.pinataJwt;
        if (result.configured) {
          try {
            await this._testPinata();
            result.reachable = true;
          } catch (e) {
            result.error = e.message;
          }
        }
        break;
      case 'local':
        result.configured = true;
        try {
          await this._testLocalNode();
          result.reachable = true;
        } catch (e) {
          result.error = e.message;
        }
        break;
      case 'data_uri':
        result.configured = true;
        result.reachable = true; // Always works
        break;
    }

    return result;
  }

  async _testPinata() {
    return new Promise((resolve, reject) => {
      const url = new URL('https://api.pinata.cloud/data/testAuthentication');
      const req = https.request(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.pinataJwt}` },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) resolve(true);
          else reject(new Error(`Pinata auth test failed: ${res.statusCode}`));
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => req.destroy(new Error('timeout')));
      req.end();
    });
  }

  async _testLocalNode() {
    const url = new URL('/api/v0/id', this.localApiUrl);
    const transport = url.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
      const req = transport.request(url, { method: 'POST' }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) resolve(true);
          else reject(new Error(`Local IPFS unreachable: ${res.statusCode}`));
        });
      });
      req.on('error', reject);
      req.setTimeout(5000, () => req.destroy(new Error('timeout')));
      req.end();
    });
  }
}

module.exports = new IpfsService();
