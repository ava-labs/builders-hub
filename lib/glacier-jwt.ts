import { SignJWT, exportJWK, calculateJwkThumbprint } from 'jose';

export interface GlacierJWTPayload {
    sub: string;
    email: string;
    iss: string;
    [key: string]: unknown;
}

/*
To generate the private key:
openssl ecparam -genkey -name prime256v1 -noout | openssl pkcs8 -topk8 -nocrypt | base64 -w0
*/

export async function createGlacierJWT(payload: GlacierJWTPayload): Promise<string> {
    if (!process.env.GLACIER_JWT_PRIVATE_KEY) {
        throw new Error('GLACIER_JWT_PRIVATE_KEY is not set. See file lib/glacier-jwt.ts for instructions');
    }

    // Decode the base64 private key
    const privateKeyPem = Buffer.from(process.env.GLACIER_JWT_PRIVATE_KEY, 'base64').toString('utf8');

    // Import the private key
    // Generate with: openssl ecparam -genkey -name prime256v1 -noout | openssl pkcs8 -topk8 -nocrypt | base64 -w0
    const { importPKCS8 } = await import('jose');
    const privateKey = await importPKCS8(privateKeyPem, 'ES256');

    // Generate kid from key thumbprint
    const publicJWK = await exportJWK(privateKey);
    const kid = await calculateJwkThumbprint(publicJWK);

    // Create and sign the JWT
    const jwt = await new SignJWT(payload)
        .setProtectedHeader({
            alg: 'ES256',
            kid
        })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);

    return jwt;
}
