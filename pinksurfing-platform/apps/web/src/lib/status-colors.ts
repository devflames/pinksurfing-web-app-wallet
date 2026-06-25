import type { ContractState } from '@/lib/types/contract';

/** Shared hex for to-do rings and settled / disputed shortcuts */
export const STATUS_HEX = {
  complete: '#5DCAA5',
  disputed: '#E24B4A',
  todo: '#00b8ff',
} as const;

const COMPLETE_STATES: ContractState[] = ['COMPLETED'];
const INACTIVE_STATES: ContractState[] = ['CANCELLED', 'LAPSED'];

export function isCompleteContractState(state: ContractState): boolean {
  return COMPLETE_STATES.includes(state);
}

export function isInactiveContractState(state: ContractState): boolean {
  return INACTIVE_STATES.includes(state);
}

export function isPendingContractState(state: ContractState): boolean {
  if (state === 'DRAFT') return false;
  if (state === 'DISPUTED') return false;
  if (COMPLETE_STATES.includes(state)) return false;
  if (INACTIVE_STATES.includes(state)) return false;
  return true;
}

export function todoColors(pending: boolean): { text: string; border: string; bg: string } {
  if (pending) {
    return {
      text: STATUS_HEX.todo,
      border: `${STATUS_HEX.todo}50`,
      bg: `${STATUS_HEX.todo}15`,
    };
  }
  return {
    text: 'var(--ps-green)',
    border: `${STATUS_HEX.complete}50`,
    bg: `${STATUS_HEX.complete}20`,
  };
}
