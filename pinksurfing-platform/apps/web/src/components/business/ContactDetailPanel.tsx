'use client';

import type { Contact } from '@pinksurfing/ui';
import type { BusinessContract } from '@/lib/types/contract';
import { STATE_LABELS } from '@/lib/contract-utils';
import { contractId } from '@/lib/types/contract';

const TIMELINE_STEPS: { key: string; label: string; dot: string; states: string[] }[] = [
  { key: 'offer', label: 'Offer sent', dot: '#EF9F27', states: ['DRAFT', 'PENDING_APPROVAL'] },
  { key: 'approved', label: 'Approved', dot: '#5DCAA5', states: ['APPROVED'] },
  {
    key: 'funded',
    label: 'Funded',
    dot: '#6EE7FF',
    states: ['PAID_OFF_PLATFORM', 'ESCROW_FUNDING_INITIATED', 'ESCROW_FUNDED'],
  },
  { key: 'work', label: 'Work started', dot: '#FF7AD1', states: ['IN_PROGRESS', 'EVIDENCE_SUBMITTED'] },
  { key: 'settled', label: 'Settled', dot: '#5DCAA5', states: ['VERIFIED', 'COMPLETED'] },
];

function stepDone(contract: BusinessContract | null, stepIndex: number): boolean {
  if (!contract) return false;
  const order = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID_OFF_PLATFORM', 'ESCROW_FUNDING_INITIATED', 'ESCROW_FUNDED', 'IN_PROGRESS', 'EVIDENCE_SUBMITTED', 'VERIFIED', 'COMPLETED'];
  const idx = order.indexOf(contract.state);
  const thresholds = [0, 1, 2, 5, 6, 8];
  return idx >= thresholds[stepIndex];
}

type Props = {
  contact: Contact;
  contracts: BusinessContract[];
  paychatLocked?: boolean;
  onViewBusinessProfile?: () => void;
};

export function ContactDetailPanel({
  contact,
  contracts,
  paychatLocked = false,
  onViewBusinessProfile,
}: Props) {
  const primary = contracts[0] ?? null;
  const isPaychat = contact.type === 'paychat';
  const isBusiness = contact.type === 'business';

  if (isPaychat && paychatLocked) {
    return (
      <div className="p-4 text-center">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-medium opacity-50 blur-[1px]"
          style={{ background: contact.bg, color: contact.color }}
        >
          {contact.initials}
        </div>
        <div className="mt-3 text-[10px] font-medium text-[var(--ps-pink)]">PayChat gated</div>
        <p className="mt-2 text-[9px] leading-relaxed text-[var(--ps-dim)]">
          Profile and contact details are hidden until you unlock this PayChat. Scan their card or
          pay the ask price to connect.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="p-3 text-center">
        {isBusiness && onViewBusinessProfile ? (
          <button
            type="button"
            onClick={onViewBusinessProfile}
            className="mx-auto block rounded-full transition-transform hover:scale-105"
            title="View business profile"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-medium ring-2 ring-[var(--ps-green)]/40"
              style={{ background: contact.bg, color: contact.color }}
            >
              {contact.initials}
            </div>
          </button>
        ) : (
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-medium"
            style={{ background: contact.bg, color: contact.color }}
          >
            {contact.initials}
          </div>
        )}
        <div className="mt-1.5 text-xs font-medium text-[var(--ps-white)]">{contact.name}</div>
        <div className="text-[9px] capitalize text-[var(--ps-muted)]">
          {isBusiness
            ? 'Business contact'
            : isPaychat
              ? 'PayChat'
              : 'Contact'}
        </div>
        {isBusiness && onViewBusinessProfile && (
          <button
            type="button"
            onClick={onViewBusinessProfile}
            className="mt-2 text-[9px] text-[var(--ps-cyan)] hover:underline"
          >
            View business profile →
          </button>
        )}
        <div className="mt-2 flex justify-center gap-4">
          <div className="text-center">
            <div className="text-sm font-medium text-[var(--ps-white)]">{contracts.length}</div>
            <div className="text-[8px] text-[var(--ps-dim)]">Contracts</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-[var(--ps-white)]">100%</div>
            <div className="text-[8px] text-[var(--ps-dim)]">On time</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-[var(--ps-white)]">
              {isPaychat && contact.askUsd ? `$${contact.askUsd.toFixed(2)}` : '–'}
            </div>
            <div className="text-[8px] text-[var(--ps-dim)]">
              {isPaychat ? 'Ask price' : 'Rating'}
            </div>
          </div>
        </div>
      </div>

      {primary && isBusiness && (
        <div className="border-t border-[var(--ps-brd)] px-3 py-2">
          <div className="mb-2 text-[9px] uppercase tracking-wide text-[var(--ps-muted)]">
            Execution timeline
          </div>
          <div className="space-y-2">
            {TIMELINE_STEPS.map((step, i) => {
              const done = stepDone(primary, i);
              return (
                <div key={step.key} className="relative flex items-start gap-2 pl-0.5">
                  {i < TIMELINE_STEPS.length - 1 && (
                    <div
                      className="absolute left-[5px] top-3 h-[calc(100%+4px)] w-px"
                      style={{ background: done ? step.dot : 'var(--ps-brd)', opacity: done ? 0.35 : 0.15 }}
                    />
                  )}
                  <div
                    className="relative z-[1] mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: done ? step.dot : 'var(--ps-brd)' }}
                  />
                  <div>
                    <div
                      className="text-[10px]"
                      style={{ color: done ? 'var(--ps-white)' : 'var(--ps-dim)' }}
                    >
                      {step.label}
                    </div>
                    <div className="text-[8px] text-[var(--ps-dim)]">
                      {done ? 'Completed' : 'Pending'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {primary.settlementMode === 'SQUARE' && (
            <div className="mt-2 rounded-md border border-[#6EE7FF30] bg-[#6EE7FF10] p-2 text-[9px] text-[var(--ps-cyan)]">
              💳 Square payment gateway
            </div>
          )}
          {primary.settlementMode === 'BTC_SWAP' && (
            <div className="mt-2 rounded-md border border-[#F7931A30] bg-[#F7931A10] p-2 text-[9px] text-[#F7931A]">
              ₿ BTC submarine swap
            </div>
          )}
        </div>
      )}

      {isBusiness && (
        <div className="border-t border-[var(--ps-brd)] px-3 py-2">
          <div className="mb-2 text-[9px] uppercase tracking-wide text-[var(--ps-muted)]">
            Contracts ({contracts.length})
          </div>
          <div className="space-y-2">
            {contracts.slice(0, 4).map((c) => (
              <div key={contractId(c)} className="text-[10px]">
                <div className="font-medium text-[var(--ps-white)]">{c.title}</div>
                <div className="text-[var(--ps-dim)]">{STATE_LABELS[c.state]}</div>
              </div>
            ))}
            {contracts.length === 0 && (
              <p className="text-[10px] text-[var(--ps-dim)]">None loaded</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
