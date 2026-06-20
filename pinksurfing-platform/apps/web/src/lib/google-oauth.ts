import { withBasePath } from './base-path';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    process.env.APP_ORIGIN ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

/** Absolute URL for Next.js API redirects (relative paths are rejected). */
export function absoluteAppUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${appOrigin()}${withBasePath(p)}`;
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      googleRedirectUri()
  );
}

export function googleRedirectUri(): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI.replace(/\/$/, '');
  }
  const origin = appOrigin();
  return `${origin}${withBasePath('/api/auth/google/callback')}`;
}

export function buildGoogleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

type GoogleTokenResponse = {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeGoogleAuthCode(code: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are not configured');
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });

  const body = (await res.json().catch(() => ({}))) as GoogleTokenResponse;

  if (!res.ok || !body.id_token) {
    throw new Error(body.error_description || body.error || 'Google token exchange failed');
  }

  return body.id_token;
}

export function loginRedirectWithError(message: string): string {
  return absoluteAppUrl(`/?auth_error=${encodeURIComponent(message)}`);
}

export function googleCompleteRedirect(): string {
  return absoluteAppUrl('/auth/google/complete');
}
