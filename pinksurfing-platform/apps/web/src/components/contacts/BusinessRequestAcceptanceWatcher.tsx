'use client';

import { useEffect, useRef, useState } from 'react';
import {
  popUnnotifiedAcceptedOutgoing,
  runDemoOutgoingAcceptance,
  type BusinessContactRequest,
} from '@/lib/business-contact-requests';
import { isChatLive } from '@/lib/chat-api';
import { useShellNav } from '@/lib/shell-nav-context';
import { BusinessContactAcceptedAlert } from '@/components/contacts/BusinessContactAcceptedAlert';

const ACCEPTED_SEEN_KEY = 'ps-business-request-accepted-seen';

function loadAcceptedSeenIds(email: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`${ACCEPTED_SEEN_KEY}:${email || 'guest'}`);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveAcceptedSeenIds(email: string, ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${ACCEPTED_SEEN_KEY}:${email || 'guest'}`, JSON.stringify([...ids]));
}

function popUnnotifiedAcceptedOutgoingLive(
  requests: BusinessContactRequest[],
  userId: string,
  email: string
): BusinessContactRequest[] {
  const seen = loadAcceptedSeenIds(email);
  const fresh = requests.filter(
    (r) =>
      r.fromUserId === userId &&
      r.status === 'approved' &&
      !seen.has(r.id)
  );
  if (fresh.length === 0) return [];
  for (const r of fresh) seen.add(r.id);
  saveAcceptedSeenIds(email, seen);
  return fresh;
}

type Props = {
  email: string;
  userId?: string | null;
  requests: BusinessContactRequest[];
  onRefresh: () => void;
  onContactsRefresh?: () => void;
  onOpenRequests?: () => void;
};

export function BusinessRequestAcceptanceWatcher({
  email,
  userId,
  requests,
  onRefresh,
  onContactsRefresh,
  onOpenRequests,
}: Props) {
  const { showToast } = useShellNav();
  const [alertRequest, setAlertRequest] = useState<BusinessContactRequest | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());
  const live = isChatLive() && !!userId;

  useEffect(() => {
    const fresh = live
      ? popUnnotifiedAcceptedOutgoingLive(requests, userId!, email)
      : popUnnotifiedAcceptedOutgoing(email).filter((r) => !notifiedRef.current.has(r.id));

    if (fresh.length === 0) return;

    for (const r of fresh) notifiedRef.current.add(r.id);
    const latest = fresh[fresh.length - 1]!;
    setAlertRequest(latest);
    onContactsRefresh?.();
    showToast(`${latest.toBusinessName} accepted your business contact request`);
  }, [email, userId, requests, live, showToast, onContactsRefresh]);

  useEffect(() => {
    if (live) return;
    const key = `ps-demo-accept-scheduled:${email}`;
    if (typeof window === 'undefined' || sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    const timer = window.setTimeout(() => {
      if (runDemoOutgoingAcceptance(email)) onRefresh();
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [email, live, onRefresh]);

  if (!alertRequest) return null;

  return (
    <BusinessContactAcceptedAlert
      request={alertRequest}
      onDismiss={() => {
        setAlertRequest(null);
        onContactsRefresh?.();
      }}
      onViewRequests={onOpenRequests}
    />
  );
}
