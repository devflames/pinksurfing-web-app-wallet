'use client';

import { useAuth } from '@/lib/auth-context';
import { useKycStatus } from '@/hooks/use-kyc-status';
import { kycStatusLabel } from '@/lib/identity-service';

type Props = {
  affiliation: string;
};

function CertifiedBadge() {
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--ps-amber)] shadow-[0_0_8px_rgba(239,159,39,0.45)]"
      aria-hidden
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
        <path
          d="M2.5 6l2.2 2.2L9.5 3.5"
          stroke="#0e0f13"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Affiliation row — orange certified check when KYC approved; Didit CTA when not */
export function KycAffiliationRow({ affiliation }: Props) {
  const { token } = useAuth();
  const { verified, loading, starting, status, error, startVerification, refresh } =
    useKycStatus(token);

  const pending =
    status?.status === 'in_progress' || status?.status === 'in_review';

  if (loading) {
    return (
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--ps-brd)]/40 py-2.5">
        <span className="text-[11px] text-[var(--ps-dim)]">Affiliation</span>
        <span className="text-[10px] text-[var(--ps-dim)]">Checking…</span>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--ps-brd)]/40 py-2.5">
        <span className="text-[11px] text-[var(--ps-dim)]">Affiliation</span>
        <div className="flex items-center gap-2 text-right">
          <CertifiedBadge />
          <div>
            <div className="text-[11px] font-medium text-[var(--ps-white)]">{affiliation}</div>
            <div className="text-[9px] font-medium text-[var(--ps-amber)]">Identity certified</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--ps-brd)]/40 py-2.5">
      <div className="mb-1.5 text-[11px] text-[var(--ps-dim)]">Affiliation</div>
      <button
        type="button"
        onClick={() => (pending ? void refresh() : void startVerification())}
        disabled={starting}
        className="flex w-full items-center gap-3 rounded-xl border border-[var(--ps-amber)]/25 bg-gradient-to-r from-[var(--ps-amber)]/8 to-transparent px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all hover:border-[var(--ps-amber)]/45 hover:from-[var(--ps-amber)]/12 disabled:opacity-60"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ps-amber)]/30 bg-[var(--ps-amber)]/10 text-[var(--ps-amber)]">
          {starting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--ps-amber)]/30 border-t-[var(--ps-amber)]" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
              <path
                d="M12 3l7 3v6c0 4.5-3 8.5-7 9-4-.5-7-4.5-7-9V6l7-3z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M9 12l2 2 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={pending ? 1 : 0.35}
              />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-[var(--ps-white)]">{affiliation}</div>
          <div className="text-[9px] leading-snug text-[var(--ps-amber)]">
            {starting ? 'Opening Didit verification…' : kycStatusLabel(status?.status)}
          </div>
          {!pending && (
            <div className="mt-0.5 text-[8px] text-[var(--ps-dim)]">
              One-time ID check · powered by Didit
            </div>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-[var(--ps-amber)]">
          {pending ? '↻' : '→'}
        </span>
      </button>
      {error && (
        <p className="mt-1.5 text-[9px] leading-relaxed text-[var(--ps-red)]">{error}</p>
      )}
    </div>
  );
}
