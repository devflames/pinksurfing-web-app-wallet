export type ExpiryStatus = 'none' | 'ok' | 'warning' | 'expired';

const WARNING_DAYS = 30;

export function parseExpiryDate(value: string): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function expiryStatus(expirationDate: string): ExpiryStatus {
  const exp = parseExpiryDate(expirationDate);
  if (!exp) return 'none';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expDay = new Date(exp);
  expDay.setHours(0, 0, 0, 0);
  if (expDay < now) return 'expired';
  const warningAt = new Date(now);
  warningAt.setDate(warningAt.getDate() + WARNING_DAYS);
  if (expDay <= warningAt) return 'warning';
  return 'ok';
}

export function expiryLabel(status: ExpiryStatus, expirationDate: string): string | null {
  if (status === 'none' || !expirationDate) return null;
  const formatted = formatExpiryDate(expirationDate);
  if (status === 'expired') return `Expired ${formatted}`;
  if (status === 'warning') return `Expires ${formatted} — renew within 30 days`;
  return `Expires ${formatted}`;
}

export function formatExpiryDate(value: string): string {
  const d = parseExpiryDate(value);
  if (!d) return value;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysUntilExpiry(expirationDate: string): number | null {
  const exp = parseExpiryDate(expirationDate);
  if (!exp) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expDay = new Date(exp);
  expDay.setHours(0, 0, 0, 0);
  return Math.round((expDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
