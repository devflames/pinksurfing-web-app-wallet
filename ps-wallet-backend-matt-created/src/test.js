/**
 * Quick integration test for the wallet backend.
 * Run with: npm test
 */

const http = require('http');

const BASE = `http://localhost:${process.env.PORT || 3099}`;

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name} ${detail}`);
    failed++;
  }
}

async function run() {
  console.log('\n🧪 ps-wallet-backend integration tests\n');

  // 1. Health check
  console.log('── Health ──');
  const health = await request('GET', '/');
  assert('GET / returns 200', health.status === 200);
  assert('Has version', health.body.version === '1.0.0');
  assert('Has endpoints', !!health.body.endpoints);

  // 2. OAuth status
  console.log('\n── OAuth ──');
  const oauthStatus = await request('GET', '/auth/google/status');
  assert('GET /auth/google/status returns 200', oauthStatus.status === 200);
  assert('Has configured field', oauthStatus.body.data?.configured !== undefined);

  // 3. OAuth token (nonexistent session)
  const fakeSession = await request('GET', '/auth/google/token/fake-id-123');
  assert('GET /auth/google/token/fake returns 404', fakeSession.status === 404);

  // 4. Chain status
  console.log('\n── Chain ──');
  const chainStatus = await request('GET', '/wallet/chain-status');
  assert('GET /wallet/chain-status returns 200', chainStatus.status === 200);
  assert('Has network field', !!chainStatus.body.data?.network);

  // 5. Inscribe profile (will likely fail RPC but IPFS pin should succeed)
  console.log('\n── Inscription + IPFS ──');
  const inscribeResult = await request('POST', '/wallet/inscribe-profile', {
    walletPk: 'a'.repeat(96),
    chiaAddress: 'xch1testaddress123456789',
    profileData: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
    },
  });
  assert('POST /wallet/inscribe-profile returns 200', inscribeResult.status === 200);
  assert('Has inscriptionId', !!inscribeResult.body.data?.inscriptionId);
  assert('Has ipfsCid', !!inscribeResult.body.data?.ipfsCid);
  assert('Has metadataUri', !!inscribeResult.body.data?.metadataUri);

  // 5b. Sync profile to IPFS only (fast path)
  const syncResult = await request('POST', '/wallet/sync-profile', {
    walletPk: 'a'.repeat(96),
    chiaAddress: 'xch1testaddress123456789',
    profileData: {
      firstName: 'Test Updated',
      lastName: 'User',
      email: 'test@example.com',
      bio: 'Updated bio',
    },
  });
  assert('POST /wallet/sync-profile returns 200', syncResult.status === 200);
  assert('Sync has ipfsCid', !!syncResult.body.data?.ipfsCid);
  assert('Sync has metadataUri', !!syncResult.body.data?.metadataUri);
  assert('Sync has valid provider', ['pinata', 'local', 'data_uri'].includes(syncResult.body.data?.provider));

  // 6. Fetch profile (should return the synced data with IPFS info)
  const profileResult = await request('GET', '/wallet/profile/xch1testaddress123456789');
  assert('GET /wallet/profile/:address returns 200', profileResult.status === 200);
  assert('Has status field', profileResult.body.status === 'success');
  assert('Profile has ipfsCid', !!profileResult.body.data?.ipfsCid);
  assert('Profile has metadataUri', !!profileResult.body.data?.metadataUri);

  // 7. History (should have 2 entries: inscribe + sync)
  const historyResult = await request('GET', '/wallet/history/xch1testaddress123456789');
  assert('GET /wallet/history/:address returns 200', historyResult.status === 200);
  assert('History is array', Array.isArray(historyResult.body.data));
  assert('History has 2+ entries', historyResult.body.data?.length >= 2);
  assert('History entries have ipfsCid', !!historyResult.body.data?.[0]?.ipfsCid);

  // 7b. Chain status includes IPFS info
  const chainStatus2 = await request('GET', '/wallet/chain-status');
  assert('Chain status has ipfs field', !!chainStatus2.body.data?.ipfs);
  assert('IPFS provider is valid', ['pinata', 'local', 'data_uri'].includes(chainStatus2.body.data?.ipfs?.provider));

  // 7c. Update profile (new version)
  const updateResult = await request('POST', '/wallet/update-profile', {
    walletPk: 'a'.repeat(96),
    chiaAddress: 'xch1testaddress123456789',
    profileData: { firstName: 'Test V3', lastName: 'User' },
  });
  assert('POST /wallet/update-profile returns 200', updateResult.status === 200);
  assert('Update has ipfsCid', !!updateResult.body.data?.ipfsCid);

  // 7d. Missing fields on sync
  const badSync = await request('POST', '/wallet/sync-profile', {});
  assert('Missing sync fields returns 400', badSync.status === 400);

  // 8. Missing fields validation
  console.log('\n── Validation ──');
  const badInscribe = await request('POST', '/wallet/inscribe-profile', {});
  assert('Missing fields returns 400', badInscribe.status === 400);

  // 9. 404 handler
  const notFound = await request('GET', '/nonexistent');
  assert('Unknown route returns 404', notFound.status === 404);

  // ── Profile Resolver ──
  console.log('\n── Profile Resolver ──');

  // 10. Register a profile
  const regResult = await request('POST', '/profiles/register', {
    chiaAddress: 'xch1alice_test_address_001',
    walletPk: 'a'.repeat(96),
    displayName: 'Alice',
    bio: 'Test user Alice',
  });
  assert('POST /profiles/register returns 200', regResult.status === 200);
  assert('Profile has displayName', regResult.body.data?.displayName === 'Alice');

  // 11. Register a second profile
  const regResult2 = await request('POST', '/profiles/register', {
    chiaAddress: 'xch1bob_test_address_002',
    walletPk: 'b'.repeat(96),
    displayName: 'Bob',
    bio: 'Test user Bob',
  });
  assert('Second profile registered', regResult2.status === 200);

  // 12. Resolve by address
  const resolveResult = await request('GET', '/profiles/resolve/xch1alice_test_address_001');
  assert('GET /profiles/resolve returns 200', resolveResult.status === 200);
  assert('Resolved correct profile', resolveResult.body.data?.displayName === 'Alice');
  assert('Has walletPk', resolveResult.body.data?.walletPk === 'a'.repeat(96));

  // 13. Resolve by public key
  const pkResult = await request('GET', '/profiles/pk/' + 'b'.repeat(96));
  assert('GET /profiles/pk returns 200', pkResult.status === 200);
  assert('Resolved Bob by PK', pkResult.body.data?.displayName === 'Bob');

  // 14. Search profiles
  const searchResult = await request('GET', '/profiles/search?q=Ali');
  assert('GET /profiles/search returns 200', searchResult.status === 200);
  assert('Search found Alice', searchResult.body.data?.length >= 1);

  // 15. Profile directory
  const dirResult = await request('GET', '/profiles/directory');
  assert('GET /profiles/directory returns 200', dirResult.status === 200);
  assert('Directory has profiles', dirResult.body.data?.length >= 2);

  // 16. Missing fields on register
  const badRegister = await request('POST', '/profiles/register', {});
  assert('Missing profile fields returns 400', badRegister.status === 400);

  // 17. Resolve unknown address
  const unknownResolve = await request('GET', '/profiles/resolve/xch1unknown_nobody');
  assert('Unknown address returns null', unknownResolve.body.data === null);

  // ── Message Relay ──
  console.log('\n── Message Relay ──');

  // 18. Send encrypted message (Alice → Bob)
  const sendResult = await request('POST', '/messages/send', {
    senderAddress: 'xch1alice_test_address_001',
    recipientAddress: 'xch1bob_test_address_002',
    senderPk: 'a'.repeat(96),
    encryptedPayload: 'dGhpcyBpcyBlbmNyeXB0ZWQgdGV4dA==', // base64 opaque blob
    nonce: 'abc123nonce456',
  });
  assert('POST /messages/send returns 200', sendResult.status === 200);
  assert('Has messageId', !!sendResult.body.data?.messageId);
  assert('Has timestamp', !!sendResult.body.data?.timestamp);

  // 19. Send second message
  const sendResult2 = await request('POST', '/messages/send', {
    senderAddress: 'xch1alice_test_address_001',
    recipientAddress: 'xch1bob_test_address_002',
    senderPk: 'a'.repeat(96),
    encryptedPayload: 'c2Vjb25kIG1lc3NhZ2U=',
    nonce: 'def789nonce012',
  });
  assert('Second message sent', sendResult2.status === 200);

  // 20. Count undelivered for Bob
  const countResult = await request('GET', '/messages/count/xch1bob_test_address_002');
  assert('GET /messages/count returns 200', countResult.status === 200);
  assert('Bob has 2 undelivered', countResult.body.data?.count === 2);

  // 21. Peek at messages (doesn't mark delivered)
  const peekResult = await request('GET', '/messages/peek/xch1bob_test_address_002');
  assert('GET /messages/peek returns 200', peekResult.status === 200);
  assert('Peek shows 2 messages', peekResult.body.count === 2);

  // Count still 2 after peek
  const countAfterPeek = await request('GET', '/messages/count/xch1bob_test_address_002');
  assert('Still 2 after peek', countAfterPeek.body.data?.count === 2);

  // 22. Receive messages (marks as delivered)
  const receiveResult = await request('GET', '/messages/receive/xch1bob_test_address_002');
  assert('GET /messages/receive returns 200', receiveResult.status === 200);
  assert('Received 2 messages', receiveResult.body.count === 2);
  assert('Message has senderPk', !!receiveResult.body.data?.[0]?.senderPk);
  assert('Message has encryptedPayload', !!receiveResult.body.data?.[0]?.encryptedPayload);
  assert('Message has nonce', !!receiveResult.body.data?.[0]?.nonce);

  // 23. Count now 0 after receive
  const countAfterReceive = await request('GET', '/messages/count/xch1bob_test_address_002');
  assert('0 undelivered after receive', countAfterReceive.body.data?.count === 0);

  // 24. Send reply (Bob → Alice)
  const replyResult = await request('POST', '/messages/send', {
    senderAddress: 'xch1bob_test_address_002',
    recipientAddress: 'xch1alice_test_address_001',
    senderPk: 'b'.repeat(96),
    encryptedPayload: 'cmVwbHkgbWVzc2FnZQ==',
    nonce: 'ghi345nonce678',
  });
  assert('Reply sent', replyResult.status === 200);

  // 25. Conversation history
  const convResult = await request('GET', '/messages/conversation?addr1=xch1alice_test_address_001&addr2=xch1bob_test_address_002');
  assert('GET /messages/conversation returns 200', convResult.status === 200);
  assert('Conversation has 3 messages', convResult.body.count === 3);

  // 26. Conversation partners for Alice
  const partnersResult = await request('GET', '/messages/conversations/xch1alice_test_address_001');
  assert('GET /messages/conversations returns 200', partnersResult.status === 200);
  assert('Alice has 1 partner', partnersResult.body.count === 1);

  // 27. Missing fields on send
  const badSend = await request('POST', '/messages/send', {});
  assert('Missing message fields returns 400', badSend.status === 400);

  // 28. Acknowledge delivery
  const ackResult = await request('POST', '/messages/ack', {
    messageIds: [replyResult.body.data?.messageId],
  });
  assert('POST /messages/ack returns 200', ackResult.status === 200);
  assert('Acknowledged 1 message', ackResult.body.data?.acknowledged === 1);

  // ── KeyVault ──
  console.log('\n── KeyVault ──');

  // 29. KeyVault health (Node.js layer always healthy; Python may be offline)
  const kvHealth = await request('GET', '/keyvault/health');
  assert('GET /keyvault/health returns 200', kvHealth.status === 200);
  assert('Health has nodejs=healthy', kvHealth.body.nodejs === 'healthy');
  assert('Health has python field', kvHealth.body.python !== undefined);

  // 30. Create — missing fields validation
  const kvBadCreate = await request('POST', '/keyvault/create', {});
  assert('Create missing fields returns missing-field msg', kvBadCreate.body.success === false);
  assert('Create error mentions required fields', kvBadCreate.body.message?.includes('Missing'));

  const kvBadCreate2 = await request('POST', '/keyvault/create', {
    ownerPubkeyHex: 'a'.repeat(96),
  });
  assert('Create without backup/coin fails', kvBadCreate2.body.success === false);

  // 31. Update — missing fields validation
  const kvBadUpdate = await request('POST', '/keyvault/update', {});
  assert('Update missing fields fails', kvBadUpdate.body.success === false);
  assert('Update error mentions required fields', kvBadUpdate.body.message?.includes('Missing'));

  const kvBadUpdate2 = await request('POST', '/keyvault/update', {
    launcherId: '0x' + 'ab'.repeat(32),
    ownerPubkeyHex: 'a'.repeat(96),
  });
  assert('Update without SK/backup fails', kvBadUpdate2.body.success === false);

  // 32. Recover — missing fields validation
  const kvBadRecover = await request('POST', '/keyvault/recover', {});
  assert('Recover missing launcherId fails', kvBadRecover.body.success === false);
  assert('Recover error mentions launcherId', kvBadRecover.body.message?.includes('launcherId'));

  // 33. Transfer — missing fields validation
  const kvBadTransfer = await request('POST', '/keyvault/transfer', {});
  assert('Transfer missing fields fails', kvBadTransfer.body.success === false);
  assert('Transfer error mentions required fields', kvBadTransfer.body.message?.includes('Missing'));

  const kvBadTransfer2 = await request('POST', '/keyvault/transfer', {
    launcherId: '0x' + 'ab'.repeat(32),
    currentOwnerPubkeyHex: 'a'.repeat(96),
  });
  assert('Transfer without new PK/SK fails', kvBadTransfer2.body.success === false);

  // 34. Lookup — non-existent wallet
  const kvLookup = await request('GET', '/keyvault/lookup/xch1_nonexistent_test_wallet');
  assert('Lookup unknown wallet returns success=false', kvLookup.body.success === false);
  assert('Lookup has meaningful message', kvLookup.body.message?.includes('No KeyVault'));

  // 35. Status — non-existent launcher (will try Python sidecar and fail gracefully)
  const kvStatus = await request('GET', '/keyvault/status/0x' + 'ff'.repeat(32));
  assert('Status for unknown launcher returns json', kvStatus.status === 200);
  // Python is offline so this returns an error, which is fine — route handled it

  // 36. Create with valid fields — IPFS pin should work but Python deploy will fail
  // This tests the IPFS layer works end-to-end
  const kvCreate = await request('POST', '/keyvault/create', {
    ownerPubkeyHex: 'c'.repeat(96),
    encryptedBackup: 'dGVzdCBlbmNyeXB0ZWQgYmFja3Vw', // base64 "test encrypted backup"
    fundingCoin: { parent_coin_info: '0x' + '00'.repeat(32), puzzle_hash: '0x' + '11'.repeat(32), amount: 1 },
    walletAddress: 'xch1test_keyvault_wallet',
  });
  // Python sidecar is offline so create will fail after IPFS, but route should not crash
  assert('Create with fields returns json (no crash)', kvCreate.status === 200);
  assert('Create result has success field', kvCreate.body.success !== undefined);

  // 37. Recover with valid launcher ID — Python sidecar offline → graceful error
  const kvRecover = await request('POST', '/keyvault/recover', {
    launcherId: '0x' + 'ab'.repeat(32),
  });
  assert('Recover returns json (no crash)', kvRecover.status === 200);
  assert('Recover has success field', kvRecover.body.success !== undefined);

  // 38. Pin — missing encryptedBackup → validation error
  const kvPinEmpty = await request('POST', '/keyvault/pin', {});
  assert('Pin empty body returns success=false', kvPinEmpty.body.success === false);
  assert('Pin empty body has message', kvPinEmpty.body.message?.includes('Missing'));

  // 39. Pin — valid encryptedBackup → IPFS pin succeeds
  const kvPin = await request('POST', '/keyvault/pin', {
    encryptedBackup: 'dGVzdCBwaW4gYmFja3Vw', // base64 "test pin backup"
    walletAddress: 'xch1test_pin_wallet',
  });
  assert('Pin returns json (no crash)', kvPin.status === 200);
  assert('Pin has success field', kvPin.body.success !== undefined);
  if (kvPin.body.success) {
    assert('Pin returns ipfsCid', typeof kvPin.body.ipfsCid === 'string' && kvPin.body.ipfsCid.length > 0);
    assert('Pin returns gatewayUrl', typeof kvPin.body.gatewayUrl === 'string');
  }

  // 40. Create-auto — missing fields → validation error
  const kvAutoEmpty = await request('POST', '/keyvault/create-auto', {});
  assert('Create-auto empty body returns success=false', kvAutoEmpty.body.success === false);
  assert('Create-auto empty body has message', kvAutoEmpty.body.message?.includes('Missing'));

  // 41. Create-auto — valid fields → IPFS pin works, singleton deploy may fail (Python offline)
  const kvAuto = await request('POST', '/keyvault/create-auto', {
    ownerPubkeyHex: 'd'.repeat(96),
    encryptedBackup: 'dGVzdCBhdXRvIGJhY2t1cA==', // base64 "test auto backup"
    walletAddress: 'xch1test_auto_wallet',
  });
  assert('Create-auto returns json (no crash)', kvAuto.status === 200);
  assert('Create-auto has success field', kvAuto.body.success !== undefined);
  if (kvAuto.body.success) {
    assert('Create-auto returns ipfsCid', typeof kvAuto.body.ipfsCid === 'string' && kvAuto.body.ipfsCid.length > 0);
    // deployPending may be true if Python sidecar is offline
    assert('Create-auto has deployPending field', kvAuto.body.deployPending !== undefined);
  }

  // 42. Escrow — missing fields → validation error
  const kvEscrowEmpty = await request('POST', '/keyvault/escrow', {});
  assert('Escrow empty body returns success=false', kvEscrowEmpty.body.success === false);
  assert('Escrow empty body has message', kvEscrowEmpty.body.message?.includes('Missing'));

  // 43. Escrow — valid fields → stores vault key
  const kvEscrow = await request('POST', '/keyvault/escrow', {
    email: 'test@pinksurfing.com',
    walletAddress: 'xch1test_escrow_wallet',
    ownerPubkeyHex: 'a'.repeat(96),
    vaultKeyHex: 'b'.repeat(64),
    launcherId: 'test_launcher_123',
    latestCid: 'QmTestCid123',
  });
  assert('Escrow returns success', kvEscrow.body.success === true);

  // 44. Escrow — upsert (same email+wallet) → updates
  const kvEscrow2 = await request('POST', '/keyvault/escrow', {
    email: 'test@pinksurfing.com',
    walletAddress: 'xch1test_escrow_wallet',
    ownerPubkeyHex: 'a'.repeat(96),
    vaultKeyHex: 'c'.repeat(64),
    launcherId: 'test_launcher_456',
    latestCid: 'QmTestCid456',
  });
  assert('Escrow upsert returns success', kvEscrow2.body.success === true);

  // 45. Escrow-recover — missing email → validation error
  const kvRecoverEmpty = await request('POST', '/keyvault/escrow-recover', {});
  assert('Escrow-recover empty body returns success=false', kvRecoverEmpty.body.success === false);

  // 46. Escrow-recover — valid email → returns decrypted vault key
  const kvEscrowRecover = await request('POST', '/keyvault/escrow-recover', {
    email: 'test@pinksurfing.com',
  });
  assert('Escrow-recover returns success', kvEscrowRecover.body.success === true);
  assert('Escrow-recover returns vaultKeyHex', typeof kvEscrowRecover.body.vaultKeyHex === 'string' && kvEscrowRecover.body.vaultKeyHex.length === 64);
  assert('Escrow-recover returns updated vault key', kvEscrowRecover.body.vaultKeyHex === 'c'.repeat(64));
  assert('Escrow-recover returns launcherId', kvEscrowRecover.body.launcherId === 'test_launcher_456');

  // 47. Escrow-recover — unknown email → not found
  const kvRecoverMiss = await request('POST', '/keyvault/escrow-recover', {
    email: 'nobody@pinksurfing.com',
  });
  assert('Escrow-recover unknown email returns success=false', kvRecoverMiss.body.success === false);

  // 48. Rekey — missing fields → validation error
  const kvRekeyEmpty = await request('POST', '/keyvault/rekey', {});
  assert('Rekey empty body returns success=false', kvRekeyEmpty.body.success === false);

  // Summary
  console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Test runner error:', e.message);
  process.exit(1);
});
