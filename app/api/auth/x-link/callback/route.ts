import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';
import { NextRequest, NextResponse } from 'next/server';

interface XTokenResponse {
  access_token?: string;
  error?: string;
}

interface XMeResponse {
  data?: {
    id?: string;
    username?: string;
  };
  detail?: string;
}

function redirectAndClearState(target: string): NextResponse {
  const response = NextResponse.redirect(target);
  response.cookies.delete('x_link_state');
  response.cookies.delete('x_link_code_verifier');
  response.cookies.delete('x_link_return_to');
  return response;
}

function buildReturnTarget(
  req: NextRequest,
  base: string,
  status: 'linked' | 'already_linked' | 'error',
): string {
  const fallback =
    status === 'linked'
      ? `${base}/profile?tab=personal&x=linked`
      : `${base}/profile?tab=personal&x=${status}`;

  const returnTo = req.cookies.get('x_link_return_to')?.value;
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return fallback;
  }

  const target = new URL(returnTo, base);
  target.searchParams.set('x', status);
  return target.toString();
}

export async function GET(req: NextRequest) {
  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
  const errorRedirect = buildReturnTarget(req, base, 'error');

  const session = await getAuthSession();
  if (!session) {
    console.error('[x-link/callback] no session — session cookie lost on redirect from x.com');
    return redirectAndClearState(errorRedirect);
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const savedState = req.cookies.get('x_link_state')?.value;
  const codeVerifier = req.cookies.get('x_link_code_verifier')?.value;
  const xError = searchParams.get('error');
  const xErrorDescription = searchParams.get('error_description');

  if (xError) {
    console.error('[x-link/callback] x.com returned error', { xError, xErrorDescription });
    return redirectAndClearState(errorRedirect);
  }
  if (!code) {
    console.error('[x-link/callback] missing code in query');
    return redirectAndClearState(errorRedirect);
  }
  if (!state || state !== savedState) {
    console.error('[x-link/callback] state mismatch', {
      hasQueryState: !!state,
      hasSavedState: !!savedState,
      match: state === savedState,
    });
    return redirectAndClearState(errorRedirect);
  }
  if (!codeVerifier) {
    console.error('[x-link/callback] missing code_verifier cookie — likely dropped by browser');
    return redirectAndClearState(errorRedirect);
  }

  const clientId = process.env.X_LINK_ID;
  const clientSecret = process.env.X_LINK_SECRET;
  if (!clientId || !clientSecret) {
    console.error('[x-link/callback] missing X_LINK_ID or X_LINK_SECRET env vars');
    return redirectAndClearState(errorRedirect);
  }

  const redirectUri = `${base}/api/auth/x-link/callback`;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  const tokenData = (await tokenRes.json()) as XTokenResponse;
  if (!tokenRes.ok || !tokenData.access_token) {
    console.error('[x-link/callback] token exchange failed', {
      status: tokenRes.status,
      body: tokenData,
      redirectUri,
    });
    return redirectAndClearState(errorRedirect);
  }

  const meRes = await fetch('https://api.twitter.com/2/users/me', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });
  const me = (await meRes.json()) as XMeResponse;
  const username = me.data?.username;

  if (!meRes.ok || !username) {
    console.error('[x-link/callback] /users/me failed', {
      status: meRes.status,
      body: me,
    });
    return redirectAndClearState(errorRedirect);
  }

  const xUrl = `https://x.com/${username}`;
  const alreadyLinkedUser = await prisma.user.findFirst({
    where: {
      x_account: xUrl,
      NOT: { id: session.user.id },
    },
    select: { id: true },
  });

  if (alreadyLinkedUser) {
    return redirectAndClearState(buildReturnTarget(req, base, 'already_linked'));
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      x_account: xUrl,
    },
  });

  return redirectAndClearState(buildReturnTarget(req, base, 'linked'));
}
