/** Base path when hosted under a subpath (e.g. https://pinksurfing.com/app) */
export function getBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || '';
  if (!raw || raw === '/') return '';
  return raw.startsWith('/') ? raw.replace(/\/$/, '') : `/${raw.replace(/\/$/, '')}`;
}

/** Prefix an app-internal path (API routes, assets) with basePath */
export function withBasePath(path: string): string {
  const base = getBasePath();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
