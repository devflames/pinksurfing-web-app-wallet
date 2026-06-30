'use client';

import dynamic from 'next/dynamic';

const ThirdwebBuyWidgetInner = dynamic(
  () => import('@/components/wallet/ThirdwebBuyWidgetInner'),
  { ssr: false, loading: () => <p className="p-4 text-[10px] text-[var(--ps-dim)]">Loading onramp…</p> }
);

type Props = {
  open: boolean;
  onClose: () => void;
  /** Approximate USD amount hint for widget */
  amountUsd?: number;
};

export function ThirdwebOnrampModal({ open, onClose, amountUsd = 25 }: Props) {
  const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID?.trim();

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ps-white)]">Buy crypto (Thirdweb)</h2>
            <p className="text-[9px] text-[var(--ps-dim)]">
              Fiat onramp to fund your wallet before BTC swap
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none text-[var(--ps-muted)] hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {!clientId ? (
          <p className="text-[10px] text-[var(--ps-amber)]">
            Set <code className="text-[var(--ps-cyan)]">NEXT_PUBLIC_THIRDWEB_CLIENT_ID</code> in
            production env to enable Thirdweb onramp.
          </p>
        ) : (
          <ThirdwebBuyWidgetInner amount={String(Math.max(5, amountUsd))} clientId={clientId} />
        )}
      </div>
    </div>
  );
}
