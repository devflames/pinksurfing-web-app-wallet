const STORAGE_KEY = 'ps-invoice-counter';

function counterKey(email: string): string {
  return `${STORAGE_KEY}:${email || 'guest'}`;
}

export function nextInvoiceNumber(email: string): string {
  if (typeof window === 'undefined') return '00001';
  const key = counterKey(email);
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? parseInt(raw, 10) : 0;
    const next = Number.isFinite(n) ? n + 1 : 1;
    localStorage.setItem(key, String(next));
    return String(next).padStart(5, '0');
  } catch {
    return '00001';
  }
}

export function peekInvoiceNumber(email: string): string {
  if (typeof window === 'undefined') return '00001';
  try {
    const raw = localStorage.getItem(counterKey(email));
    const n = raw ? parseInt(raw, 10) : 0;
    const next = Number.isFinite(n) ? n + 1 : 1;
    return String(next).padStart(5, '0');
  } catch {
    return '00001';
  }
}
