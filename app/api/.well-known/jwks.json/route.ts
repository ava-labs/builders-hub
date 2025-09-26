import { NextResponse } from 'next/server';
import { importPKCS8, exportJWK, calculateJwkThumbprint } from 'jose';


export async function GET() {
    try {
        if (!process.env.GLACIER_JWT_PRIVATE_KEY) {
            throw new Error('GLACIER_JWT_PRIVATE_KEY is not set');
        }

        // Decode the base64 private key
        const privateKeyPem = Buffer.from(process.env.GLACIER_JWT_PRIVATE_KEY, 'base64').toString('utf8');

        // Import the private key
        // Generate with: openssl ecparam -genkey -name prime256v1 -noout | openssl pkcs8 -topk8 -nocrypt | base64 -w0
        const privateKey = await importPKCS8(privateKeyPem, 'ES256');

        // Extract public key and convert to JWK
        const publicJWK = await exportJWK(privateKey);
        const kid = await calculateJwkThumbprint(publicJWK);

        // Remove private key component ("d") - CRITICAL for security
        const { d, ...publicKeyOnly } = publicJWK;

        // Build JWKS response
        const jwks = {
            keys: [
                {
                    ...publicKeyOnly,
                    kty: 'EC',
                    use: 'sig',
                    alg: 'ES256',
                    kid
                }
            ]
        };

        return NextResponse.json(jwks, {
            headers: {
                'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error generating JWKS:', error);
        return NextResponse.json(
            { error: 'Failed to generate JWKS' },
            { status: 500 }
        );
    }
}
