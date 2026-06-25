/** Short git SHA or env label — set at build/dev start via NEXT_PUBLIC_BUILD_SHA */
export const BUILD_SHA =
  process.env.NEXT_PUBLIC_BUILD_SHA?.trim() || 'dev';

export const BUILD_LABEL = BUILD_SHA.length > 7 ? BUILD_SHA.slice(0, 7) : BUILD_SHA;

export const APP_TITLE = 'PinkSurfing';

export function appDocumentTitle(section?: string): string {
  const base = section ? `${section} · ${APP_TITLE}` : APP_TITLE;
  return `${base} (${BUILD_LABEL})`;
}
