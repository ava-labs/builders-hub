import { getAuthSession } from '@/lib/auth/authSession';
import { encryptToken } from '@/lib/github-token';
import { prisma } from '@/prisma/prisma';
import { NextRequest, NextResponse } from 'next/server';

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
}

interface GitHubUserResponse {
  login?: string;
  message?: string;
}

/**
 * Builds a redirect response and always clears the `gh_link_state` cookie.
 * Centralizing this guarantees no error branch leaks the one-time CSRF state
 * cookie back to the client.
 */
function redirectAndClearState(target: string): NextResponse {
  const response = NextResponse.redirect(target);
  response.cookies.delete('gh_link_state');
  return response;
}

export async function GET(req: NextRequest) {
  const base = process.env.NEXTAUTH_URL ?? '';
  const errorRedirect = `${base}/profile?gh=error`;

  const session = await getAuthSession();
  if (!session) {
    return redirectAndClearState(errorRedirect);
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const savedState = req.cookies.get('gh_link_state')?.value;

  if (!code || !state || state !== savedState) {
    return redirectAndClearState(errorRedirect);
  }

  const clientId = process.env.GITHUB_LINK_ID!;
  const clientSecret = process.env.GITHUB_LINK_SECRET!;
  const redirectUri = `${base}/api/auth/github-link/callback`;

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });

  const tokenData = (await tokenRes.json()) as GitHubTokenResponse;

  if (!tokenData.access_token) {
    return redirectAndClearState(errorRedirect);
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  const githubUser = (await userRes.json()) as GitHubUserResponse;

  if (!githubUser.login) {
    return redirectAndClearState(errorRedirect);
  }

  const githubUrl = `https://github.com/${githubUser.login}`;

  const alreadyLinkedUser = await prisma.user.findFirst({
    where: {
      github: githubUrl,
      NOT: { id: session.user.id },
    },
    select: { id: true },
  });

  if (alreadyLinkedUser) {
    return redirectAndClearState(`${base}/profile?gh=already_linked`);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      github: githubUrl,
      github_access_token: encryptToken(tokenData.access_token),
    },
  });

  return redirectAndClearState(`${base}/profile?tab=personal&gh=linked`);
}
