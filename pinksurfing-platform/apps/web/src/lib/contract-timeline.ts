import type { BusinessContract, ContractState } from '@/lib/types/contract';
import { contractId } from '@/lib/types/contract';

export type TimelineStepKey =
  | 'offer_sent'
  | 'approved'
  | 'funded'
  | 'work_started'
  | 'evidence'
  | 'settled';

export type TimelineStepStatus = 'completed' | 'pending' | 'skipped';

export type ExecutionTimelineData = Record<
  TimelineStepKey,
  { status: TimelineStepStatus; at?: string }
>;

export const TIMELINE_STEPS: {
  key: TimelineStepKey;
  label: string;
  color: string;
}[] = [
  { key: 'offer_sent', label: 'Offer sent', color: '#FF9F1C' },
  { key: 'approved', label: 'Approved', color: '#00C896' },
  { key: 'funded', label: 'Funded', color: '#00D4FF' },
  { key: 'work_started', label: 'Work started', color: '#FF7AD1' },
  { key: 'evidence', label: 'Evidence submitted', color: '#C084FC' },
  { key: 'settled', label: 'Settled', color: '#00C896' },
];

/** Lifecycle priority — higher = more "active" for banner / sidebar highlight (from Jilani ContractChatBanner). */
export const CONTRACT_STATUS_PRIORITY: Partial<Record<ContractState, number>> = {
  DISPUTED: 10,
  EVIDENCE_SUBMITTED: 9,
  VERIFIED: 8,
  IN_PROGRESS: 7,
  ESCROW_FUNDED: 6,
  ESCROW_FUNDING_INITIATED: 5,
  PAID_OFF_PLATFORM: 5,
  APPROVED: 4,
  PENDING_APPROVAL: 3,
  DRAFT: 2,
  COMPLETED: 0,
  CANCELLED: -1,
  LAPSED: -1,
};

const STATE_ORDER: ContractState[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PAID_OFF_PLATFORM',
  'ESCROW_FUNDING_INITIATED',
  'ESCROW_FUNDED',
  'IN_PROGRESS',
  'EVIDENCE_SUBMITTED',
  'VERIFIED',
  'COMPLETED',
  'DISPUTED',
  'CANCELLED',
  'LAPSED',
];

function stateIndex(state: ContractState): number {
  const i = STATE_ORDER.indexOf(state);
  return i >= 0 ? i : 0;
}

export function buildExecutionTimeline(contract: BusinessContract): ExecutionTimelineData {
  const idx = stateIndex(contract.state);
  const stepThresholds: Record<TimelineStepKey, number> = {
    offer_sent: 0,
    approved: 2,
    funded: 5,
    work_started: 6,
    evidence: 7,
    settled: 9,
  };

  const out = {} as ExecutionTimelineData;
  for (const step of TIMELINE_STEPS) {
    const threshold = stepThresholds[step.key];
    const completed = idx >= threshold && contract.state !== 'CANCELLED' && contract.state !== 'LAPSED';
    out[step.key] = {
      status: completed ? 'completed' : 'pending',
    };
  }
  if (contract.state === 'DISPUTED') {
    out.evidence = { status: 'completed' };
    out.settled = { status: 'pending' };
  }
  return out;
}

export function pickActiveContract(contracts: BusinessContract[]): BusinessContract | null {
  const active = contracts
    .filter((c) => (CONTRACT_STATUS_PRIORITY[c.state] ?? 0) > 0)
    .sort(
      (a, b) =>
        (CONTRACT_STATUS_PRIORITY[b.state] ?? 0) - (CONTRACT_STATUS_PRIORITY[a.state] ?? 0)
    );
  return active[0] ?? contracts[0] ?? null;
}

export function contractMatchesRef(contract: BusinessContract, refId?: string): boolean {
  if (!refId) return false;
  return contractId(contract) === refId || contract._id === refId;
}
