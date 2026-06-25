'use client';

import { useEffect, useRef, useState } from 'react';
import {
  popUnnotifiedAcceptedOutgoing,
  runDemoOutgoingAcceptance,
  type BusinessContactRequest,
} from '@/lib/business-contact-requests';
import { useShellNav } from '@/lib/shell-nav-context';
import { BusinessContactAcceptedAlert } from '@/components/contacts/BusinessContactAcceptedAlert';

type Props = {
  email: string;
  requests: BusinessContactRequest[];
  onRefresh: () => void;
  onOpenRequests?: () => void;
};

export function BusinessRequestAcceptanceWatcher({
  email,
  requests,
  onRefresh,
  onOpenRequests,
}: Props) {
  const { showToast } = useShellNav();
  const [alertRequest, setAlertRequest] = useState<BusinessContactRequest | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fresh = popUnnotifiedAcceptedOutgoing(email).filter((r) => !notifiedRef.current.has(r.id));
    if (fresh.length === 0) return;
    for (const r of fresh) notifiedRef.current.add(r.id);
    const latest = fresh[fresh.length - 1]!;
    setAlertRequest(latest);
    showToast(`${latest.toBusinessName} accepted your business contact request`);
  }, [email, requests, showToast]);

  useEffect(() => {
    const key = `ps-demo-accept-scheduled:${email}`;
    if (typeof window === 'undefined' || sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    const timer = window.setTimeout(() => {
      if (runDemoOutgoingAcceptance(email)) onRefresh();
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [email, onRefresh]);

  if (!alertRequest) return null;

  return (
    <BusinessContactAcceptedAlert
      request={alertRequest}
      onDismiss={() => setAlertRequest(null)}
      onViewRequests={onOpenRequests}
    />
  );
}
