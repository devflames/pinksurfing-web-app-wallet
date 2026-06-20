/**
 * Smoke tests for SSO + OAuth session helpers (no live Google/SSO required).
 * Run: npx tsx scripts/test-sso-oauth.mjs
 */
import {
  cookieOptions,
  createOAuthState,
  openOAuthBootstrap,
  sealOAuthBootstrap,
  verifyOAuthState,
} from '../apps/web/src/lib/oauth-session.ts';
import {
  googleRedirectUri,
  isGoogleAuthConfigured,
  loginRedirectWithError,
} from '../apps/web/src/lib/google-oauth.ts';
import { parseJwtPayload } from '../apps/web/src/lib/sso-login.ts';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('OK:', msg);
  }
}

// OAuth state roundtrip
const state = await createOAuthState();
assert(typeof state === 'string' && state.length > 20, 'createOAuthState returns signed token');
assert(await verifyOAuthState(state), 'verifyOAuthState accepts valid state');
assert(!(await verifyOAuthState('invalid')), 'verifyOAuthState rejects invalid state');

// Bootstrap session roundtrip
const sampleUser = {
  id: 'user-1',
  email: 'test@example.com',
  mode: 'sso',
};
const sealed = await sealOAuthBootstrap({ token: 'jwt-access', user: sampleUser });
const opened = await openOAuthBootstrap(sealed);
assert(opened?.token === 'jwt-access', 'bootstrap opens token');
assert(opened?.user?.email === 'test@example.com', 'bootstrap opens user');
assert(openOAuthBootstrap('bad') === null || (await openOAuthBootstrap('bad')) === null, 'bootstrap rejects bad seal');

// Cookie options
const opts = cookieOptions(60);
assert(opts.httpOnly === true && opts.sameSite === 'lax', 'cookieOptions secure defaults');

// Google config helper (env may be unset in CI)
assert(typeof isGoogleAuthConfigured() === 'boolean', 'isGoogleAuthConfigured returns boolean');
assert(googleRedirectUri().includes('/api/auth/google/callback'), 'googleRedirectUri includes callback path');
assert(loginRedirectWithError('test').startsWith('http'), 'loginRedirectWithError is absolute URL');

// JWT parse helper
const fakePayload = Buffer.from(JSON.stringify({ email: 'a@b.com', sub: '123' })).toString('base64url');
const fakeJwt = `hdr.${fakePayload}.sig`;
const parsed = parseJwtPayload(fakeJwt);
assert(parsed?.email === 'a@b.com', 'parseJwtPayload reads email');

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll SSO/OAuth helper checks passed.');
