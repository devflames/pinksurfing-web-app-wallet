'use client';

import type { ColdContactLikelihood } from '@/lib/cold-contact-likelihood';
import {
  coldContactLikelihoodLabel,
  coldContactNudgeMessage,
} from '@/lib/cold-contact-likelihood';

type Props = {
  open: boolean;
  personName: string;
  likelihood: ColdContactLikelihood;
  paychatId: string;
  onClose: () => void;
  onSendAnyway: () => void;
  onOpenPaychat: () => void;
};

export function ColdContactPromptModal({
  open,
  personName,
  likelihood,
  paychatId,
  onClose,
  onSendAnyway,
  onOpenPaychat,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-[300px] rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-4 shadow-xl"
        role="dialog"
        aria-label="Cold contact guidance"
      >
        <h3 className="text-[13px] font-semibold text-[var(--ps-white)]">
          PayChat recommended first
        </h3>
        <p className="mt-1 text-[9px] font-medium text-[var(--ps-amber)]">
          {coldContactLikelihoodLabel(likelihood)}
        </p>
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--ps-muted)]">
          {coldContactNudgeMessage(likelihood, personName)}
        </p>
        <div className="mt-2 rounded-lg bg-[var(--ps-surf)] px-2 py-1.5">
          <div className="text-[7px] text-[var(--ps-dim)]">Their PayChat ID</div>
          <div className="font-mono text-[10px] text-[var(--ps-cyan)]">{paychatId}</div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              onOpenPaychat();
              onClose();
            }}
            className="w-full rounded-xl bg-gradient-to-r from-[var(--ps-pink)] to-[#9747ff] py-2.5 text-[10px] font-semibold text-white"
          >
            Open PayChat
          </button>
          <button
            type="button"
            onClick={() => {
              onSendAnyway();
              onClose();
            }}
            className="w-full rounded-xl border border-[var(--ps-brd)] py-2 text-[10px] text-[var(--ps-muted)] hover:bg-[var(--ps-surf)]"
          >
            Send business request anyway
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-[9px] text-[var(--ps-dim)] hover:text-[var(--ps-white)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
