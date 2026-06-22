import { NextResponse } from 'next/server';
import { refreshSsoAccessToken, SsoLoginError } from '@/lib/sso-login';

/** Refresh SSO access token using stored refresh JWT or HttpOnly refresh_token cookie. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { refresh?: string };
    const cookieHeader = req.headers.get('cookie');
    const tokens = await refreshSsoAccessToken(body.refresh, cookieHeader);

    return NextResponse.json({
      token: tokens.access,
      refresh: tokens.refresh,
    });
  } catch (e) {
    if (e instanceof SsoLoginError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { message: e instanceof Error ? e.message : 'Token refresh failed' },
      { status: 500 }
    );
  }
}
