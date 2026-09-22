/**
 * Server-side validation for user-supplied RPC URL parameters.
 *
 * Prevents SSRF attacks where an attacker passes a private/loopback address
 * (e.g. http://169.254.169.254/latest/meta-data/) as the rpcUrl query parameter,
 * causing the Next.js server to forward requests and return the response.
 *
 * Rules enforced:
 *   - Must use the https: scheme
 *   - Hostname must not resolve to a private, loopback, or link-local IP range
 */

const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^127\./,               // IPv4 loopback (127.0.0.0/8)
  /^10\./,                // RFC-1918 class A (10.0.0.0/8)
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC-1918 class B (172.16.0.0/12)
  /^192\.168\./,          // RFC-1918 class C (192.168.0.0/16)
  /^169\.254\./,          // Link-local / AWS EC2 metadata (169.254.0.0/16)
  /^0\./,                 // Reserved (0.0.0.0/8)
  /^100\.6[4-9]\./,       // Shared address space (100.64.0.0/10)
  /^100\.[7-9]\d\./,
  /^100\.1[01]\d\./,
  /^100\.12[0-7]\./,
  /^::1$/,                // IPv6 loopback
  /^fc[0-9a-f]{2}:/i,     // IPv6 unique local (fc00::/7)
  /^fe[89ab][0-9a-f]:/i,  // IPv6 link-local (fe80::/10)
  /^localhost$/i,         // Hostname "localhost"
  /\.local$/i,            // mDNS hostnames (*.local)
];

/**
 * Returns true if the URL is safe to proxy to, based on the URL text alone.
 *
 * This catches a literal private address in the hostname. It cannot catch a
 * *name* that resolves to one — `evil.example` with an A record pointing at
 * 169.254.169.254 passes here — so it is the cheap first gate, not the whole
 * check. Callers that fetch the URL should follow up with
 * `assertPublicRpcTarget`, which resolves the name before trusting it.
 */
export function isValidRpcUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    return !PRIVATE_IP_PATTERNS.some(re => re.test(stripBrackets(hostname)));
  } catch {
    return false;
  }
}

/** `new URL()` keeps IPv6 hosts in brackets; the patterns match bare addresses. */
function stripBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

/**
 * Returns true if every address the hostname resolves to is public.
 *
 * Resolving closes the gap `isValidRpcUrl` leaves open: an attacker-controlled
 * domain whose record points into the private range or at the cloud metadata
 * endpoint. A name with several records is only accepted when *all* of them are
 * public, so a mixed record set cannot smuggle one internal address through.
 *
 * This narrows but does not eliminate DNS rebinding: the name is resolved here
 * and again by `fetch`, and a sufficiently short TTL can differ between the
 * two. Eliminating that needs the connection pinned to the address that was
 * checked, which the platform `fetch` does not expose.
 */
export async function isPublicRpcHost(hostname: string): Promise<boolean> {
  const host = stripBrackets(hostname);

  // A literal address needs no lookup — and must not get one, since resolving
  // it would be a no-op that masks a bad literal.
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    return !PRIVATE_IP_PATTERNS.some(re => re.test(host));
  }

  try {
    const { lookup } = await import('dns/promises');
    const records = await lookup(host, { all: true });
    if (records.length === 0) return false;
    return records.every(
      ({ address }) => !PRIVATE_IP_PATTERNS.some(re => re.test(address)),
    );
  } catch {
    // A name that will not resolve is not a name worth fetching.
    return false;
  }
}

/**
 * Full check for a caller-supplied RPC URL: scheme and literal form first
 * (cheap, no network), then resolution.
 */
export async function assertPublicRpcTarget(rawUrl: string): Promise<boolean> {
  if (!isValidRpcUrl(rawUrl)) return false;
  try {
    return await isPublicRpcHost(new URL(rawUrl).hostname);
  } catch {
    return false;
  }
}
