/**
 * Single source of truth for "which client is this" in rate limiting.
 *
 * Lived in lib/chat/rateLimit.ts, but four other limiters had each grown their
 * own version reading whatever header looked plausible, with different
 * spoofability. One implementation means one place to reason about trust.
 */

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6 = /^[0-9a-f:]{2,45}$/i;

/**
 * Rejects anything that is not a plausible IP literal.
 *
 * The value becomes a rate-limit map key, so an unvalidated header also lets a
 * caller choose arbitrarily long keys and grow that map.
 */
function normalizeIp(value: string | null): string | null {
  if (!value) return null;
  const candidate = value.trim();
  if (candidate.length === 0 || candidate.length > 45) return null;

  const v4 = IPV4.exec(candidate);
  if (v4) {
    return v4.slice(1).every((o) => Number(o) <= 255 && String(Number(o)) === o)
      ? candidate
      : null;
  }
  return IPV6.test(candidate) ? candidate.toLowerCase() : null;
}

/**
 * Best-effort client IP for rate limiting.
 *
 * Only headers a trusted edge *overwrites* are consulted:
 *
 *  - `cf-connecting-ip` — Cloudflare replaces any client-supplied value at the
 *    edge, so for traffic that genuinely transits Cloudflare this is the real
 *    peer. It is checked first for exactly that reason.
 *  - `x-vercel-forwarded-for` — likewise set by Vercel's proxy.
 *
 * `x-forwarded-for` and `x-real-ip` are deliberately NOT consulted. Cloudflare
 * *appends* to XFF rather than replacing it, so its first element is whatever
 * the client sent; reading it hands the caller a free choice of bucket. When
 * neither trusted header is present the request did not come through the edge,
 * and everyone in that position shares one bucket rather than getting a
 * self-selected one.
 *
 * None of this is a substitute for locking the origin to the edge: any request
 * that reaches the app directly can set `cf-connecting-ip` itself. Keep the
 * Vercel deployment reachable only via Cloudflare (deployment protection, or
 * authenticated origin pulls) — this function cannot enforce that.
 */
export function getClientIP(request: Request): string {
  const headers = request.headers;

  return (
    normalizeIp(headers.get('cf-connecting-ip')) ??
    normalizeIp(headers.get('x-vercel-forwarded-for')) ??
    'unknown'
  );
}

/**
 * The rate-limit bucket of an IP from getClientIP. An IPv4 address is its own
 * bucket. An IPv6 host usually holds a whole /64 and can send each request
 * from a new address in it, so IPv6 buckets by the /64 prefix.
 */
export function rateBucket(ip: string): string {
  if (!ip.includes(':')) return ip;
  const [head, tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '') || '0').join(':')}::/64`;
}
