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

export async function GET(req: NextRequest) {
  const base = process.env.NEXTAUTH_URL ?? '';

  const session = await getAuthSession();
  if (!session) {
    return NextResponse.redirect(`${base}/profile?gh=error`);
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const savedState = req.cookies.get('gh_link_state')?.value;

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${base}/profile?gh=error`);
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
    return NextResponse.redirect(`${base}/profile?gh=error`);
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  const githubUser = (await userRes.json()) as GitHubUserResponse;

  if (!githubUser.login) {
    return NextResponse.redirect(`${base}/profile?gh=error`);
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
    return NextResponse.redirect(`${base}/profile?gh=already_linked`);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      github: githubUrl,
      github_access_token: encryptToken(tokenData.access_token),
    },
  });

  const response = NextResponse.redirect(`${base}/profile?tab=personal&gh=linked`);
  response.cookies.delete('gh_link_state');
  return response;
}
