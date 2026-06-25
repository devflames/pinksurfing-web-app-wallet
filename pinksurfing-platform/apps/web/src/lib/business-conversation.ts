import type { Contact } from '@pinksurfing/ui';
import { isChatLive } from './chat-api';
import { businessConversationForContact as demoConversationForContact } from './demo-data';

export type BusinessConversation = {
  conversationId: string;
  counterpartyUserId: string;
};

/** Stable conversation id for two Mongo user ids (live business chats). */
export function liveConversationId(userIdA: string, userIdB: string): string {
  const [a, b] = [userIdA, userIdB].sort();
  return `conv-${a}-${b}`;
}

/**
 * Resolve contract thread ids for a business contact.
 * Live: derived from self + contact Mongo userId.
 * Demo: hardcoded map when CHAT_LIVE is off.
 */
export function resolveBusinessConversation(
  contact: Contact | null | undefined,
  selfUserId: string | null | undefined
): BusinessConversation | null {
  if (!contact || contact.type !== 'business') return null;

  if (contact.userId && selfUserId) {
    return {
      conversationId: liveConversationId(selfUserId, contact.userId),
      counterpartyUserId: contact.userId,
    };
  }

  if (!isChatLive()) {
    return demoConversationForContact(contact.id);
  }

  // Live mode: demo contacts without a peer userId cannot use contracts API
  return null;
}
