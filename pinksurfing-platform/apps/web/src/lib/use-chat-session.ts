'use client';

import { useCallback, useEffect, useState } from 'react';
import { getChatSession } from './chat-session';
import type { ContactPreview, ThreadMessage } from './types/chat';

export function useChatSession(contactId: string, fallbackPreview: string) {
  const store = getChatSession();
  const [, tick] = useState(0);

  useEffect(() => store.subscribe(() => tick((n) => n + 1)), [store]);

  const messages = store.getMessages(contactId);
  const preview = store.getPreview(contactId, fallbackPreview);

  const send = useCallback(
    (text: string) => {
      store.sendMessage(contactId, text);
    },
    [store, contactId]
  );

  const appendState = useCallback(
    (label: string, accent: string, contractTitle?: string) => {
      store.appendStateEvent(contactId, label, accent, contractTitle);
    },
    [store, contactId]
  );

  const appendSystem = useCallback(
    (text: string) => {
      store.appendSystemText(contactId, text);
    },
    [store, contactId]
  );

  return { messages, preview, send, appendState, appendSystem };
}

export function useContactPreview(contactId: string, fallback: string): ContactPreview {
  const store = getChatSession();
  const [, tick] = useState(0);
  useEffect(() => store.subscribe(() => tick((n) => n + 1)), [store]);
  return store.getPreview(contactId, fallback);
}

export type { ThreadMessage, ContactPreview };
