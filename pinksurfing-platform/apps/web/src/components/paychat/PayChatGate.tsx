'use client';

type Props = {
  name: string;
  askUsd: number;
  onUnlock: () => void;
};

export function PayChatGate({ name, askUsd, onUnlock }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-[var(--ps-pink)]/40 bg-[var(--ps-pink)]/10 text-2xl text-[var(--ps-pink)]">
        🔒
      </div>
      <div className="text-[15px] font-medium text-[var(--ps-white)]">PayChat — {name}</div>
      <div>
        <div className="text-2xl font-semibold text-[var(--ps-white)]">
          USD* {askUsd.toFixed(2)}
        </div>
        <div className="text-[10px] text-[var(--ps-muted)]">approximate · locked in at checkout</div>
      </div>
      <button
        type="button"
        onClick={onUnlock}
        className="flex items-center gap-2 rounded-lg bg-[var(--ps-pink)] px-6 py-2.5 text-xs font-semibold text-[var(--ps-card)]"
      >
        💳 Pay to unlock
      </button>
      <div className="flex items-center gap-1.5 text-[9px] text-[var(--ps-muted)]">
        <span className="text-[var(--ps-green,#5DCAA5)]">🛡</span>
        Secured by Square · Non-refundable · One-time fee
      </div>
    </div>
  );
}
