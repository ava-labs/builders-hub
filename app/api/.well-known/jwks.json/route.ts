import { NextResponse } from 'next/server';
import { importPKCS8, exportJWK, calculateJwkThumbprint } from 'jose';

// --- Module-Scoped Initialization for Performance ---

// State variables to hold the pre-calculated JWKS and initialization error.
let cachedJwks = null;
let initializationError = null;

/**
 * Executes the key generation and JWKS structure creation once when the module is loaded.
 * This prevents cryptographic operations from running on every incoming HTTP request.
 */
async function initializeJwks() {
    try {
        if (!process.env.GLACIER_JWT_PRIVATE_KEY) {
            throw new Error('GLACIER_JWT_PRIVATE_KEY environment variable is not set');
        }

        // 1. Decode the base64 PKCS#8 private key string.
        const privateKeyPem = Buffer.from(process.env.GLACIER_JWT_PRIVATE_KEY, 'base64').toString('utf8');

        // 2. Import the private key (ES256 is expected based on the generation comment).
        // The key is typically generated via: openssl ecparam -genkey -name prime256v1 -noout | openssl pkcs8 -topk8 -nocrypt | base64 -w0
        const privateKey = await importPKCS8(privateKeyPem, 'ES256');

        // 3. Extract the public key component and convert it to the full JWK format.
        const publicJWK = await exportJWK(privateKey);
        
        // 4. Calculate the Key ID (KID) based on the public key's thumbprint.
        const kid = await calculateJwkThumbprint(publicJWK);

        // 5. Remove the private key component ("d") before exposing the key. 
        // This step is CRITICAL for security.
        const { d, ...publicKeyOnly } = publicJWK;

        // 6. Build the final JWKS response object.
        cachedJwks = {
            keys: [
                {
                    ...publicKeyOnly,
                    kty: 'EC', // Elliptic Curve
                    use: 'sig', // Used for signing
                    alg: 'ES256', // Algorithm
                    kid // Key ID (thumbprint)
                }
            ]
        };
    } catch (error) {
        console.error('FATAL: Error during JWKS initialization:', error);
        initializationError = error;
    }
}

// Immediately run the initialization function on module load.
initializeJwks();

/**
 * @function GET
 * Handles GET requests to the /jwks endpoint, returning the JSON Web Key Set.
 * @returns {NextResponse} The JWKS response or an error response.
 */
export async function GET() {
    // Check for initialization errors first (server failed to load the key).
    if (initializationError) {
        return NextResponse.json(
            { error: 'Server initialization failed' },
            { status: 500 }
        );
    }
    
    // Check if initialization is still pending (should be rare in serverless environments).
    if (!cachedJwks) {
        // Fallback for extremely slow environments, forcing a wait, though sync initialization is preferred.
        // In a typical Next.js environment, this path should not be hit.
        console.warn("JWKS cache not ready. Waiting for initialization.");
        await initializeJwks();
        if (initializationError || !cachedJwks) {
            return NextResponse.json(
                { error: 'Failed to generate JWKS after retry' },
                { status: 500 }
            );
        }
    }

    // Return the pre-calculated JWKS object with caching headers.
    return NextResponse.json(cachedJwks, {
        headers: {
            // Cache for 1 hour publicly to minimize API calls and latency.
            'Cache-Control': 'public, max-age=3600, s-maxage=3600', 
            'Content-Type': 'application/json'
        }
    });
}
