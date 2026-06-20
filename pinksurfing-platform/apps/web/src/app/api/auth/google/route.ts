import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  buildGoogleAuthUrl,
  googleCompleteRedirect,
  isGoogleAuthConfigured,
  loginRedirectWithError,
} from '@/lib/google-oauth';
import {
  cookieOptions,
  createOAuthState,
  oauthStateCookieName,
} from '@/lib/oauth-session';
import { isProductionAuthMode } from '@/lib/sso-login';

export async function GET() {
  if (!isProductionAuthMode()) {
    return NextResponse.redirect(loginRedirectWithError('Google sign-in requires production auth mode'));
  }

  if (!isGoogleAuthConfigured()) {
    return NextResponse.redirect(
      loginRedirectWithError('Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)')
    );
  }

  try {
    const state = await createOAuthState();
    const jar = await cookies();
    jar.set(oauthStateCookieName(), state, cookieOptions(600));

    return NextResponse.redirect(buildGoogleAuthUrl(state));
  } catch (e) {
    return NextResponse.redirect(
      loginRedirectWithError(e instanceof Error ? e.message : 'Could not start Google sign-in')
    );
  }
}
