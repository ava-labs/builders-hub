import crypto from 'crypto';
import { z } from 'zod';
import { SignJWT, exportJWK, calculateJwkThumbprint, importPKCS8 } from 'jose';
import { prisma } from '@/prisma/prisma';
import { withApi, successResponse, BadRequestError, AuthError, InternalError } from '@/lib/api';

const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID!;
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET!;

const TokenSchema = z.object({
  client_id: z.string().min(1, 'client_id is required'),
  client_secret: z.string().min(1, 'client_secret is required'),
  code: z.string().min(1, 'code is required'),
});

/**
 * HMAC-based timing-safe comparison.
 * Uses a random key so that neither the expected nor provided value can be
 * inferred from the HMAC output, and the comparison never leaks length.
 */
function timingSafeCompare(a: string, b: string): boolean {
  const key = crypto.randomBytes(32);
  const hmacA = crypto.createHmac('sha256', key).update(a).digest();
  const hmacB = crypto.createHmac('sha256', key).update(b).digest();
  return crypto.timingSafeEqual(hmacA, hmacB);
}

// withApi: auth intentionally omitted — pre-authentication endpoint
export const POST = withApi<z.infer<typeof TokenSchema>>(
  async (_req, { body }) => {
    const { client_id, client_secret, code } = body;

    if (!timingSafeCompare(client_id, OAUTH_CLIENT_ID)) {
      throw new AuthError('invalid_client');
    }

    if (!timingSafeCompare(client_secret, OAUTH_CLIENT_SECRET)) {
      throw new AuthError('invalid_client');
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
      throw new BadRequestError('invalid_grant');
    }

    if (!process.env.OAUTH_JWT_PRIVATE_KEY) {
      throw new InternalError('OAuth signing key not configured');
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

    return successResponse({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
    });
  },
  { schema: TokenSchema },
);
