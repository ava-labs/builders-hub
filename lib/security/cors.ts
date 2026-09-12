/**
 * Origin allowlisting for the site's Next.js proxy (middleware).
 *
 * Replaces a blanket `Access-Control-Allow-Origin: *` that the proxy used to
 * stage on its response. We reflect the request `Origin` only when it is
 * trusted, and never grant credentials — so a reflected origin can read only
 * public, unauthenticated responses. The MCP endpoint keeps its own,
 * Claude-specific allowlist in `lib/mcp/cors.ts`; this helper governs the proxy.
 *
 * See issue #3973.
 */

// ---------------------------------------------------------------------------
// Allowed origins
// ---------------------------------------------------------------------------

/**
 * Exact-match origins. `CORS_ALLOWED_ORIGINS` (comma-separated) fully overrides
 * this list for self-hosted deployments — set it to include every origin you
 * need, as it replaces rather than extends the default.
 */
export const STATIC_ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  process.env.CORS_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? ['https://build.avax.network']
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * True when `origin` is trusted to make cross-origin browser requests.
 *
 * Beyond the static (production) allowlist, we additionally trust:
 *  - localhost / 127.0.0.1 outside production, for local development; and
 *  - sibling `*.vercel.app` deployments, but only when this deployment is
 *    itself a Vercel preview (`VERCEL_ENV === 'preview'`) — never in
 *    production. Preview builds carry no production data and, since we never
 *    grant credentials, a reflected preview origin can read only public data.
 */
export function isAllowedOrigin(origin: string): boolean {
  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  const { protocol, hostname } = url;
  if (protocol !== 'http:' && protocol !== 'https:') return false;

  if (process.env.NODE_ENV !== 'production' && isLoopbackHost(hostname)) {
    return true;
  }

  if (
    process.env.VERCEL_ENV === 'preview' &&
    protocol === 'https:' &&
    hostname.endsWith('.vercel.app')
  ) {
    return true;
  }

  return false;
}

/**
 * CORS headers for a request's `Origin`.
 *
 * Grants cross-origin access (by reflecting the origin) only when it is
 * allowlisted, paired with `Vary: Origin` so shared caches key the response
 * per-origin and never serve one origin's grant to another. For a missing
 * `Origin` (same-origin / non-browser client) or a disallowed one, returns an
 * empty object: no `Access-Control-Allow-Origin` is emitted, the browser blocks
 * the cross-origin read (the secure default), and the response stays
 * byte-identical to the pre-existing behavior. Mirrors `lib/mcp/cors.ts`.
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !isAllowedOrigin(origin)) return {};

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}
