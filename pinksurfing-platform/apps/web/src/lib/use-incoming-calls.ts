'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCallStatus, incomingCallFromRecord } from './calls-api';
import type { IncomingCall } from './types/call';

const POLL_MS = 4000;
const CALLS_LIVE = process.env.NEXT_PUBLIC_CALLS_DEMO !== 'true';

type Options = {
  enabled?: boolean;
  busy?: boolean;
};

export function useIncomingCalls(
  token: string | null,
  userId: string | null,
  options: Options = {}
) {
  const { enabled = true, busy = false } = options;
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());

  const dismiss = useCallback((channel: string) => {
    dismissedRef.current.add(channel);
    setIncoming((current) => (current?.channel === channel ? null : current));
  }, []);

  const clearIncoming = useCallback(() => {
    setIncoming(null);
  }, []);

  useEffect(() => {
    if (!token || !userId || !enabled || !CALLS_LIVE || busy) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const records = await fetchCallStatus(token);
        if (cancelled) return;

        const pending = records
          .map((record) => incomingCallFromRecord(record, userId))
          .filter((call): call is IncomingCall => !!call)
          .find((call) => !dismissedRef.current.has(call.channel));

        setIncoming(pending ?? null);
      } catch {
        if (!cancelled) setIncoming(null);
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, userId, enabled, busy]);

  return { incoming, dismiss, clearIncoming };
}
