'use client';

import { useEffect, useId, useRef, useState } from 'react';

type Props = {
  active: boolean;
  onScan: (text: string) => void;
  onError?: (message: string) => void;
};

type Html5Scanner = {
  stop: () => Promise<void>;
  clear: () => void;
};

async function stopScanner(scanner: Html5Scanner, started: boolean): Promise<void> {
  if (!started) return;
  try {
    await scanner.stop();
  } catch {
    /* already stopped or never started */
  }
  /* Do not call scanner.clear() — it wipes innerHTML and breaks React reconciliation. */
}

export function QrScanner({ active, onScan, onError }: Props) {
  const regionId = `ps-qr-scanner-${useId().replace(/:/g, '')}`;
  const scannerRef = useRef<Html5Scanner | null>(null);
  const startedRef = useRef(false);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  }, [onScan, onError]);

  useEffect(() => {
    if (!active) {
      const scanner = scannerRef.current;
      const wasStarted = startedRef.current;
      scannerRef.current = null;
      startedRef.current = false;
      if (scanner) void stopScanner(scanner, wasStarted);
      return;
    }

    let cancelled = false;

    (async () => {
      setStarting(true);
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled || !document.getElementById(regionId)) return;

        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            onScanRef.current(decoded);
          },
          () => {}
        );

        if (cancelled) {
          await stopScanner(scanner, true);
          return;
        }
        startedRef.current = true;
      } catch (e) {
        if (!cancelled) {
          onErrorRef.current?.(
            e instanceof Error ? e.message : 'Camera unavailable — paste the code instead'
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      const wasStarted = startedRef.current;
      scannerRef.current = null;
      startedRef.current = false;
      if (scanner) void stopScanner(scanner, wasStarted);
    };
  }, [active, regionId]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--ps-brd)] bg-black">
      <div id={regionId} className="min-h-[220px] w-full [&_video]:rounded-lg" />
      {starting && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-[var(--ps-muted)]">
          Starting camera…
        </p>
      )}
    </div>
  );
}
