'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChatTab, Contact } from '@pinksurfing/ui';
import { contactsForTab, DEMO_CONTACTS, peerUserIdForContact } from './demo-data';
import {
  dynamicContactToUi,
  loadDynamicPaychatContacts,
} from './dynamic-paychat-contacts';
import { fetchContactList, isChatLive } from './chat-api';

export type ChatSection = 'home' | 'paychat';

export function useContacts(token: string | null) {
  const live = isChatLive();
  const [apiContacts, setApiContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token || !live) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchContactList(token);
      setApiContacts(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Contacts unavailable');
    } finally {
      setLoading(false);
    }
  }, [token, live]);

  useEffect(() => {
    reload();
  }, [reload]);

  const allContacts = live && apiContacts.length > 0 ? apiContacts : Object.values(DEMO_CONTACTS);

  const [joinTick, setJoinTick] = useState(0);

  const refreshJoined = useCallback(() => {
    setJoinTick((n) => n + 1);
  }, []);

  const getContactsForTab = useCallback(
    (tab: ChatTab): Contact[] => {
      if (live && apiContacts.length > 0) {
        return allContacts.filter((c) => c.type === tab);
      }
      const base = contactsForTab(tab);
      if (tab !== 'paychat') return base;
      void joinTick;
      const dynamic = loadDynamicPaychatContacts().map(dynamicContactToUi);
      const seen = new Set(base.map((c) => c.id));
      return [...base, ...dynamic.filter((c) => !seen.has(c.id))];
    },
    [live, apiContacts, allContacts, joinTick]
  );

  const resolveContact = useCallback(
    (id: string): Contact | undefined => {
      return allContacts.find((c) => c.id === id) ?? DEMO_CONTACTS[id];
    },
    [allContacts]
  );

  const resolvePeerUserId = useCallback((contact: Contact): string | null => {
    if (contact.userId) return contact.userId;
    return peerUserIdForContact(contact.id);
  }, []);

  return {
    live,
    loading,
    error,
    reload,
    refreshJoined,
    getContactsForTab,
    resolveContact,
    resolvePeerUserId,
    allContacts,
  };
}
