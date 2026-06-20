'use client';

import type { BusinessContract } from '@/lib/types/contract';
import { formatMoney } from '@/lib/contract-utils';

type ContractProps = {
  mode: 'contract';
  open: boolean;
  contract: BusinessContract | null;
  onClose: () => void;
  onConfirm: () => void;
};

type PaychatProps = {
  mode: 'paychat';
  open: boolean;
  name: string;
  amountUsd: number;
  onClose: () => void;
  onConfirm: () => void;
};

type VideoCallProps = {
  mode: 'video-call';
  open: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => void;
};

type Props = ContractProps | PaychatProps | VideoCallProps;

export function SquareCheckoutModal(props: Props) {
  if (!props.open) return null;

  const title =
    props.mode === 'contract'
      ? props.contract?.title
      : props.mode === 'video-call'
        ? `Video call — ${props.name}`
        : `PayChat — ${props.name}`;
  const amount =
    props.mode === 'contract'
      ? formatMoney(props.contract?.priceAmount, props.contract?.priceCurrency)
      : props.mode === 'video-call'
        ? '$0.10/min'
        : `$${props.amountUsd.toFixed(2)}`;
  const subtitle =
    props.mode === 'contract'
      ? 'Contract'
      : props.mode === 'video-call'
        ? 'Video · billed to PinkSurfing'
        : 'Unlock conversation';

  if (props.mode === 'contract' && !props.contract) return null;

  const payLabel =
    props.mode === 'video-call' ? 'Start video call · $0.10/min' : `Pay ${amount}`;

  return (
    <div
      className="absolute inset-0 z-20 flex items-end justify-center rounded-xl bg-[#0B001070]"
      onClick={(e) => e.target === e.currentTarget && props.onClose()}
    >
      <div className="max-h-[82%] w-full overflow-y-auto rounded-t-2xl bg-[var(--ps-card)] p-4">
        <div className="mx-auto mb-3.5 h-1 w-8 rounded bg-white/15" />
        <div className="mb-3.5 flex items-center gap-2">
          <span className="text-lg text-[var(--ps-cyan)]">💳</span>
          <span className="text-sm font-medium text-[var(--ps-white)]">Pay with Square</span>
        </div>

        <div className="mb-3.5 rounded-lg border border-[#6EE7FF25] bg-[#6EE7FF08] p-2.5">
          <div className="text-[11px] text-[var(--ps-muted)]">{subtitle}</div>
          <div className="text-[13px] font-medium text-[var(--ps-white)]">{title}</div>
          <div className="mt-1 text-lg font-semibold text-[var(--ps-white)]">{amount}</div>
        </div>

        <label className="mb-1 block text-[10px] text-[var(--ps-muted)]">Card number</label>
        <input
          readOnly
          placeholder="4242 4242 4242 4242"
          className="mb-2.5 w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-3 py-2 text-[11px] text-[var(--ps-white)] outline-none"
        />
        <div className="mb-2.5 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[10px] text-[var(--ps-muted)]">Expiry</label>
            <input
              readOnly
              placeholder="MM/YY"
              className="w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-3 py-2 text-[11px] text-[var(--ps-white)] outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-[var(--ps-muted)]">CVC</label>
            <input
              readOnly
              placeholder="123"
              className="w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-3 py-2 text-[11px] text-[var(--ps-white)] outline-none"
            />
          </div>
        </div>

        <p className="mb-3 flex items-center gap-1.5 text-[9px] text-[var(--ps-muted)]">
          <span className="text-[var(--ps-green,#5DCAA5)]">🛡</span>
          Payments processed by Square · PinkSurfing does not store card data
        </p>

        <button
          type="button"
          onClick={props.onConfirm}
          className="w-full rounded-lg bg-[var(--ps-pink)] py-2.5 text-xs font-semibold text-[var(--ps-card)]"
        >
          {payLabel}
        </button>
        <button
          type="button"
          onClick={props.onClose}
          className="mt-1.5 w-full rounded-lg border border-[var(--ps-brd)] py-2 text-[11px] text-[var(--ps-muted)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
