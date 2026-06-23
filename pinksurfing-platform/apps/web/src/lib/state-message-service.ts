import { sendStateChatMessage } from './chat-api';
import {
  buildStateEventPayload,
  stateEventDedupeKey,
  stateMessageForContract,
  type StateEventPayload,
  type StateEventType,
} from './state-message-types';
import { markStateEventPublished, wasStateEventPublished } from './state-events-storage';
import type { BusinessContract } from './types/contract';

export type PublishStateInput = {
  token: string;
  fromUserId: string;
  toUserId: string;
  contactId: string;
  chatType: string;
  label: string;
  accent: string;
  contractTitle?: string;
  eventType: StateEventType;
  refId?: string;
  state?: string;
};

export async function publishStateEvent(input: PublishStateInput): Promise<boolean> {
  const payload = buildStateEventPayload({
    label: input.label,
    accent: input.accent,
    contractTitle: input.contractTitle,
    eventType: input.eventType,
    refId: input.refId,
    state: input.state,
  });

  const dedupeKey = stateEventDedupeKey(payload);
  if (wasStateEventPublished(input.contactId, dedupeKey)) {
    return false;
  }

  await sendStateChatMessage(
    input.token,
    input.fromUserId,
    input.toUserId,
    input.chatType,
    payload
  );
  markStateEventPublished(input.contactId, dedupeKey);
  return true;
}

export async function publishContractStateEvent(
  input: Omit<PublishStateInput, 'label' | 'accent' | 'state' | 'eventType' | 'refId'> & {
    contract: BusinessContract;
  }
): Promise<boolean> {
  const mapped = stateMessageForContract(input.contract);
  if (!mapped) return false;
  return publishStateEvent({
    ...input,
    label: mapped.label,
    accent: mapped.accent,
    contractTitle: mapped.contractTitle,
    eventType: 'CONTRACT_STATE',
    refId: input.contract._id || input.contract.id,
    state: mapped.state,
  });
}

export async function syncContractStatesToThread(input: {
  token: string;
  fromUserId: string;
  toUserId: string;
  contactId: string;
  chatType: string;
  contracts: BusinessContract[];
}): Promise<number> {
  let published = 0;
  for (const contract of input.contracts) {
    const ok = await publishContractStateEvent({
      token: input.token,
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      contactId: input.contactId,
      chatType: input.chatType,
      contract,
    }).catch(() => false);
    if (ok) published += 1;
  }
  return published;
}

export type { StateEventPayload };
