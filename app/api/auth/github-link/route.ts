import { getAuthSession } from '@/lib/auth/authSession';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = crypto.randomUUID();
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', process.env.GITHUB_LINK_ID!);
  url.searchParams.set(
    'redirect_uri',
    `${process.env.NEXTAUTH_URL}/api/auth/github-link/callback`
  );
  url.searchParams.set('scope', 'read:user repo');
  url.searchParams.set('state', state);

  const response = NextResponse.redirect(url);
  response.cookies.set('gh_link_state', state, {
    httpOnly: true,
    maxAge: 1800,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
