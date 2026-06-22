import type { SessionUser } from './types/user';

export type AuthTokenResponse = {
  access?: string;
  refresh?: string;
  message?: string;
  details?: string;
};

type SsoUserResponse = {
  status?: string;
  message?: string;
  user?: {
    _id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    pspay_id?: string;
  };
};

export class SsoLoginError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'SsoLoginError';
    this.status = status;
  }
}

export function parseJwtPayload(token: string): Record<string, string> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, string>;
  } catch {
    return null;
  }
}

function authTokenUrl(): string {
  return process.env.AUTH_TOKEN_URL || 'https://auth.pinksurfing.com/api/token/';
}

function authRefreshUrl(): string {
  const tokenUrl = authTokenUrl();
  if (tokenUrl.includes('/token/')) {
    return tokenUrl.replace(/\/token\/?$/, '/token/refresh/');
  }
  return 'https://auth.pinksurfing.com/api/token/refresh/';
}

function authGoogleTokenUrl(): string {
  return (
    process.env.AUTH_GOOGLE_TOKEN_URL ||
    process.env.AUTH_TOKEN_URL?.replace(/\/token\/?$/, '/auth/google/mobile/') ||
    'https://auth.pinksurfing.com/api/auth/google/mobile/'
  );
}

export function appApiBase(): string {
  const explicit = process.env.APP_API_URL || process.env.INTERNAL_APP_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  // Dev/cloud: use gateway public URL when APP_API_URL is unset (e.g. localhost:8080/api/app)
  const publicApi = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (publicApi && process.env.NODE_ENV === 'development') {
    return publicApi;
  }

  return 'http://127.0.0.1:6003';
}

function userIdFromJwtPayload(payload: Record<string, string> | null): string {
  if (!payload) return '';
  return (
    payload.user_id ||
    payload.id ||
    payload._id ||
    payload.sub ||
    ''
  );
}

export function isProductionAuthMode(): boolean {
  return (
    process.env.AUTH_MODE !== 'local' &&
    process.env.NEXT_PUBLIC_AUTH_MODE === 'production'
  );
}

export async function fetchPasswordSsoToken(
  email: string,
  password: string
): Promise<{ access: string; refresh?: string }> {
  const authRes = await fetch(authTokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const authBody = (await authRes.json().catch(() => ({}))) as AuthTokenResponse;

  if (!authRes.ok) {
    throw new SsoLoginError(
      authBody.message || authBody.details || `Auth server error (${authRes.status})`,
      authRes.status
    );
  }

  if (authBody.message === 'User does not exits') {
    throw new SsoLoginError('User does not exist', 401);
  }

  const access = authBody.access;
  if (!access) {
    throw new SsoLoginError('Invalid email or password', 401);
  }

  return { access, refresh: authBody.refresh };
}

export async function refreshSsoAccessToken(
  refresh: string | undefined,
  cookieHeader?: string | null
): Promise<{ access: string; refresh?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookieHeader) headers.Cookie = cookieHeader;

  const authRes = await fetch(authRefreshUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify(refresh ? { refresh } : {}),
  });

  const authBody = (await authRes.json().catch(() => ({}))) as AuthTokenResponse;

  if (!authRes.ok) {
    throw new SsoLoginError(
      authBody.message || authBody.details || `Token refresh failed (${authRes.status})`,
      authRes.status
    );
  }

  const access = authBody.access;
  if (!access) {
    throw new SsoLoginError('Token refresh returned no access token', 401);
  }

  return { access, refresh: authBody.refresh };
}

export async function fetchGoogleSsoToken(idToken: string): Promise<string> {
  const url = authGoogleTokenUrl();
  const authRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken }),
  });

  const authBody = (await authRes.json().catch(() => ({}))) as AuthTokenResponse;

  if (!authRes.ok) {
    if (authRes.status === 404) {
      throw new SsoLoginError(
        'Google sign-in is not enabled on the auth service. Deploy POST /api/auth/google/mobile/.',
        503
      );
    }
    throw new SsoLoginError(
      authBody.message || authBody.details || `Google auth server error (${authRes.status})`,
      authRes.status
    );
  }

  const access = authBody.access;
  if (!access) {
    throw new SsoLoginError(authBody.message || 'Google sign-in failed', 401);
  }

  return access;
}

export async function syncRaihanUser(
  access: string,
  emailFallback: string
): Promise<Omit<SessionUser, 'mode'>> {
  let user: Omit<SessionUser, 'mode'> = {
    id: '',
    email: emailFallback,
    firstName: undefined,
    lastName: undefined,
    pspayId: undefined,
  };

  try {
    const ssoRes = await fetch(`${appApiBase()}/users/create-customer-from-sso`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access}`,
      },
    });

    const ssoBody = (await ssoRes.json().catch(() => ({}))) as SsoUserResponse;

    if (ssoRes.ok && ssoBody.user?._id) {
      user = {
        id: ssoBody.user._id,
        email: ssoBody.user.email || emailFallback,
        firstName: ssoBody.user.firstName,
        lastName: ssoBody.user.lastName,
        pspayId: ssoBody.user.pspay_id,
      };
    } else if (!ssoRes.ok) {
      const payload = parseJwtPayload(access);
      user.id = userIdFromJwtPayload(payload);
      if (!user.id) {
        throw new SsoLoginError(
          `SSO login succeeded but Raihan returned ${ssoRes.status} at ${appApiBase()}. Start full mobileapi on :6003 or set APP_API_URL to the live mobileapi host.`,
          503
        );
      }
      if (payload?.email) user.email = payload.email;
      if (payload?.first_name) user.firstName = payload.first_name;
      if (payload?.last_name) user.lastName = payload.last_name;
    }
  } catch (e) {
    if (e instanceof SsoLoginError) throw e;

    const payload = parseJwtPayload(access);
    const jwtUserId = userIdFromJwtPayload(payload);
    if (process.env.SSO_SYNC_OPTIONAL === 'true' && jwtUserId) {
      return {
        id: jwtUserId,
        email: payload?.email || emailFallback,
        firstName: payload?.first_name,
        lastName: payload?.last_name,
      };
    }

    throw new SsoLoginError(
      `Could not reach Raihan mobileapi at ${appApiBase()} (SSO may have accepted your password). ` +
        'Set APP_API_URL in apps/web/.env.local — e.g. https://mobileapi.pinksurfing.com — or start mobileapi on :6003. ' +
        'For UI-only testing: SSO_SYNC_OPTIONAL=true if the JWT contains user_id.',
      503
    );
  }

  if (!user.id) {
    throw new SsoLoginError('Could not resolve user id after login', 500);
  }

  return user;
}

export async function completeSsoSession(
  access: string,
  emailFallback: string,
  refresh?: string
): Promise<{ token: string; refresh?: string; user: SessionUser }> {
  const user = await syncRaihanUser(access, emailFallback);
  return {
    token: access,
    refresh,
    user: { ...user, mode: 'sso' },
  };
}

export function emailFromIdToken(idToken: string): string {
  const payload = parseJwtPayload(idToken);
  return payload?.email || '';
}
