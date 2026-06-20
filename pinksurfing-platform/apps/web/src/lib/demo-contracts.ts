import { BUSINESS_CONVERSATIONS } from './demo-data';
import type {
  BusinessContract,
  ContractActionType,
  ContractState,
  SettlementMode,
} from './types/contract';
import { contractId } from './types/contract';

const STORAGE_KEY = 'ps-demo-contracts-v1';

/** In-memory fallback when localStorage is unavailable (SSR / Node tests). */
let memoryStore: BusinessContract[] | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function legalAck(userId: string) {
  return { [userId]: { acceptedAt: nowIso(), version: 1 } };
}

function seedContracts(): BusinessContract[] {
  const paint = BUSINESS_CONVERSATIONS.c3;
  const solar = BUSINESS_CONVERSATIONS.c4;
  const deck = BUSINESS_CONVERSATIONS.c5;

  return [
    {
      _id: 'demo-contract-paint',
      conversationId: paint.conversationId,
      createdByUserId: paint.counterpartyUserId,
      counterpartyUserId: 'web-user-a',
      title: 'Exterior paint — 2 coats',
      scopeText: 'Prep, prime, and apply two coats to exterior walls and trim. Includes masking.',
      priceAmount: 4000,
      priceCurrency: 'USD',
      deadlineAt: '2026-05-12T00:00:00.000Z',
      settlementMode: 'OFF_PLATFORM',
      state: 'APPROVED',
      legalAck: {
        ...legalAck(paint.counterpartyUserId),
        ...legalAck('web-user-a'),
      },
      createdAt: '2026-03-01T15:31:00.000Z',
      updatedAt: '2026-03-02T10:00:00.000Z',
    },
    {
      _id: 'demo-contract-solar',
      conversationId: solar.conversationId,
      createdByUserId: 'web-user-a',
      counterpartyUserId: solar.counterpartyUserId,
      title: 'Rooftop solar install',
      scopeText: '12-panel array, inverter, permit pull, and utility interconnect.',
      priceAmount: 18500,
      priceCurrency: 'USD',
      settlementMode: 'ESCROW',
      state: 'IN_PROGRESS',
      legalAck: {
        ...legalAck('web-user-a'),
        ...legalAck(solar.counterpartyUserId),
      },
      createdAt: '2026-02-10T09:00:00.000Z',
      updatedAt: '2026-03-01T13:21:00.000Z',
    },
    {
      _id: 'demo-contract-deck',
      conversationId: deck.conversationId,
      createdByUserId: deck.counterpartyUserId,
      counterpartyUserId: 'web-user-a',
      title: 'Backyard deck build',
      scopeText: '12×16 pressure-treated deck with railing and stairs.',
      priceAmount: 9200,
      priceCurrency: 'USD',
      settlementMode: 'SQUARE',
      state: 'DISPUTED',
      legalAck: {
        ...legalAck(deck.counterpartyUserId),
        ...legalAck('web-user-a'),
      },
      createdAt: '2026-01-20T14:00:00.000Z',
      updatedAt: '2026-02-28T17:21:00.000Z',
    },
    {
      _id: 'demo-contract-fedex',
      conversationId: 'conv-team-fedex',
      createdByUserId: 'web-user-a',
      counterpartyUserId: 'web-user-b',
      title: 'Route 42 dispatch block',
      scopeText: '12-stop afternoon route — pickup and linehaul coordination.',
      priceAmount: 2400,
      priceCurrency: 'USD',
      settlementMode: 'OFF_PLATFORM',
      state: 'COMPLETED',
      legalAck: {
        ...legalAck('web-user-a'),
        ...legalAck('web-user-b'),
      },
      createdAt: '2026-01-05T08:00:00.000Z',
      updatedAt: '2026-02-01T16:00:00.000Z',
    },
    {
      _id: 'demo-contract-paint-crew',
      conversationId: 'conv-team-paint',
      createdByUserId: 'web-user-b',
      counterpartyUserId: 'web-user-a',
      title: 'Stucco repair — crew phase',
      scopeText: 'Exterior stucco patch, prime, and color match on south elevation.',
      priceAmount: 6200,
      priceCurrency: 'USD',
      settlementMode: 'ESCROW',
      state: 'IN_PROGRESS',
      legalAck: {
        ...legalAck('web-user-b'),
        ...legalAck('web-user-a'),
      },
      createdAt: '2026-03-10T10:00:00.000Z',
      updatedAt: '2026-03-12T14:00:00.000Z',
    },
  ];
}

function loadAll(): BusinessContract[] {
  if (typeof window === 'undefined') {
    if (!memoryStore) memoryStore = seedContracts();
    return memoryStore;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedContracts();
      saveAll(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as BusinessContract[];
    if (!parsed.length) {
      const seeded = seedContracts();
      saveAll(seeded);
      return seeded;
    }
    return parsed;
  } catch {
    const seeded = seedContracts();
    saveAll(seeded);
    return seeded;
  }
}

function saveAll(contracts: BusinessContract[]) {
  if (typeof window === 'undefined') {
    memoryStore = contracts;
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
}

function transitionState(
  contract: BusinessContract,
  actionType: ContractActionType
): ContractState {
  const prior = contract.state;
  let next = prior;

  switch (actionType) {
    case 'ACCEPT_LEGAL':
      if (prior === 'DRAFT') next = 'PENDING_APPROVAL';
      break;
    case 'APPROVE':
      if (prior === 'DRAFT' || prior === 'PENDING_APPROVAL') next = 'APPROVED';
      break;
    case 'MARK_PAID_OFF_PLATFORM':
      if (prior === 'APPROVED' && contract.settlementMode === 'OFF_PLATFORM') {
        next = 'PAID_OFF_PLATFORM';
      }
      break;
    case 'INITIATE_ESCROW_FUNDING':
      if (
        prior === 'APPROVED' &&
        (contract.settlementMode === 'ESCROW' || contract.settlementMode === 'SQUARE')
      ) {
        next = 'ESCROW_FUNDING_INITIATED';
      }
      break;
    case 'MARK_ESCROW_FUNDED':
      if (
        prior === 'ESCROW_FUNDING_INITIATED' &&
        (contract.settlementMode === 'ESCROW' || contract.settlementMode === 'SQUARE')
      ) {
        next = 'ESCROW_FUNDED';
      }
      break;
    case 'START_IN_PROGRESS':
      if (prior === 'ESCROW_FUNDED') next = 'IN_PROGRESS';
      break;
    case 'SUBMIT_EVIDENCE':
      if (prior === 'PAID_OFF_PLATFORM' || prior === 'IN_PROGRESS') next = 'EVIDENCE_SUBMITTED';
      break;
    case 'VERIFY':
      if (prior === 'EVIDENCE_SUBMITTED') next = 'VERIFIED';
      break;
    case 'COMPLETE':
      if (prior === 'VERIFIED') next = 'COMPLETED';
      break;
    case 'DISPUTE':
      next = 'DISPUTED';
      break;
    case 'CANCEL':
      next = 'CANCELLED';
      break;
    case 'REVIVE':
      if (prior === 'LAPSED') next = 'PENDING_APPROVAL';
      break;
    default:
      break;
  }

  const stateChanging = new Set<ContractActionType>([
    'APPROVE',
    'MARK_PAID_OFF_PLATFORM',
    'INITIATE_ESCROW_FUNDING',
    'MARK_ESCROW_FUNDED',
    'START_IN_PROGRESS',
    'SUBMIT_EVIDENCE',
    'VERIFY',
    'COMPLETE',
    'DISPUTE',
    'CANCEL',
    'REVIVE',
  ]);

  if (stateChanging.has(actionType) && next === prior) {
    throw new Error(
      `Action ${actionType} is not allowed in state ${prior} for settlement ${contract.settlementMode}`
    );
  }

  return next;
}

export function demoAllContracts(): BusinessContract[] {
  return loadAll();
}

export function demoContractsByConversation(conversationId: string): BusinessContract[] {
  return loadAll()
    .filter((c) => c.conversationId === conversationId)
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

export function demoCreateContract(input: {
  conversationId: string;
  createdByUserId: string;
  counterpartyUserId: string;
  title?: string;
  scopeText: string;
  priceAmount?: number;
  priceCurrency?: string;
  deadlineAt?: string;
  settlementMode?: SettlementMode;
}): BusinessContract {
  const all = loadAll();
  const contract: BusinessContract = {
    _id: `demo-contract-${Date.now()}`,
    conversationId: input.conversationId,
    createdByUserId: input.createdByUserId,
    counterpartyUserId: input.counterpartyUserId,
    title: input.title || 'Untitled offer',
    scopeText: input.scopeText,
    priceAmount: input.priceAmount,
    priceCurrency: input.priceCurrency || 'USD',
    deadlineAt: input.deadlineAt,
    settlementMode: input.settlementMode || 'OFF_PLATFORM',
    state: 'DRAFT',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  all.push(contract);
  saveAll(all);
  return contract;
}

export function demoExecuteContractAction(
  id: string,
  actionType: ContractActionType,
  actorUserId: string
): BusinessContract {
  const all = loadAll();
  const index = all.findIndex((c) => contractId(c) === id);
  if (index < 0) throw new Error('Contract not found');

  const contract = { ...all[index] };

  if (actionType === 'ACCEPT_LEGAL') {
    contract.legalAck = {
      ...(contract.legalAck ?? {}),
      ...legalAck(actorUserId),
    };
  }

  if (actionType === 'APPROVE') {
    const creator = contract.legalAck?.[contract.createdByUserId];
    const counterparty = contract.legalAck?.[contract.counterpartyUserId];
    if (!creator || !counterparty) {
      throw new Error('Both parties must accept legal terms before approval');
    }
  }

  contract.state = transitionState(contract, actionType);
  contract.updatedAt = nowIso();
  all[index] = contract;
  saveAll(all);
  return contract;
}
