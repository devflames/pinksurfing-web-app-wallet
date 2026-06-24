'use client';

import { useEffect, useState } from 'react';
import { WalletIdentityCard } from '@/components/wallet/WalletIdentityCard';
import { VaultWithdrawForm } from '@/components/wallet/VaultWithdrawForm';
import { useWalletIdentity } from '@/hooks/use-wallet-identity';
import { loadVaultDepositAddress } from '@/lib/vault-withdraw-flow';
import { lookupKeyVault } from '@/lib/wallet-api';
import { copyText } from '@/lib/wallet-identity-storage';

function ScreenShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-[11px] text-[var(--ps-cyan)] hover:underline"
      >
        ← Back to Explore
      </button>
      <h2 className="mb-1 text-base font-semibold text-[var(--ps-white)]">{title}</h2>
      {subtitle && <p className="mb-5 text-[11px] text-[var(--ps-dim)]">{subtitle}</p>}
      {children}
    </div>
  );
}

function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-4">
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--ps-brd)] bg-white/5 px-3 py-2.5 text-[11px] text-[var(--ps-white)] outline-none focus:border-[var(--ps-primary)]/50"
      />
    </div>
  );
}

function PrimaryBtn({
  label,
  onClick,
  disabled,
  variant = 'pink',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'pink' | 'cyan';
}) {
  const cls =
    variant === 'pink'
      ? 'ps-btn-primary text-white'
      : 'ps-gradient-border bg-[var(--ps-surf)] text-[var(--ps-primary)]';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-xl py-2.5 text-[11px] font-medium transition-opacity hover:opacity-90 disabled:opacity-40 ${cls}`}
    >
      {label}
    </button>
  );
}

export function PayReceiveScreen({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [mode, setMode] = useState<'send' | 'request'>('send');

  const submit = () => {
    if (!amount.trim() || !recipient.trim()) {
      onSuccess('Enter amount and recipient');
      return;
    }
    onSuccess(
      mode === 'send'
        ? `Sent $${amount} to ${recipient} (demo)`
        : `Payment request for $${amount} sent to ${recipient} (demo)`
    );
    setAmount('');
    setRecipient('');
  };

  return (
    <ScreenShell
      title="Pay and Receive"
      subtitle="Send PS Pay payments or share your wallet address for BTC/XCH"
      onBack={onBack}
    >
      <div className="mb-4">
        <WalletIdentityCard variant="full" />
      </div>
      <div className="mb-3 flex gap-2">
        {(['send', 'request'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-xl border py-2 text-[10px] capitalize ${
              mode === m
                ? 'border-[var(--ps-cyan)] bg-[var(--ps-cyan)]/10 text-[var(--ps-cyan)]'
                : 'border-[var(--ps-brd)] text-[var(--ps-dim)]'
            }`}
          >
            {m === 'send' ? 'Send' : 'Request'}
          </button>
        ))}
      </div>
      <FormCard>
        <Field label="Amount (USD)" value={amount} onChange={setAmount} placeholder="0.00" type="number" />
        <Field
          label="Recipient PS Pay ID or email"
          value={recipient}
          onChange={setRecipient}
          placeholder="PS-PAY-… or name@email.com"
        />
        <PrimaryBtn label={mode === 'send' ? 'Send payment' : 'Request payment'} onClick={submit} />
      </FormCard>
    </ScreenShell>
  );
}

export { CreateInvoiceScreen as InvoiceScreen } from './CreateInvoiceScreen';

export function DepositWithdrawScreen({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: (msg: string) => void;
}) {
  const { chiaAddress, walletLive } = useWalletIdentity();
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'deposit' || !walletLive || !chiaAddress.trim()) {
      setDepositAddress(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const lookup = await lookupKeyVault(chiaAddress.trim());
        if (!lookup.success || !lookup.launcherId) {
          if (!cancelled) setLoadError(lookup.message ?? 'No KeyVault');
          return;
        }
        const addr = await loadVaultDepositAddress(lookup.launcherId);
        if (!cancelled) {
          setDepositAddress(addr);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Could not load deposit address');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, walletLive, chiaAddress]);

  return (
    <ScreenShell
      title="Deposit and Withdraw"
      subtitle="XCH KeyVault — non-custodial p2_keyvault coins on Chia"
      onBack={onBack}
    >
      <div className="mb-4">
        <WalletIdentityCard variant="full" />
      </div>
      <div className="mb-3 flex gap-2">
        {(['deposit', 'withdraw'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-xl border py-2 text-[10px] capitalize ${
              mode === m
                ? 'border-[var(--ps-pink)] bg-[var(--ps-pink)]/10 text-[var(--ps-pink)]'
                : 'border-[var(--ps-brd)] text-[var(--ps-dim)]'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <FormCard>
        {mode === 'deposit' ? (
          <>
            {!walletLive && (
              <p className="text-[10px] text-[var(--ps-dim)]">
                Enable NEXT_PUBLIC_WALLET_LIVE for live vault deposit address.
              </p>
            )}
            {loadError && <p className="text-[10px] text-[var(--ps-red,#f87171)]">{loadError}</p>}
            {depositAddress ? (
              <>
                <p className="text-[10px] text-[var(--ps-muted)]">
                  Send XCH to this KeyVault deposit address from any Chia wallet:
                </p>
                <p className="break-all rounded-lg border border-[var(--ps-brd)] bg-white/5 p-2 text-[10px] text-[var(--ps-cyan)]">
                  {depositAddress}
                </p>
                <PrimaryBtn
                  label="Copy address"
                  variant="cyan"
                  onClick={() => {
                    void copyText(depositAddress).then((ok) =>
                      onSuccess(ok ? 'Deposit address copied' : 'Copy failed')
                    );
                  }}
                />
              </>
            ) : walletLive && chiaAddress && !loadError ? (
              <p className="text-[10px] text-[var(--ps-dim)]">Loading deposit address…</p>
            ) : null}
          </>
        ) : (
          <VaultWithdrawForm onSuccess={onSuccess} onError={onSuccess} />
        )}
      </FormCard>
    </ScreenShell>
  );
}

export function ListingsScreen({
  title,
  subtitle,
  items,
  onBack,
  onAction,
  actionLabel = 'Open',
}: {
  title: string;
  subtitle: string;
  items: { id: string; title: string; meta: string; price?: string }[];
  onBack: () => void;
  onAction: (id: string, title: string) => void;
  actionLabel?: string;
}) {
  return (
    <ScreenShell title={title} subtitle={subtitle} onBack={onBack}>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onAction(item.id, item.title)}
            className="flex w-full items-center justify-between rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] px-4 py-3 text-left transition-colors hover:border-[var(--ps-cyan)]/40"
          >
            <div>
              <div className="text-[12px] font-medium text-[var(--ps-white)]">{item.title}</div>
              <div className="text-[10px] text-[var(--ps-dim)]">{item.meta}</div>
            </div>
            <span className="shrink-0 text-[10px] text-[var(--ps-cyan)]">
              {item.price ?? actionLabel} →
            </span>
          </button>
        ))}
      </div>
    </ScreenShell>
  );
}

export function SimpleFeatureScreen({
  title,
  subtitle,
  body,
  cta,
  onBack,
  onCta,
}: {
  title: string;
  subtitle: string;
  body: string;
  cta: string;
  onBack: () => void;
  onCta: () => void;
}) {
  return (
    <ScreenShell title={title} subtitle={subtitle} onBack={onBack}>
      <div className="rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-5">
        <p className="mb-4 text-[11px] leading-relaxed text-[var(--ps-muted)]">{body}</p>
        <PrimaryBtn label={cta} onClick={onCta} variant="cyan" />
      </div>
    </ScreenShell>
  );
}
