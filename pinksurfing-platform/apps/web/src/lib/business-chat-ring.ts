import { businessConversationForContact } from '@/lib/demo-data';
import { demoContractsByConversation } from '@/lib/demo-contracts';
import type { BusinessContract } from '@/lib/types/contract';
import { STATE_LABELS, stateRingHex } from '@/lib/contract-utils';
import {
  STATUS_HEX,
  isCompleteContractState,
  isPendingContractState,
} from '@/lib/status-colors';

/** One arc on the avatar ring — color matches contract lifecycle or to-do status */
export type RingSegment = { color: string; label: string };

export type BusinessAvatarRing = RingSegment[] | 'none';

function contractSegment(c: BusinessContract): RingSegment {
  return {
    color: c.state === 'DISPUTED' ? STATUS_HEX.disputed : stateRingHex(c.state),
    label: c.title || STATE_LABELS[c.state],
  };
}

/**
 * Builds ring segments divided among active contracts (one arc per pending/disputed contract).
 * Green only when everything is settled and nothing else is open.
 */
export function businessAvatarRing(
  contracts: BusinessContract[],
  todosPending = false
): BusinessAvatarRing {
  const active = contracts.filter(
    (c) => c.state === 'DISPUTED' || isPendingContractState(c.state)
  );
  const hasCompletedContract = contracts.some((c) => isCompleteContractState(c.state));

  const segments: RingSegment[] = [];

  const disputed = active.filter((c) => c.state === 'DISPUTED');
  const pending = active.filter((c) => c.state !== 'DISPUTED');

  for (const c of disputed) segments.push(contractSegment(c));
  for (const c of pending) segments.push(contractSegment(c));

  if (todosPending) {
    segments.push({ color: STATUS_HEX.todo, label: 'Open to-do' });
  }

  const noOpenWork = segments.length === 0;
  if (noOpenWork && hasCompletedContract && contracts.some((c) => isCompleteContractState(c.state))) {
    return [{ color: STATUS_HEX.complete, label: 'All settled' }];
  }

  return segments.length ? segments : 'none';
}

export function contractsForBusinessContact(contactId: string): BusinessContract[] {
  const conv = businessConversationForContact(contactId);
  if (!conv) return [];
  return demoContractsByConversation(conv.conversationId);
}

export function businessAvatarRingForContact(contactId: string): BusinessAvatarRing {
  return businessAvatarRing(contractsForBusinessContact(contactId));
}

export function businessAvatarRingStyle(
  ring: BusinessAvatarRing | undefined
): { background: string } | undefined {
  if (!ring || ring === 'none' || !ring.length) return undefined;
  const step = 360 / ring.length;
  const stops = ring
    .map((seg, i) => `${seg.color} ${i * step}deg ${(i + 1) * step}deg`)
    .join(', ');
  return { background: `conic-gradient(from 0deg, ${stops})` };
}

export function businessAvatarRingTitle(ring: BusinessAvatarRing | undefined): string {
  if (!ring || ring === 'none') return '';
  return ring.map((s) => s.label).join(' · ');
}

/** @deprecated Use AvatarRing wrapper + businessAvatarRingStyle */
export function businessAvatarRingClass(_ring: BusinessAvatarRing | undefined): string {
  return '';
}
