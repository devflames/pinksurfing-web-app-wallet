import { STATE_EVENT_LABELS } from './chat-session';
import type { BusinessContract, ContractState } from './types/contract';

export type StateEventType =
  | 'CONTRACT_STATE'
  | 'VAULT_PAYCHAT'
  | 'VAULT_SWAP'
  | 'VAULT_ESCROW'
  | 'PAYMENT_SQUARE';

export type StateEventPayload = {
  psEvent: 'state';
  label: string;
  accent: string;
  contractTitle?: string;
  eventType: StateEventType;
  refId?: string;
  state?: string;
};

export const VAULT_STATE_LABELS = {
  PAYCHAT_VAULT: { label: '🔐 Vault payment sent on-chain', accent: '#6EE7FF' },
  PAYCHAT_SQUARE: { label: '✔ Square PayChat payment confirmed', accent: '#5DCAA5' },
  SWAP_INITIATED: { label: '⚡ BTC swap initiated from vault', accent: '#F7931A' },
  SWAP_ACCEPTED: { label: '✔ BTC swap accepted', accent: '#5DCAA5' },
  ESCROW_FUNDED: { label: '🔐 Vault escrow funded', accent: '#6EE7FF' },
} as const;

export function stateMessageForContract(contract: BusinessContract): {
  label: string;
  accent: string;
  contractTitle: string;
  state: ContractState;
} | null {
  const ev = STATE_EVENT_LABELS[contract.state];
  if (!ev) return null;
  return {
    label: ev.label,
    accent: ev.accent,
    contractTitle: contract.title,
    state: contract.state,
  };
}

export function buildStateEventPayload(input: {
  label: string;
  accent: string;
  contractTitle?: string;
  eventType: StateEventType;
  refId?: string;
  state?: string;
}): StateEventPayload {
  return {
    psEvent: 'state',
    label: input.label,
    accent: input.accent,
    contractTitle: input.contractTitle,
    eventType: input.eventType,
    refId: input.refId,
    state: input.state,
  };
}

export function parseStateEventPayload(raw?: string): StateEventPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed?.psEvent !== 'state') return null;
    if (typeof parsed.label !== 'string' || typeof parsed.accent !== 'string') return null;
    return {
      psEvent: 'state',
      label: parsed.label,
      accent: parsed.accent,
      contractTitle: typeof parsed.contractTitle === 'string' ? parsed.contractTitle : undefined,
      eventType: (parsed.eventType as StateEventType) ?? 'CONTRACT_STATE',
      refId: typeof parsed.refId === 'string' ? parsed.refId : undefined,
      state: typeof parsed.state === 'string' ? parsed.state : undefined,
    };
  } catch {
    return null;
  }
}

export function stateEventDedupeKey(payload: StateEventPayload): string {
  return `${payload.eventType}:${payload.refId ?? ''}:${payload.state ?? ''}:${payload.label}`;
}
