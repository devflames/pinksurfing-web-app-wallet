import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ message: 'Not available in production' }, { status: 403 });
  }

  const secret = process.env.JWT_SECRET || 'sso_secret_key_for_jwt_decoding';
  const userId = process.env.DEV_USER_ID || 'web-user-a';

  const token = await new SignJWT({
    id: userId,
    _id: userId,
    email: 'web-dev@test.local',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({
    token,
    userId,
    email: 'web-dev@test.local',
  });
}
