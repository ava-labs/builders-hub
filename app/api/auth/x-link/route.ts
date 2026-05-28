import { getAuthSession } from '@/lib/auth/authSession';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function base64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export async function GET(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
  const clientId = process.env.X_LINK_ID;
  if (!clientId) {
    console.error('Missing X_LINK_ID for X account linking');
    return NextResponse.redirect(`${base}/profile?x=error`);
  }

  const state = crypto.randomUUID();
  const codeVerifier = base64Url(crypto.randomBytes(32));
  const codeChallenge = base64Url(
    crypto.createHash('sha256').update(codeVerifier).digest(),
  );

  const url = new URL('https://twitter.com/i/oauth2/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', `${base}/api/auth/x-link/callback`);
  url.searchParams.set('scope', 'users.read tweet.read');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  const response = NextResponse.redirect(url);
  response.cookies.set('x_link_state', state, {
    httpOnly: true,
    maxAge: 1800,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  response.cookies.set('x_link_code_verifier', codeVerifier, {
    httpOnly: true,
    maxAge: 1800,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  const requestedReturnTo = new URL(req.url).searchParams.get('returnTo');
  if (
    requestedReturnTo &&
    requestedReturnTo.startsWith('/') &&
    !requestedReturnTo.startsWith('//')
  ) {
    response.cookies.set('x_link_return_to', requestedReturnTo, {
      httpOnly: true,
      maxAge: 1800,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}
