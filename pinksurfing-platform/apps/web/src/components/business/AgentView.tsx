'use client';

import type { BusinessContract } from '@/lib/types/contract';
import { formatMoney } from '@/lib/contract-utils';

type Props = {
  contract: BusinessContract | null;
  onBack: () => void;
  onApprove?: () => void;
};

function Step({
  done,
  blocked,
  children,
}: {
  done?: boolean;
  blocked?: boolean;
  children: React.ReactNode;
}) {
  const icon = done ? '✓' : blocked ? '🔒' : '✗';
  const color = done ? 'text-[var(--ps-green,#5DCAA5)]' : 'text-[var(--ps-dim)]';
  return (
    <div className={`flex items-center gap-1.5 text-[9px] ${color}`}>
      <span className="w-3 shrink-0 text-center">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

export function AgentView({ contract, onBack, onApprove }: Props) {
  const gated =
    contract &&
    !['COMPLETED', 'VERIFIED', 'CANCELLED'].includes(contract.state);

  const approvedOrLater =
    contract &&
    ['APPROVED', 'PAID_OFF_PLATFORM', 'ESCROW_FUNDING_INITIATED', 'ESCROW_FUNDED', 'IN_PROGRESS', 'EVIDENCE_SUBMITTED', 'VERIFIED', 'COMPLETED'].includes(
      contract.state
    );

  const fundedOrLater =
    contract &&
    ['PAID_OFF_PLATFORM', 'ESCROW_FUNDED', 'IN_PROGRESS', 'EVIDENCE_SUBMITTED', 'VERIFIED', 'COMPLETED'].includes(
      contract.state
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2.5">
      <div className="rounded-[10px] border border-[#1E3A5F] bg-[#0D1220] p-2.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-[#1E3A5F] text-[11px] text-[var(--ps-cyan)]">
            🤖
          </div>
          <span className="text-[10px] font-medium text-[var(--ps-cyan)]">PinkSurfing AI Agent</span>
          <span
            className={`ml-auto rounded border px-1.5 text-[8px] ${
              gated
                ? 'border-[#E24B4A50] bg-[#E24B4A20] text-[var(--ps-red)]'
                : 'border-[#5DCAA550] bg-[#5DCAA520] text-[var(--ps-green,#5DCAA5)]'
            }`}
          >
            {gated ? 'GATED' : 'AUTHORIZED'}
          </span>
        </div>

        <p className="text-[10px] leading-relaxed text-[var(--ps-muted)]">
          {gated && contract ? (
            <>
              This agent wants to execute:{' '}
              <strong className="text-[var(--ps-white)]">
                Process payment for {contract.title}
              </strong>
              . Agent action is blocked — must pass through the PinkSurfing execution-control
              layer first.
            </>
          ) : (
            'Agent authorized. Execution receipt available.'
          )}
        </p>

        {gated && contract ? (
          <>
            <div className="mt-1.5 flex flex-col gap-0.5">
              <Step done>Delegation granted (agent_procurement_v1)</Step>
              <Step done>
                Intent admitted (procure · {formatMoney(contract.priceAmount, contract.priceCurrency)})
              </Step>
              <Step done={!!approvedOrLater} blocked={!approvedOrLater}>
                {approvedOrLater
                  ? 'Resources reserved'
                  : 'Awaiting approval → resources cannot be reserved'}
              </Step>
              <Step blocked={!fundedOrLater}>Recipient gating — pending</Step>
              <Step blocked>Authorization artifact — blocked</Step>
              <Step blocked>Execution — BLOCKED</Step>
            </div>
            <div className="mt-2 rounded-md border border-[#E24B4A30] bg-[#E24B4A10] p-2 text-[9px] text-[var(--ps-red)]">
              The agent cannot execute directly. It must wait for authorization artifact issuance
              through the state machine.
            </div>
          </>
        ) : (
          <div className="mt-1.5 flex flex-col gap-0.5">
            <Step done>All gates passed</Step>
            <Step done>Authorization artifact issued</Step>
            <Step done>Executed · Receipt available</Step>
          </div>
        )}
      </div>

      <div className="mt-1 rounded-[10px] border border-[#1E3A5F] bg-[#0D1220] p-2.5 text-[10px] leading-relaxed text-[var(--ps-muted)]">
        <strong className="text-[var(--ps-cyan)]">Why is the agent gated?</strong>
        <br />
        PinkSurfing is a mandatory execution-control layer. Agents submit proposed actions. The
        platform checks: delegation valid → intent admissible → resources reserved → counterparty
        accepts → only then is an authorization artifact issued. No artifact = no execution.
      </div>

      <div className="mt-auto flex shrink-0 justify-center gap-2 border-t border-[var(--ps-brd)] pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-[#6EE7FF50] bg-[#6EE7FF15] px-3.5 py-1.5 text-[10px] text-[var(--ps-cyan)]"
        >
          ← Back to chat
        </button>
        {contract && contract.state === 'PENDING_APPROVAL' && onApprove && (
          <button
            type="button"
            onClick={onApprove}
            className="rounded-md border border-[#5DCAA550] bg-[#5DCAA515] px-3.5 py-1.5 text-[10px] text-[var(--ps-green,#5DCAA5)]"
          >
            Approve deal
          </button>
        )}
      </div>
    </div>
  );
}
