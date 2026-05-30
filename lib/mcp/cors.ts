/**
 * CORS validation and header generation for the MCP server.
 */

// ---------------------------------------------------------------------------
// Allowed origins
// ---------------------------------------------------------------------------

export const ALLOWED_ORIGINS: string[] = process.env.MCP_ALLOWED_ORIGINS?.split(',') || [
  'https://claude.ai',
  'https://www.claude.ai',
  'https://build.avax.network',
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the request's origin is allowed (or if there is no origin,
 * which means it's a non-browser / CLI client).
 */
export function validateOrigin(origin: string | null): boolean {
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Build CORS response headers for an allowed origin.
 * Returns an empty object for non-browser clients (no Origin header).
 */
export function getCORSHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};

  if (ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Vary': 'Origin',
    };
  }

  return {};
}
