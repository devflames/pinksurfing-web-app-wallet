import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  completeSsoSession,
  parseJwtPayload,
} from '@/lib/sso-login';

/** After SSO redirect flow sets HttpOnly cookies on localhost:8888 */
export async function GET() {
  const jar = await cookies();
  const access = jar.get('access_token')?.value;

  if (!access) {
    return NextResponse.json(
      { message: 'No SSO session cookie — sign in again' },
      { status: 401 }
    );
  }

  try {
    const payload = parseJwtPayload(access);
    const email = payload?.email || 'sso-user@pinksurfing.com';
    const session = await completeSsoSession(access, email);
    return NextResponse.json({
      token: access,
      user: session.user,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'SSO session bootstrap failed';
    return NextResponse.json({ message }, { status: 401 });
  }
}
