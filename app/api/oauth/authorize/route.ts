import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';

const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID!;
const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI!;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');

  if (!clientId || clientId !== OAUTH_CLIENT_ID) {
    return NextResponse.json({ error: 'invalid_client_id' }, { status: 400 });
  }

  if (!redirectUri) {
    return NextResponse.json({ error: 'missing_redirect_uri' }, { status: 400 });
  }

  if (redirectUri !== OAUTH_REDIRECT_URI) {
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 });
  }

  const session = await getAuthSession();

  if (!session?.user?.email) {
    const callbackUrl = request.nextUrl.toString();
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`, request.url));
  }

  // Look up the user by email to get their ID
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const code = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await prisma.oAuthCode.create({
    data: {
      code,
      client_id: OAUTH_CLIENT_ID,
      user_id: user.id,
      expires_at: expiresAt,
    },
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  return NextResponse.redirect(redirectUrl.toString());
}
