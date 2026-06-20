/**
 * Contract smoke test — Raihan stack
 * Run: node scripts/run-contract-smoke-test.js
 * Requires: chat :6161, mobileapi :6003 (see start-smoke-services.ps1)
 */
const http = require('http');
const { sign } = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sso_secret_key_for_jwt_decoding';
const CHAT_PORT = process.env.CHAT_PORT || 6161;
const MOBILEAPI_PORT = process.env.MOBILEAPI_PORT || 6003;

const USER_A = 'smoke-user-a';
const USER_B = 'smoke-user-b';
const CONV_ID = 'smoke-conversation-' + Date.now();

const tokenA = sign(
  { id: USER_A, email: 'smoke-a@test.local', _id: USER_A },
  JWT_SECRET,
  { expiresIn: '1h' }
);
const tokenB = sign(
  { id: USER_B, email: 'smoke-b@test.local', _id: USER_B },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function request(port, method, urlPath, body, bearerToken = tokenA) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '127.0.0.1',
      port,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }
        resolve({ status: res.statusCode, body: parsed, raw });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function ping(port, label) {
  try {
    const r = await request(port, 'GET', '/');
    return { label, ok: r.status < 500, status: r.status };
  } catch (e) {
    return { label, ok: false, error: e.message };
  }
}

async function main() {
  const results = [];
  const log = (id, pass, detail) => {
    results.push({ id, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${id}: ${detail}`);
  };

  console.log('JWT_SECRET:', JWT_SECRET.slice(0, 8) + '...');
  console.log('CHAT_PORT:', CHAT_PORT, 'MOBILEAPI_PORT:', MOBILEAPI_PORT);

  const p1 = await ping(CHAT_PORT, 'chat');
  log('T0a', p1.ok, p1.ok ? `chat up HTTP ${p1.status}` : (p1.error || 'chat down'));

  const p2 = await ping(MOBILEAPI_PORT, 'mobileapi');
  log('T0b', p2.ok, p2.ok ? `mobileapi up HTTP ${p2.status}` : (p2.error || 'mobileapi down'));

  if (!p1.ok || !p2.ok) {
    console.log('\nStart services first: powershell -File scripts/start-smoke-services.ps1');
    process.exit(1);
  }

  const createBody = {
    conversationId: CONV_ID,
    createdByUserId: USER_A,
    counterpartyUserId: USER_B,
    scopeText: 'Smoke test contract scope',
    settlementMode: 'OFF_PLATFORM',
  };

  let direct;
  try {
    direct = await request(
      CHAT_PORT,
      'POST',
      '/chats/contracts/create',
      createBody
    );
    const ok = direct.status === 200 && direct.body?.status === 'success';
    log(
      'T1',
      ok,
      ok
        ? `direct chat create OK id=${direct.body?.data?._id || direct.body?.data?.id}`
        : `direct chat HTTP ${direct.status} ${JSON.stringify(direct.body).slice(0, 200)}`
    );
  } catch (e) {
    log('T1', false, `direct chat error: ${e.message}`);
  }

  let proxy;
  try {
    proxy = await request(
      MOBILEAPI_PORT,
      'POST',
      '/chat/chats/contracts/create',
      createBody
    );
    const ok = proxy.status === 200 && proxy.body?.status === 'success';
    log(
      'T1-proxy',
      ok,
      ok
        ? `mobileapi proxy create OK id=${proxy.body?.data?._id || proxy.body?.data?.id}`
        : `proxy HTTP ${proxy.status} ${JSON.stringify(proxy.body).slice(0, 200)}`
    );
  } catch (e) {
    log('T1-proxy', false, `proxy error: ${e.message}`);
  }

  const contractId =
    (proxy?.body?.data?._id || proxy?.body?.data?.id || direct?.body?.data?._id || direct?.body?.data?.id)?.toString?.() ||
    null;

  if (contractId) {
    try {
      const action = await request(MOBILEAPI_PORT, 'POST', '/chat/chats/contracts/action', {
        contractId,
        actionType: 'ACCEPT_LEGAL',
        note: 'smoke',
      });
      const ok = action.status === 200 && action.body?.status === 'success';
      log('T2', ok, ok ? 'ACCEPT_LEGAL via proxy' : `action HTTP ${action.status} ${JSON.stringify(action.body).slice(0, 150)}`);
    } catch (e) {
      log('T2', false, e.message);
    }

    try {
      const badUpdate = await request(MOBILEAPI_PORT, 'POST', '/chat/chats/contracts/update', {
        contractId,
        state: 'COMPLETED',
      });
      const blocked = badUpdate.status !== 200 || badUpdate.body?.data?.state !== 'COMPLETED';
      log('T3', blocked, blocked ? 'direct state update blocked' : 'SECURITY: state updated without action');
    } catch (e) {
      log('T3', false, e.message);
    }
  } else {
    log('T2', false, 'skipped — no contractId');
    log('T3', false, 'skipped — no contractId');
  }

  const escrowConv = 'smoke-escrow-' + Date.now();
  let escrowId = null;
  try {
    const createEscrow = await request(MOBILEAPI_PORT, 'POST', '/chat/chats/contracts/create', {
      conversationId: escrowConv,
      createdByUserId: USER_A,
      counterpartyUserId: USER_B,
      scopeText: 'Escrow smoke test',
      settlementMode: 'ESCROW',
      title: 'Escrow test',
    });
    escrowId = createEscrow.body?.data?._id || createEscrow.body?.data?.id;
    log(
      'T4',
      createEscrow.status === 200 && createEscrow.body?.status === 'success',
      escrowId ? `ESCROW contract created ${escrowId}` : `create failed ${JSON.stringify(createEscrow.body).slice(0, 120)}`
    );
  } catch (e) {
    log('T4', false, e.message);
  }

  if (escrowId) {
    const steps = [
      { id: 'T5a', token: tokenA, action: 'ACCEPT_LEGAL', expect: 'PENDING_APPROVAL' },
      { id: 'T5b', token: tokenB, action: 'ACCEPT_LEGAL', expect: 'PENDING_APPROVAL' },
      { id: 'T5c', token: tokenB, action: 'APPROVE', expect: 'APPROVED' },
      { id: 'T5d', token: tokenA, action: 'INITIATE_ESCROW_FUNDING', expect: 'ESCROW_FUNDING_INITIATED' },
      { id: 'T5e', token: tokenB, action: 'MARK_ESCROW_FUNDED', expect: 'ESCROW_FUNDED', payload: { squarePaymentId: 'smoke-square-1' } },
      { id: 'T5f', token: tokenA, action: 'START_IN_PROGRESS', expect: 'IN_PROGRESS' },
    ];
    for (const step of steps) {
      try {
        const r = await request(
          MOBILEAPI_PORT,
          'POST',
          '/chat/chats/contracts/action',
          {
            contractId: escrowId,
            actionType: step.action,
            note: 'smoke',
            payload: step.payload,
          },
          step.token
        );
        const state = r.body?.data?.state;
        const ok = r.status === 200 && r.body?.status === 'success' && state === step.expect;
        log(step.id, ok, ok ? `${step.action} → ${state}` : `${step.action} HTTP ${r.status} state=${state} ${JSON.stringify(r.body).slice(0, 100)}`);
      } catch (e) {
        log(step.id, false, e.message);
      }
    }

    try {
      const bad = await request(MOBILEAPI_PORT, 'POST', '/chat/chats/contracts/action', {
        contractId: escrowId,
        actionType: 'MARK_PAID_OFF_PLATFORM',
      });
      const rejected = bad.status === 400 || bad.body?.status !== 'success';
      log('T6', rejected, rejected ? 'MARK_PAID blocked on ESCROW contract' : 'SECURITY: off-platform pay on escrow');
    } catch (e) {
      log('T6', false, e.message);
    }
  } else {
    ['T5a', 'T5b', 'T5c', 'T5d', 'T5e', 'T5f', 'T6'].forEach((id) => log(id, false, 'skipped — no escrow contract'));
  }

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
