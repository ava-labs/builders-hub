import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/prisma/prisma';

const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET!;

export async function POST(request: NextRequest) {
  let body: { client_secret?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const { client_secret, code } = body;

  if (!client_secret || !code) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Timing-safe comparison of client_secret
  const secretBuffer = Buffer.from(OAUTH_CLIENT_SECRET);
  const providedBuffer = Buffer.from(client_secret);
  if (secretBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(secretBuffer, providedBuffer)) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const oauthCode = await tx.oAuthCode.findUnique({
      where: { code },
      include: { user: { select: { name: true, email: true, country: true } } },
    });

    if (!oauthCode) return null;
    await tx.oAuthCode.delete({ where: { code } });
    if (oauthCode.expires_at < new Date()) return null;
    return oauthCode.user;
  });

  if (!result) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }

  return NextResponse.json({ user: { name: result.name, email: result.email, country: result.country } });
}
