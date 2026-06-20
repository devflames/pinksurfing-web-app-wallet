/**
 * Integration test: web contract path via NestJS gateway
 * Run: node scripts/test-web-contracts-gateway.js
 */
const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sso_secret_key_for_jwt_decoding';
const GATEWAY = process.env.GATEWAY_URL || 'http://127.0.0.1:8080';

const token = jwt.sign(
  { id: 'web-user-a', _id: 'web-user-a', email: 'web@test.local' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, GATEWAY);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
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
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const conv = 'conv-paint-exterior';
  const create = await request('POST', '/api/app/chat/chats/contracts/create', {
    conversationId: conv,
    createdByUserId: 'web-user-a',
    counterpartyUserId: 'web-user-b',
    title: 'Web Gateway Test',
    scopeText: 'Integration test from web wiring',
    settlementMode: 'OFF_PLATFORM',
  });
  console.log('create', create.status, create.body?.status, create.body?.data?._id);

  const list = await request('POST', '/api/app/chat/chats/contracts/byConversation', {
    conversationId: conv,
  });
  console.log('byConversation', list.status, list.body?.status, 'count=', list.body?.data?.length);

  const ok = create.status === 200 && create.body?.status === 'success' && list.body?.data?.length > 0;
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
