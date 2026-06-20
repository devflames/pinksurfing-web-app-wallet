'use client';

import { useEffect, useState } from 'react';
import { QrDisplay } from '@/components/profile/QrDisplay';
import { useWalletIdentity } from '@/hooks/use-wallet-identity';
import { copyText, shareText } from '@/lib/wallet-identity-storage';

type Props = {
  /** compact = sidebar; full = Profile / Explore */
  variant?: 'compact' | 'full';
  showEdit?: boolean;
  /** Me section: header only until tapped */
  collapsible?: boolean;
};

function CopyShareActions({
  label,
  value,
  onFlash,
  compact,
}: {
  label: string;
  value: string;
  onFlash: (msg: string) => void;
  compact?: boolean;
}) {
  const handleCopy = async () => {
    if (!value.trim()) {
      onFlash(`No ${label} to copy`);
      return;
    }
    const ok = await copyText(value.trim());
    onFlash(ok ? `${label} copied` : 'Copy failed');
  };

  const handleShare = async () => {
    if (!value.trim()) {
      onFlash(`No ${label} to share`);
      return;
    }
    const result = await shareText(label, value);
    if (result === 'shared') onFlash(`${label} shared`);
    else if (result === 'copied') onFlash(`${label} copied (share unavailable)`);
    else onFlash('Share cancelled');
  };

  return (
    <div className={`flex gap-2 ${compact ? 'mt-1.5' : 'mt-2'}`}>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2.5 py-1 text-[9px] text-[var(--ps-cyan)] transition-colors hover:border-[var(--ps-cyan)]/40"
      >
        Copy
      </button>
      <button
        type="button"
        onClick={handleShare}
        className="rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2.5 py-1 text-[9px] text-[var(--ps-cyan)] transition-colors hover:border-[var(--ps-cyan)]/40"
      >
        Share
      </button>
    </div>
  );
}

export function WalletIdentityCard({
  variant = 'full',
  showEdit = true,
  collapsible = false,
}: Props) {
  const {
    email,
    pspayId,
    chiaAddress,
    btcPubkey,
    persist,
    saved,
    walletLive,
  } = useWalletIdentity();

  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [draftChia, setDraftChia] = useState(chiaAddress);
  const [draftBtc, setDraftBtc] = useState(btcPubkey);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraftChia(chiaAddress);
    setDraftBtc(btcPubkey);
  }, [chiaAddress, btcPubkey]);

  const flash = (msg: string) => {
    setCopyMsg(msg);
    setTimeout(() => setCopyMsg(null), 2000);
  };

  const save = () => {
    if (!draftChia.trim()) {
      flash('Enter your Chia wallet address');
      return;
    }
    persist({ chiaAddress: draftChia.trim(), btcPubkey: draftBtc.trim() || undefined });
    setEditing(false);
    flash('Wallet saved on this device');
  };

  const isFull = variant === 'full';

  return (
    <section
      className={`rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)] ${
        collapsible && !open ? 'p-3' : isFull ? 'p-4' : 'p-2.5'
      }`}
    >
      {collapsible ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className={`font-medium text-[var(--ps-white)] ${isFull ? 'text-sm' : 'text-[11px]'}`}>
                Your wallet
              </h3>
              <p className={`mt-0.5 text-[var(--ps-dim)] ${isFull ? 'text-[10px]' : 'text-[9px]'}`}>
                Non-custodial — vaults &amp; swaps use Chia HTLC smart contracts, not escrow custody.
              </p>
            </div>
            {walletLive ? (
              <span className="shrink-0 rounded-full border border-[var(--ps-green,#4ade80)]/40 bg-[var(--ps-green,#4ade80)]/10 px-2 py-0.5 text-[8px] text-[var(--ps-green,#4ade80)]">
                live
              </span>
            ) : (
              <span className="shrink-0 rounded-full border border-[var(--ps-amber,#fbbf24)]/40 bg-[var(--ps-amber,#fbbf24)]/10 px-2 py-0.5 text-[8px] text-[var(--ps-amber,#fbbf24)]">
                preview
              </span>
            )}
          </div>
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-2 flex w-full items-center justify-center gap-1 border-t border-[var(--ps-brd)] pt-2 text-[9px] text-[var(--ps-dim)] transition-colors hover:text-[var(--ps-white)]"
              aria-expanded={open}
            >
              <span aria-hidden>▾</span>
              Tap to expand
            </button>
          )}
        </>
      ) : (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className={`font-medium text-[var(--ps-white)] ${isFull ? 'text-sm' : 'text-[11px]'}`}>
              Your wallet
            </h3>
            <p className={`mt-0.5 text-[var(--ps-dim)] ${isFull ? 'text-[10px]' : 'text-[9px]'}`}>
              Non-custodial — vaults &amp; swaps use Chia HTLC smart contracts, not escrow custody.
            </p>
          </div>
          {walletLive ? (
            <span className="shrink-0 rounded-full border border-[var(--ps-green,#4ade80)]/40 bg-[var(--ps-green,#4ade80)]/10 px-2 py-0.5 text-[8px] text-[var(--ps-green,#4ade80)]">
              live
            </span>
          ) : (
            <span className="shrink-0 rounded-full border border-[var(--ps-amber,#fbbf24)]/40 bg-[var(--ps-amber,#fbbf24)]/10 px-2 py-0.5 text-[8px] text-[var(--ps-amber,#fbbf24)]">
              preview
            </span>
          )}
        </div>
      )}

      {(!collapsible || open) && (
        <div className={collapsible ? 'mt-3' : undefined}>
      {collapsible && open && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mb-2 flex w-full items-center justify-center gap-1 border-b border-[var(--ps-brd)] pb-2 text-[9px] text-[var(--ps-dim)] transition-colors hover:text-[var(--ps-white)]"
          aria-expanded={open}
        >
          <span className="rotate-180" aria-hidden>
            ▾
          </span>
          Collapse
        </button>
      )}
      {copyMsg && <p className={`text-[9px] text-[var(--ps-cyan)] ${collapsible ? 'mb-2' : 'mb-2'}`}>{copyMsg}</p>}

      {pspayId && (
        <div className="mb-3 flex items-center justify-between gap-2 text-[10px]">
          <span className="text-[var(--ps-dim)]">PS Pay ID</span>
          <button
            type="button"
            onClick={() => copyText(pspayId).then((ok) => flash(ok ? 'PS Pay ID copied' : 'Copy failed'))}
            className="truncate font-medium text-[var(--ps-cyan)] hover:underline"
            title={pspayId}
          >
            {pspayId}
          </button>
        </div>
      )}

      {showEdit && editing ? (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-[9px] text-[var(--ps-muted)]">Wallet address (xch1…)</label>
            <input
              value={draftChia}
              onChange={(e) => setDraftChia(e.target.value)}
              placeholder="xch1…"
              className="w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2 py-2 text-[10px] text-[var(--ps-white)] outline-none focus:border-[var(--ps-cyan)]/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[9px] text-[var(--ps-muted)]">Bitcoin public key (hex)</label>
            <input
              value={draftBtc}
              onChange={(e) => setDraftBtc(e.target.value)}
              placeholder="02… or 03…"
              className="w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2 py-2 text-[10px] text-[var(--ps-white)] outline-none focus:border-[var(--ps-cyan)]/40"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              className="flex-1 rounded-lg border border-[var(--ps-cyan)]/40 bg-[var(--ps-cyan)]/10 py-2 text-[10px] font-medium text-[var(--ps-cyan)]"
            >
              Save wallet on this device
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftChia(chiaAddress);
                setDraftBtc(btcPubkey);
                setEditing(false);
              }}
              className="rounded-lg border border-[var(--ps-brd)] px-3 py-2 text-[10px] text-[var(--ps-dim)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)] p-3">
            <h4 className={`font-medium text-[var(--ps-white)] ${isFull ? 'text-[11px]' : 'text-[10px]'}`}>
              Wallet address
            </h4>
            <p className="mt-0.5 text-[9px] leading-snug text-[var(--ps-dim)]">
              (chia address which transmits in XCH under the hood)
            </p>

            {chiaAddress ? (
              <div className={`mt-3 ${isFull ? 'flex flex-col items-center gap-3 sm:flex-row sm:items-start' : ''}`}>
                {isFull && <QrDisplay value={chiaAddress} size={88} />}
                <div className="min-w-0 flex-1">
                  <p className="break-all text-[10px] font-medium leading-relaxed text-[var(--ps-white)]">
                    {chiaAddress}
                  </p>
                  <CopyShareActions label="Wallet address" value={chiaAddress} onFlash={flash} compact={!isFull} />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[10px] text-[var(--ps-dim)]">
                Add your wallet address to receive XCH and use KeyVault.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)] p-3">
            <h4 className={`font-medium text-[var(--ps-white)] ${isFull ? 'text-[11px]' : 'text-[10px]'}`}>
              Bitcoin public key
            </h4>
            <p className="mt-0.5 text-[9px] leading-snug text-[var(--ps-dim)]">
              Receive BTC via atomic swap (HTLC)
            </p>

            {btcPubkey ? (
              <div className="mt-3">
                <p className="break-all text-[10px] font-medium leading-relaxed text-[var(--ps-white)]">
                  {btcPubkey}
                </p>
                <CopyShareActions label="Bitcoin public key" value={btcPubkey} onFlash={flash} compact={!isFull} />
              </div>
            ) : (
              <p className="mt-2 text-[10px] text-[var(--ps-dim)]">
                Add a Bitcoin public key to receive BTC.
              </p>
            )}
          </div>

          {showEdit && (
            <button
              type="button"
              onClick={() => {
                setDraftChia(chiaAddress);
                setDraftBtc(btcPubkey);
                setEditing(true);
              }}
              className="text-[9px] text-[var(--ps-dim)] hover:text-[var(--ps-white)]"
            >
              Edit wallet addresses
            </button>
          )}
        </div>
      )}

      {!email && (
        <p className="mt-2 text-[9px] text-[var(--ps-dim)]">Log in to save your wallet for this account.</p>
      )}
        </div>
      )}
    </section>
  );
}
