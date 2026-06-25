'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChatTab, Contact } from '@pinksurfing/ui';
import { contactsForTab, DEMO_CONTACTS, peerUserIdForContact } from './demo-data';
import {
  dynamicContactToUi,
  loadDynamicPaychatContacts,
} from './dynamic-paychat-contacts';
import {
  dynamicBusinessContactToUi,
  loadDynamicBusinessContacts,
} from './dynamic-business-contacts';
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

  const allContacts =
    live && apiContacts.length > 0
      ? apiContacts
      : live
        ? []
        : Object.values(DEMO_CONTACTS);

  const liveContactsEmpty = live && !loading && apiContacts.length === 0 && !error;

  const [joinTick, setJoinTick] = useState(0);

  const refreshJoined = useCallback(() => {
    setJoinTick((n) => n + 1);
  }, []);

  const getContactsForTab = useCallback(
    (tab: ChatTab): Contact[] => {
      if (live) {
        void joinTick;
        const fromApi = allContacts.filter((c) => c.type === tab);
        const dynamic =
          tab === 'paychat'
            ? loadDynamicPaychatContacts().map(dynamicContactToUi)
            : tab === 'business'
              ? loadDynamicBusinessContacts().map(dynamicBusinessContactToUi)
              : [];
        const seen = new Set(fromApi.map((c) => c.id));
        return [...fromApi, ...dynamic.filter((c) => !seen.has(c.id))];
      }
      const base = contactsForTab(tab);
      if (tab === 'paychat') {
        void joinTick;
        const dynamic = loadDynamicPaychatContacts().map(dynamicContactToUi);
        const seen = new Set(base.map((c) => c.id));
        return [...base, ...dynamic.filter((c) => !seen.has(c.id))];
      }
      if (tab === 'business') {
        void joinTick;
        const dynamic = loadDynamicBusinessContacts().map(dynamicBusinessContactToUi);
        const seen = new Set(base.map((c) => c.id));
        return [...base, ...dynamic.filter((c) => !seen.has(c.id))];
      }
      return base;
    },
    [live, apiContacts, allContacts, joinTick]
  );

  const resolveContact = useCallback(
    (id: string): Contact | undefined => {
      const found = allContacts.find((c) => c.id === id);
      if (found) return found;
      if (live) return undefined;
      return DEMO_CONTACTS[id];
    },
    [allContacts, live]
  );

  const resolvePeerUserId = useCallback((contact: Contact): string | null => {
    if (contact.userId) return contact.userId;
    if (live) return null;
    return peerUserIdForContact(contact.id);
  }, [live]);

  return {
    live,
    loading,
    error,
    liveContactsEmpty,
    reload,
    refreshJoined,
    getContactsForTab,
    resolveContact,
    resolvePeerUserId,
    allContacts,
  };
}
