/** Fixed PayChat dial amounts — 50 steps from $0.10 to $25,000 */
export const PAYCHAT_PRICES: readonly number[] = [
  0.1, 0.25, 0.33, 0.5, 0.75,
  1, 1.5, 2, 2.5, 3,
  4, 5, 7.5, 10, 12.5,
  13, 15, 20, 25, 30,
  40, 50, 60, 69, 75,
  100, 125, 150, 200, 250,
  275, 300, 400, 500, 600,
  750, 1000, 1250, 1500, 2000,
  2500, 3000, 3500, 4000, 5000,
  6000, 7500, 8000, 10000, 25000,
] as const;

export const PAYCHAT_STEPS = PAYCHAT_PRICES.length;
export const PAYCHAT_MIN_USD = PAYCHAT_PRICES[0];
export const PAYCHAT_MAX_USD = PAYCHAT_PRICES[PAYCHAT_PRICES.length - 1];

export function paychatPriceForStep(step: number): number {
  const s = Math.max(0, Math.min(PAYCHAT_STEPS - 1, Math.round(step)));
  return PAYCHAT_PRICES[s];
}

export function paychatStepForPrice(price: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < PAYCHAT_PRICES.length; i++) {
    const diff = Math.abs(PAYCHAT_PRICES[i] - price);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

export function formatPaychatPrice(usd: number): string {
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Knob rotation degrees — step 0 at ~225°, clockwise increases */
export function paychatKnobDegrees(step: number): number {
  const s = Math.max(0, Math.min(PAYCHAT_STEPS - 1, step));
  return 225 + (s / (PAYCHAT_STEPS - 1)) * 270;
}
