'use client';

import type { CardAction } from '@/lib/wallet-card-actions';

const TONE_CLASS: Record<CardAction['tone'], string> = {
  alert: 'border-amber-500/45 bg-amber-500/10 text-amber-200',
  share: 'border-violet-500/35 bg-violet-500/10 text-violet-200',
  balance: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200',
};

export function NotesToSelfBanner({ text, large }: { text: string; large?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-[var(--ps-cyan)]/50 bg-[var(--ps-cyan)]/12 px-3 py-2.5 leading-snug text-[var(--ps-cyan)] shadow-[0_0_14px_rgba(0,184,255,0.1)] ${
        large ? 'text-[12px] font-medium' : 'text-[10px]'
      }`}
    >
      {text}
    </div>
  );
}

export function WalletCardActionBanner({ action, large }: { action: CardAction; large?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${TONE_CLASS[action.tone]} ${
        large ? 'text-[12px] font-medium leading-snug' : 'text-[10px] leading-snug'
      }`}
    >
      {action.text}
    </div>
  );
}

export function WalletCardActionList({ actions }: { actions: CardAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {actions.map((a) => (
        <WalletCardActionBanner key={a.id} action={a} />
      ))}
    </div>
  );
}
