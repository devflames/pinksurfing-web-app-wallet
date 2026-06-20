'use client';

import { useRef, useState } from 'react';
import { useShellNav } from '@/lib/shell-nav-context';

const SHOP_URL = 'https://pinksurfing.com';

export function ShopView() {
  const { shopMode, showToast, navigate } = useShellNav();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const refresh = () => {
    setFailed(false);
    setLoaded(false);
    if (iframeRef.current) {
      iframeRef.current.src = SHOP_URL;
    }
  };

  const openExternal = () => {
    window.open(SHOP_URL, '_blank', 'noopener,noreferrer');
    showToast('Opened pinksurfing.com in new tab');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ps-bg)]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--ps-brd)] bg-[var(--ps-surf)] px-3 py-2">
        {shopMode === 'sell' && (
          <span className="rounded-full border border-[var(--ps-pink)]/40 bg-[var(--ps-pink)]/10 px-2 py-0.5 text-[9px] text-[var(--ps-pink)]">
            Sell mode
          </span>
        )}
        <span className="flex-1 text-[10px] text-[var(--ps-dim)]">
          {shopMode === 'sell'
            ? 'Create your shop on PinkSurfing.com'
            : 'Browse marketplace — same as Flutter Shop WebView'}
        </span>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg border border-[var(--ps-brd)] px-2 py-1 text-[9px] text-[var(--ps-muted)] hover:text-[var(--ps-white)]"
        >
          ↻ Refresh
        </button>
        <button
          type="button"
          onClick={openExternal}
          className="rounded-lg border border-[var(--ps-cyan)]/40 bg-[var(--ps-cyan)]/10 px-2 py-1 text-[9px] text-[var(--ps-cyan)]"
        >
          Open site ↗
        </button>
      </div>

      {shopMode === 'sell' && (
        <div className="shrink-0 border-b border-[var(--ps-brd)] bg-[var(--ps-card2)] px-3 py-2">
          <button
            type="button"
            onClick={() => showToast('Seller onboarding starts on pinksurfing.com (demo)')}
            className="w-full rounded-xl bg-[var(--ps-pink)] py-2 text-[10px] font-medium text-[var(--ps-card)]"
          >
            Start selling — register storefront
          </button>
        </div>
      )}

      <div className="relative min-h-0 flex-1 p-3">
        {!loaded && !failed && (
          <div className="absolute inset-3 flex items-center justify-center rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)]">
            <span className="text-[11px] text-[var(--ps-dim)]">Loading shop…</span>
          </div>
        )}
        {failed && (
          <div className="absolute inset-3 flex flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-6 text-center">
            <p className="text-[11px] text-[var(--ps-muted)]">
              Shop preview could not load in the frame.
            </p>
            <button
              type="button"
              onClick={openExternal}
              className="rounded-xl bg-[var(--ps-pink)] px-4 py-2 text-[11px] font-medium text-[var(--ps-card)]"
            >
              Open pinksurfing.com
            </button>
            <button
              type="button"
              onClick={() => navigate('explore')}
              className="text-[10px] text-[var(--ps-cyan)]"
            >
              ← Back to Explore
            </button>
          </div>
        )}
        <iframe
          ref={iframeRef}
          title="PinkSurfing Shop"
          src={SHOP_URL}
          className="h-full min-h-[400px] w-full rounded-2xl border border-[var(--ps-brd)] bg-black"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  );
}
