/**
 * PinkSurfing fee policy (Shaiquel Jilani):
 * - Total fees from all sides must not exceed 2% (below typical card ~2.9%+).
 * - Chia bridge: ~0.1–1% (+ negligible on-chain cost).
 * - BTC atomic swaps: same bridge band; non-custodial HTLC — no PinkSurfing custody fee.
 */

/** Maximum combined platform fee (all parties), percent */
export const MAX_TOTAL_FEE_PERCENT = 2;

/** Chia bridge fee band (percent of notional) */
export const CHIA_BRIDGE_FEE_PERCENT_MIN = 0.1;
export const CHIA_BRIDGE_FEE_PERCENT_MAX = 1;

/** Agora group / voice — billed via Agora; PinkSurfing does not add a platform fee on top */
export const GROUP_CALL_PLATFORM_FEE_PERCENT = 0;

export function feeCapSummary(): string {
  return `Total fees from all sides stay under ${MAX_TOTAL_FEE_PERCENT}% — less than typical card processing.`;
}

export function bridgeFeeBandLabel(): string {
  return `${CHIA_BRIDGE_FEE_PERCENT_MIN}–${CHIA_BRIDGE_FEE_PERCENT_MAX}% bridge`;
}

export function estimateBridgeFeeUsd(amountUsd: number): { minUsd: number; maxUsd: number } {
  if (amountUsd <= 0) return { minUsd: 0, maxUsd: 0 };
  return {
    minUsd: (amountUsd * CHIA_BRIDGE_FEE_PERCENT_MIN) / 100,
    maxUsd: (amountUsd * CHIA_BRIDGE_FEE_PERCENT_MAX) / 100,
  };
}

export function formatBridgeFeeEstimate(amountUsd: number): string {
  const { minUsd, maxUsd } = estimateBridgeFeeUsd(amountUsd);
  if (amountUsd <= 0) return bridgeFeeBandLabel();
  return `${bridgeFeeBandLabel()} · ~$${minUsd.toFixed(2)}–$${maxUsd.toFixed(2)} on $${amountUsd.toFixed(2)}`;
}
