import { NextResponse } from 'next/server';
import {
  SsoLoginError,
  completeSsoSession,
  fetchPasswordSsoToken,
  isProductionAuthMode,
} from '@/lib/sso-login';

export async function POST(req: Request) {
  if (!isProductionAuthMode()) {
    return NextResponse.json(
      {
        message:
          'Local auth mode is active. Use "Continue with local stack" on the login screen (not production SSO).',
      },
      { status: 400 }
    );
  }

  try {
    const { email, password } = (await req.json()) as {
      email?: string;
      password?: string;
    };

    if (!email?.trim() || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    const access = await fetchPasswordSsoToken(email, password);
    const session = await completeSsoSession(access, email.trim());

    return NextResponse.json({
      token: session.token,
      user: session.user,
    });
  } catch (e) {
    if (e instanceof SsoLoginError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { message: e instanceof Error ? e.message : 'Login failed' },
      { status: 500 }
    );
  }
}
