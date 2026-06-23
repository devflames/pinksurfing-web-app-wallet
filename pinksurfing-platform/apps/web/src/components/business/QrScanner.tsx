'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  active: boolean;
  onScan: (text: string) => void;
  onError?: (message: string) => void;
};

const SCANNER_ID = 'ps-qr-scanner-region';

export function QrScanner({ active, onScan, onError }: Props) {
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
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
      scannerRef.current = null;
      if (scanner) {
        void scanner.stop().catch(() => {});
        scanner.clear();
      }
      return;
    }

    let cancelled = false;

    (async () => {
      setStarting(true);
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        const scanner = new Html5Qrcode(SCANNER_ID);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            onScanRef.current(decoded);
          },
          () => {}
        );
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
      scannerRef.current = null;
      if (scanner) {
        void scanner.stop().catch(() => {});
        scanner.clear();
      }
    };
  }, [active]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--ps-brd)] bg-black">
      <div id={SCANNER_ID} className="min-h-[220px] w-full [&_video]:rounded-lg" />
      {starting && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-[var(--ps-muted)]">
          Starting camera…
        </p>
      )}
    </div>
  );
}
