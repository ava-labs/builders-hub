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
 * Returns true if the URL is safe to proxy to.
 * False means the request must be rejected with a 400.
 */
export function isValidRpcUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    return !PRIVATE_IP_PATTERNS.some(re => re.test(hostname));
  } catch {
    return false;
  }
}
