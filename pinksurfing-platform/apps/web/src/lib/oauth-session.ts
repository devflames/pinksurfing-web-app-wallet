import { SignJWT, jwtVerify } from 'jose';
import type { SessionUser } from './types/user';

const STATE_COOKIE = 'ps_oauth_state';
const BOOTSTRAP_COOKIE = 'ps_oauth_bootstrap';

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'sso_secret_key_for_jwt_decoding';
  return new TextEncoder().encode(secret);
}

export function oauthStateCookieName(): string {
  return STATE_COOKIE;
}

export function oauthBootstrapCookieName(): string {
  return BOOTSTRAP_COOKIE;
}

export async function createOAuthState(): Promise<string> {
  const value = crypto.randomUUID();
  return new SignJWT({ purpose: 'google_oauth_state' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(value)
    .setExpirationTime('10m')
    .sign(secretKey());
}

export async function verifyOAuthState(state: string): Promise<boolean> {
  try {
    await jwtVerify(state, secretKey());
    return true;
  } catch {
    return false;
  }
}

export async function sealOAuthBootstrap(session: {
  token: string;
  user: SessionUser;
}): Promise<string> {
  return new SignJWT({ token: session.token, user: session.user })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2m')
    .sign(secretKey());
}

export async function openOAuthBootstrap(
  sealed: string
): Promise<{ token: string; user: SessionUser } | null> {
  try {
    const { payload } = await jwtVerify(sealed, secretKey());
    const token = payload.token;
    const user = payload.user;
    if (typeof token !== 'string' || !user || typeof user !== 'object') return null;
    return { token, user: user as SessionUser };
  } catch {
    return null;
  }
}

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
