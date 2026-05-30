import { getAuthSession } from '@/lib/auth/authSession';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
  const clientId = process.env.GITHUB_LINK_ID;
  if (!clientId) {
    console.error('Missing GITHUB_LINK_ID for GitHub account linking');
    return NextResponse.redirect(`${base}/profile?gh=error`);
  }

  const state = crypto.randomUUID();
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set(
    'redirect_uri',
    `${base}/api/auth/github-link/callback`
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

  // Optional same-origin path to redirect to after the callback finishes.
  // Validated as starting with "/" and not "//" to prevent open redirects.
  const requestedReturnTo = new URL(req.url).searchParams.get('returnTo');
  if (
    requestedReturnTo &&
    requestedReturnTo.startsWith('/') &&
    !requestedReturnTo.startsWith('//')
  ) {
    response.cookies.set('gh_link_return_to', requestedReturnTo, {
      httpOnly: true,
      maxAge: 1800,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}
