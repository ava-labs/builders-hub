/* Which hosts the server may fetch when a caller, or a row a user can edit, names the URL. This module has no
   Node import, so an edge route can use it. The DNS check of a host name is in
   app/api/console/l1-upgrade/rpc-utils.ts (it needs Node). */

// Hosts we refuse to fetch: loopback, private, link-local (incl. cloud
// metadata 169.254.169.254), CGNAT, and IPv6 equivalents. Applied to the URL
// hostname text AND to every DNS-resolved IP (see assertHostResolvesPublic).
// Strip IPv6 brackets so literal hosts (`[::1]`) compare cleanly; a host
// containing ':' is an IPv6 literal (domains can't), so the IPv6 range checks
// never false-positive on real domains.
export function isBlockedHost(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/^\[|\]$/g, '');
  const isIpv6 = host.includes(':');
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') || // e.g. metadata.google.internal
    host === '0.0.0.0' ||
    host.startsWith('0.') ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.') || // link-local incl. cloud metadata (169.254.169.254)
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) || // CGNAT 100.64.0.0/10
    (isIpv6 &&
      (host.startsWith('::') || // loopback ::1, unspecified ::, IPv4-compatible ::a.b.c.d, IPv4-mapped ::ffff:a.b.c.d
        /^fe[89ab]/.test(host) || // link-local fe80::/10
        host.startsWith('fc') || // ULA fc00::/7
        host.startsWith('fd') ||
        host.startsWith('64:ff9b:') || // NAT64: an IPv4 address behind an IPv6 prefix
        host.includes('::ffff:') ||
        host.includes('169.254') ||
        host.includes('127.0.0.1')))
  );
}

export function validatePublicRpcUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return 'RPC URL must be a valid URL.';
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'RPC URL must use http or https.';
  }

  if (process.env.NODE_ENV !== 'development' && isBlockedHost(url.hostname)) {
    return 'Private or local RPC URLs cannot be fetched by Builder Hub. Use a public RPC URL or continue with manual instructions.';
  }

  return null;
}
