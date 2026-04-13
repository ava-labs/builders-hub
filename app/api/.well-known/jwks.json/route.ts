import { NextResponse } from 'next/server';
import { importPKCS8, exportJWK, calculateJwkThumbprint } from 'jose';
import { InternalError, errorResponse } from '@/lib/api';

async function loadKey(base64Key: string) {
  const pem = Buffer.from(base64Key, 'base64').toString('utf8');
  const privateKey = await importPKCS8(pem, 'ES256');
  const publicJWK = await exportJWK(privateKey);
  const kid = await calculateJwkThumbprint(publicJWK);
  const { d: _d, ...publicKeyOnly } = publicJWK;
  return { ...publicKeyOnly, kty: 'EC' as const, use: 'sig' as const, alg: 'ES256' as const, kid };
}

// withApi: not applicable — custom Cache-Control headers required
// Generate keys with: openssl ecparam -genkey -name prime256v1 -noout | openssl pkcs8 -topk8 -nocrypt | base64 -w0
export async function GET() {
  try {
    const keys = [];

    if (process.env.GLACIER_JWT_PRIVATE_KEY) {
      keys.push(await loadKey(process.env.GLACIER_JWT_PRIVATE_KEY));
    }

    if (process.env.OAUTH_JWT_PRIVATE_KEY) {
      keys.push(await loadKey(process.env.OAUTH_JWT_PRIVATE_KEY));
    }

    if (keys.length === 0) {
      throw new InternalError('No JWT signing keys configured');
    }

    return NextResponse.json(
      { keys },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
