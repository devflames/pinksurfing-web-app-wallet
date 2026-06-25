import type { ContractActionType, ContractState } from './types/contract';

export const STATE_LABELS: Record<ContractState, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  PAID_OFF_PLATFORM: 'Paid (off-platform)',
  ESCROW_FUNDING_INITIATED: 'Escrow funding',
  ESCROW_FUNDED: 'Escrow funded',
  IN_PROGRESS: 'In progress',
  EVIDENCE_SUBMITTED: 'Evidence submitted',
  VERIFIED: 'Verified',
  COMPLETED: 'Completed',
  DISPUTED: 'Disputed',
  CANCELLED: 'Cancelled',
  LAPSED: 'Lapsed',
};

export const STATE_COLORS: Record<ContractState, { text: string; border: string; bg: string }> = {
  DRAFT: { text: 'var(--ps-dim)', border: 'var(--ps-brd)', bg: 'var(--ps-card)' },
  PENDING_APPROVAL: { text: 'var(--ps-amber)', border: '#EF9F2750', bg: '#EF9F2720' },
  APPROVED: { text: 'var(--ps-green)', border: '#5DCAA550', bg: '#5DCAA520' },
  PAID_OFF_PLATFORM: { text: 'var(--ps-cyan)', border: '#6EE7FF50', bg: '#6EE7FF20' },
  ESCROW_FUNDING_INITIATED: { text: 'var(--ps-amber)', border: '#EF9F2750', bg: '#EF9F2720' },
  ESCROW_FUNDED: { text: 'var(--ps-cyan)', border: '#6EE7FF50', bg: '#6EE7FF20' },
  IN_PROGRESS: { text: 'var(--ps-pink)', border: '#FF7AD150', bg: '#FF7AD120' },
  EVIDENCE_SUBMITTED: { text: 'var(--ps-purple)', border: '#AFA9EC50', bg: '#AFA9EC20' },
  VERIFIED: { text: 'var(--ps-green)', border: '#5DCAA550', bg: '#5DCAA520' },
  COMPLETED: { text: 'var(--ps-green)', border: '#5DCAA550', bg: '#5DCAA520' },
  DISPUTED: { text: 'var(--ps-red)', border: '#E24B4A50', bg: '#E24B4A20' },
  CANCELLED: { text: 'var(--ps-dim)', border: 'var(--ps-brd)', bg: 'var(--ps-card)' },
  LAPSED: { text: 'var(--ps-dim)', border: 'var(--ps-brd)', bg: 'var(--ps-card)' },
};

export function actionsForState(
  state: ContractState,
  settlementMode?: string
): { action: ContractActionType; label: string }[] {
  switch (state) {
    case 'DRAFT':
    case 'PENDING_APPROVAL':
      return [
        { action: 'ACCEPT_LEGAL', label: 'Accept legal' },
        { action: 'APPROVE', label: 'Approve' },
        { action: 'CANCEL', label: 'Cancel' },
      ];
    case 'APPROVED':
      if (settlementMode === 'OFF_PLATFORM') {
        return [
          { action: 'MARK_PAID_OFF_PLATFORM', label: 'Mark paid' },
          { action: 'DISPUTE', label: 'Dispute' },
          { action: 'CANCEL', label: 'Cancel' },
        ];
      }
      if (settlementMode === 'SQUARE') {
        return [
          { action: 'INITIATE_ESCROW_FUNDING', label: 'Pay with Square' },
          { action: 'DISPUTE', label: 'Dispute' },
          { action: 'CANCEL', label: 'Cancel' },
        ];
      }
      if (settlementMode === 'ESCROW') {
        return [
          { action: 'INITIATE_ESCROW_FUNDING', label: 'Initiate funding' },
          { action: 'DISPUTE', label: 'Dispute' },
          { action: 'CANCEL', label: 'Cancel' },
        ];
      }
      if (settlementMode === 'BTC_SWAP') {
        return [
          { action: 'INITIATE_ESCROW_FUNDING', label: 'Mark funded' },
          { action: 'DISPUTE', label: 'Dispute' },
          { action: 'CANCEL', label: 'Cancel' },
        ];
      }
      return [
        { action: 'DISPUTE', label: 'Dispute' },
        { action: 'CANCEL', label: 'Cancel' },
      ];
    case 'ESCROW_FUNDING_INITIATED':
      return [
        { action: 'MARK_ESCROW_FUNDED', label: 'Confirm funded' },
        { action: 'DISPUTE', label: 'Dispute' },
        { action: 'CANCEL', label: 'Cancel' },
      ];
    case 'ESCROW_FUNDED':
      return [
        { action: 'START_IN_PROGRESS', label: 'Start work' },
        { action: 'DISPUTE', label: 'Dispute' },
      ];
    case 'PAID_OFF_PLATFORM':
    case 'IN_PROGRESS':
      return [
        { action: 'SUBMIT_EVIDENCE', label: 'Submit evidence' },
        { action: 'DISPUTE', label: 'Dispute' },
      ];
    case 'EVIDENCE_SUBMITTED':
      return [
        { action: 'VERIFY', label: 'Verify' },
        { action: 'DISPUTE', label: 'Dispute' },
      ];
    case 'VERIFIED':
      return [{ action: 'COMPLETE', label: 'Complete' }];
    case 'DISPUTED':
      return [{ action: 'CANCEL', label: 'Cancel' }];
    case 'LAPSED':
      return [{ action: 'REVIVE', label: 'Revive' }];
    default:
      return [];
  }
}

export function formatMoney(amount?: number, currency = 'USD'): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Hex color for avatar ring segment — matches contract card lifecycle color */
const STATE_RING_HEX: Partial<Record<ContractState, string>> = {
  DRAFT: '#6B4C80',
  PENDING_APPROVAL: '#EF9F27',
  APPROVED: '#5DCAA5',
  PAID_OFF_PLATFORM: '#6EE7FF',
  ESCROW_FUNDING_INITIATED: '#EF9F27',
  ESCROW_FUNDED: '#6EE7FF',
  IN_PROGRESS: '#FF7AD1',
  EVIDENCE_SUBMITTED: '#AFA9EC',
  VERIFIED: '#5DCAA5',
  COMPLETED: '#5DCAA5',
  DISPUTED: '#E24B4A',
  CANCELLED: '#6B4C80',
  LAPSED: '#6B4C80',
};

export function stateRingHex(state: ContractState): string {
  return STATE_RING_HEX[state] ?? '#9747ff';
}
