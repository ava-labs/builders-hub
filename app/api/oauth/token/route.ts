import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { SignJWT, exportJWK, calculateJwkThumbprint, importPKCS8 } from 'jose';
import { prisma } from '@/prisma/prisma';

const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID!;
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET!;

export async function POST(request: NextRequest) {
  let body: { client_id?: string; client_secret?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const { client_id, client_secret, code } = body;

  if (!client_id || !client_secret || !code) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (client_id !== OAUTH_CLIENT_ID) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 400 });
  }

  // Timing-safe comparison of client_secret
  const secretBuffer = Buffer.from(OAUTH_CLIENT_SECRET);
  const providedBuffer = Buffer.from(client_secret);
  if (secretBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(secretBuffer, providedBuffer)) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
  }

  // Clean up expired codes opportunistically
  await prisma.oAuthCode.deleteMany({
    where: { expires_at: { lt: new Date() } },
  });

  const result = await prisma.$transaction(async (tx) => {
    const oauthCode = await tx.oAuthCode.findUnique({
      where: { code },
      include: { user: { select: { name: true, email: true, country: true } } },
    });

    if (!oauthCode) return null;
    await tx.oAuthCode.delete({ where: { code } });
    if (oauthCode.expires_at < new Date()) return null;
    if (oauthCode.client_id !== client_id) return null;
    return oauthCode.user;
  });

  if (!result) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }

  if (!process.env.OAUTH_JWT_PRIVATE_KEY) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  // Uses a separate signing key from Glacier for isolation
  const privateKeyPem = Buffer.from(process.env.OAUTH_JWT_PRIVATE_KEY, 'base64').toString('utf8');
  const privateKey = await importPKCS8(privateKeyPem, 'ES256');
  const publicJWK = await exportJWK(privateKey);
  const kid = await calculateJwkThumbprint(publicJWK);

  const accessToken = await new SignJWT({
    name: result.name,
    email: result.email,
    country: result.country,
  })
    .setProtectedHeader({ alg: 'ES256', kid })
    .setIssuer('builders-hub')
    .setAudience(client_id)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
  });
}
