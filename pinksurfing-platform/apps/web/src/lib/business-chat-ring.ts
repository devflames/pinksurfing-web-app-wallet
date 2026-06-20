import { businessConversationForContact } from '@/lib/demo-data';
import { demoContractsByConversation } from '@/lib/demo-contracts';
import type { BusinessContract, ContractState } from '@/lib/types/contract';

/** Pink = open workflow · Red = settled business in the past · None = no deal state */
export type BusinessAvatarRing = 'pending' | 'completed' | 'none';

const TERMINAL_STATES: ContractState[] = ['COMPLETED', 'CANCELLED', 'LAPSED'];

export function businessAvatarRing(contracts: BusinessContract[]): BusinessAvatarRing {
  if (!contracts.length) return 'none';

  const hasOpenWorkflow = contracts.some((c) => !TERMINAL_STATES.includes(c.state));
  if (hasOpenWorkflow) return 'pending';

  if (contracts.some((c) => c.state === 'COMPLETED')) return 'completed';

  return 'none';
}

export function contractsForBusinessContact(contactId: string): BusinessContract[] {
  const conv = businessConversationForContact(contactId);
  if (!conv) return [];
  return demoContractsByConversation(conv.conversationId);
}

export function businessAvatarRingForContact(contactId: string): BusinessAvatarRing {
  return businessAvatarRing(contractsForBusinessContact(contactId));
}

export function businessAvatarRingClass(ring: BusinessAvatarRing | undefined): string {
  if (ring === 'pending') {
    return 'ring-2 ring-[var(--ps-pink)] ring-offset-1 ring-offset-black';
  }
  if (ring === 'completed') {
    return 'ring-2 ring-[#e24b4a] ring-offset-1 ring-offset-black';
  }
  return '';
}
