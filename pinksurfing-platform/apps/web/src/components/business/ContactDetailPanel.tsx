'use client';

import type { Contact } from '@pinksurfing/ui';
import type { BusinessContract } from '@/lib/types/contract';
import { ExecutionTimeline } from '@/components/contracts/ExecutionTimeline';
import { BusinessTodoPanel } from '@/components/business/BusinessTodoPanel';
import { buildExecutionTimeline, pickActiveContract } from '@/lib/contract-timeline';
import { STATE_LABELS } from '@/lib/contract-utils';
import { contractId } from '@/lib/types/contract';

type Props = {
  contact: Contact;
  contracts: BusinessContract[];
  conversationId?: string;
  onTodosChange?: () => void;
  paychatLocked?: boolean;
  onViewBusinessProfile?: () => void;
  activeContractId?: string | null;
  onSelectContract?: (id: string) => void;
};

export function ContactDetailPanel({
  contact,
  contracts,
  conversationId,
  onTodosChange,
  paychatLocked = false,
  onViewBusinessProfile,
  activeContractId,
  onSelectContract,
}: Props) {
  const primary = pickActiveContract(contracts);
  const timelineContract =
    contracts.find((c) => contractId(c) === activeContractId) ?? primary;
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

      {isBusiness && conversationId && (
        <BusinessTodoPanel conversationId={conversationId} onChange={onTodosChange} />
      )}

      {timelineContract && isBusiness && (
        <div className="border-t border-[var(--ps-brd)] px-3 py-2">
          <div className="mb-2 text-[9px] uppercase tracking-wide text-[var(--ps-muted)]">
            Execution timeline
          </div>
          <ExecutionTimeline timeline={buildExecutionTimeline(timelineContract)} compact />
          {timelineContract.settlementMode === 'SQUARE' && (
            <div className="mt-2 rounded-md border border-[#6EE7FF30] bg-[#6EE7FF10] p-2 text-[9px] text-[var(--ps-cyan)]">
              💳 Square payment gateway
            </div>
          )}
          {timelineContract.settlementMode === 'BTC_SWAP' && (
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
          <div className="space-y-1.5">
            {contracts.map((c) => {
              const id = contractId(c);
              const selected = activeContractId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectContract?.(id)}
                  className={`w-full rounded-lg border px-2 py-1.5 text-left ${
                    selected
                      ? 'border-[var(--ps-pink)]/40 bg-[var(--ps-pink)]/10'
                      : 'border-transparent hover:bg-[var(--ps-surf)]'
                  }`}
                >
                  <div className="truncate text-[10px] font-medium text-[var(--ps-white)]">
                    {c.title}
                  </div>
                  <div className="text-[9px] text-[var(--ps-dim)]">{STATE_LABELS[c.state]}</div>
                </button>
              );
            })}
            {contracts.length === 0 && (
              <p className="text-[10px] text-[var(--ps-dim)]">None loaded</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
