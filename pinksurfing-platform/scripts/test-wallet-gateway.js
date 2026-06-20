/**
 * Integration test: Matt wallet via NestJS gateway
 * Run: node scripts/test-wallet-gateway.js
 */
const http = require('http');

const GATEWAY = process.env.GATEWAY_URL || 'http://127.0.0.1:8080';

function request(method, urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, GATEWAY);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const root = await request('GET', '/api/wallet/');
  console.log('root', root.status, root.body?.name);

  const kvHealth = await request('GET', '/api/wallet/keyvault/health');
  console.log('keyvault/health', kvHealth.status, kvHealth.body?.nodejs);

  const swaps = await request('GET', '/api/wallet/swaps/open?limit=5');
  console.log('swaps/open', swaps.status, swaps.body?.status, 'count=', swaps.body?.count);

  const ok =
    root.status === 200 &&
    root.body?.name === 'ps-wallet-backend' &&
    swaps.status === 200 &&
    swaps.body?.status === 'success';

  if (!ok) {
    console.error('Wallet gateway test failed — is Matt backend on :3099 and gateway on :8080?');
  }
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
