import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { oauthBootstrapCookieName, openOAuthBootstrap } from '@/lib/oauth-session';

export async function GET() {
  const jar = await cookies();
  const sealed = jar.get(oauthBootstrapCookieName())?.value;
  jar.delete(oauthBootstrapCookieName());

  if (!sealed) {
    return NextResponse.json({ message: 'No pending sign-in session' }, { status: 401 });
  }

  const session = await openOAuthBootstrap(sealed);
  if (!session) {
    return NextResponse.json({ message: 'Sign-in session expired — try again' }, { status: 401 });
  }

  return NextResponse.json({
    token: session.token,
    user: session.user,
  });
}
