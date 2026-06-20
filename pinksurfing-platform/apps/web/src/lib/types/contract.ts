export type SettlementMode = 'OFF_PLATFORM' | 'ESCROW' | 'SQUARE' | 'BTC_SWAP';

export type ContractState =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PAID_OFF_PLATFORM'
  | 'ESCROW_FUNDING_INITIATED'
  | 'ESCROW_FUNDED'
  | 'IN_PROGRESS'
  | 'EVIDENCE_SUBMITTED'
  | 'VERIFIED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'CANCELLED'
  | 'LAPSED';

export type ContractActionType =
  | 'ACCEPT_LEGAL'
  | 'APPROVE'
  | 'MARK_PAID_OFF_PLATFORM'
  | 'INITIATE_ESCROW_FUNDING'
  | 'MARK_ESCROW_FUNDED'
  | 'START_IN_PROGRESS'
  | 'SUBMIT_EVIDENCE'
  | 'VERIFY'
  | 'COMPLETE'
  | 'DISPUTE'
  | 'CANCEL'
  | 'REVIVE';

export interface BusinessContract {
  _id: string;
  id?: string;
  conversationId: string;
  createdByUserId: string;
  counterpartyUserId: string;
  title: string;
  scopeText: string;
  priceAmount?: number;
  priceCurrency?: string;
  deadlineAt?: string;
  settlementMode: SettlementMode;
  state: ContractState;
  stateHistory?: unknown[];
  legalAck?: Record<string, { acceptedAt: string; version: number }>;
  needsAttention?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  status: string;
  data?: T;
  message?: string;
}

export function contractId(c: BusinessContract): string {
  return c._id || c.id || '';
}
