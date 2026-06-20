import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  exchangeGoogleAuthCode,
  googleCompleteRedirect,
  loginRedirectWithError,
} from '@/lib/google-oauth';
import {
  cookieOptions,
  oauthBootstrapCookieName,
  oauthStateCookieName,
  sealOAuthBootstrap,
  verifyOAuthState,
} from '@/lib/oauth-session';
import {
  SsoLoginError,
  completeSsoSession,
  emailFromIdToken,
  fetchGoogleSsoToken,
  isProductionAuthMode,
} from '@/lib/sso-login';

export async function GET(req: Request) {
  if (!isProductionAuthMode()) {
    return NextResponse.redirect(loginRedirectWithError('Google sign-in requires production auth mode'));
  }

  const url = new URL(req.url);
  const error = url.searchParams.get('error');
  if (error) {
    return NextResponse.redirect(
      loginRedirectWithError(url.searchParams.get('error_description') || error)
    );
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return NextResponse.redirect(loginRedirectWithError('Missing Google OAuth response'));
  }

  const jar = await cookies();
  const savedState = jar.get(oauthStateCookieName())?.value;
  jar.delete(oauthStateCookieName());

  if (!savedState || savedState !== state || !(await verifyOAuthState(state))) {
    return NextResponse.redirect(loginRedirectWithError('Invalid OAuth state — try again'));
  }

  try {
    const idToken = await exchangeGoogleAuthCode(code);
    const access = await fetchGoogleSsoToken(idToken);
    const email = emailFromIdToken(idToken) || 'google-user@pinksurfing.com';
    const session = await completeSsoSession(access, email);

    const sealed = await sealOAuthBootstrap(session);
    jar.set(oauthBootstrapCookieName(), sealed, cookieOptions(120));

    return NextResponse.redirect(googleCompleteRedirect());
  } catch (e) {
    const message =
      e instanceof SsoLoginError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Google sign-in failed';
    return NextResponse.redirect(loginRedirectWithError(message));
  }
}
