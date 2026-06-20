/**
 * Smoke test for demo contracts (no gateway required).
 * Run: node scripts/test-demo-contracts.mjs
 */
import {
  demoContractsByConversation,
  demoCreateContract,
  demoExecuteContractAction,
} from '../apps/web/src/lib/demo-contracts.ts';

const paintConv = 'conv-paint-exterior';
const solarConv = 'conv-solar-install';
const deckConv = 'conv-deck-build';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('OK:', msg);
  }
}

// Seeded contracts per business conversation
const paint = demoContractsByConversation(paintConv);
assert(paint.length === 1, `paint conversation has 1 contract (got ${paint.length})`);
assert(paint[0].state === 'APPROVED', 'paint contract is APPROVED');
assert(paint[0].priceAmount === 4000, 'paint contract is $4000');

const solar = demoContractsByConversation(solarConv);
assert(solar.length === 1, 'solar conversation has 1 contract');
assert(solar[0].state === 'IN_PROGRESS', 'solar contract is IN_PROGRESS');

const deck = demoContractsByConversation(deckConv);
assert(deck.length === 1, 'deck conversation has 1 contract');
assert(deck[0].state === 'DISPUTED', 'deck contract is DISPUTED');

// Empty conversation
assert(demoContractsByConversation('conv-nonexistent').length === 0, 'unknown conv returns []');

// Create + approve flow
const created = demoCreateContract({
  conversationId: 'conv-test-smoke',
  createdByUserId: 'web-user-a',
  counterpartyUserId: 'web-user-b',
  title: 'Smoke test offer',
  scopeText: 'Test scope',
  priceAmount: 100,
  settlementMode: 'OFF_PLATFORM',
});
assert(created.state === 'DRAFT', 'new contract starts DRAFT');

demoExecuteContractAction(created._id, 'ACCEPT_LEGAL', 'web-user-a');
demoExecuteContractAction(created._id, 'ACCEPT_LEGAL', 'web-user-b');
const approved = demoExecuteContractAction(created._id, 'APPROVE', 'web-user-a');
assert(approved.state === 'APPROVED', 'contract reaches APPROVED after legal + approve');

const listed = demoContractsByConversation('conv-test-smoke');
assert(listed.some((c) => c._id === created._id), 'created contract appears in byConversation');

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll demo contract checks passed.');
