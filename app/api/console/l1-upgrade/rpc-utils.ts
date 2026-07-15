import { lookup } from 'node:dns/promises';
import { isValidAddress } from '@/lib/console/upgrade-json';

type JsonRpcResponse<T> = {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { code?: number; message?: string };
};

// Hosts we refuse to fetch: loopback, private, link-local (incl. cloud
// metadata 169.254.169.254), CGNAT, and IPv6 equivalents. Applied to the URL
// hostname text AND to every DNS-resolved IP (see assertHostResolvesPublic).
// Strip IPv6 brackets so literal hosts (`[::1]`) compare cleanly; a host
// containing ':' is an IPv6 literal (domains can't), so the IPv6 range checks
// never false-positive on real domains.
function isBlockedHost(rawHost: string): boolean {
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
      (host === '::1' || // IPv6 loopback
        host === '::' ||
        host.startsWith('fe80:') || // link-local
        host.startsWith('fc') || // ULA fc00::/7
        host.startsWith('fd') ||
        host.includes('::ffff:') || // IPv4-mapped (e.g. ::ffff:169.254.169.254)
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

// Text checks on the hostname aren't enough: a public name (e.g. lvh.me,
// localtest.me) can resolve to 127.0.0.1 or 169.254.169.254 — a DNS-based SSRF
// bypass. Resolve the host and reject if ANY answer is a blocked address.
// (Residual: fetch re-resolves DNS, so a rebinding attacker returning a
// different answer per query isn't fully closed — pinning the socket to this
// resolved IP would be needed for that; acceptable given the constrained
// JSON-RPC-POST surface and low blast radius on the Vercel runtime.)
async function assertHostResolvesPublic(rawUrl: string): Promise<void> {
  if (process.env.NODE_ENV === 'development') return;
  const host = new URL(rawUrl).hostname.replace(/^\[|\]$/g, '');
  let records: Array<{ address: string }>;
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error('Could not resolve RPC host.');
  }
  for (const { address } of records) {
    if (isBlockedHost(address)) {
      throw new Error('RPC host resolves to a private or local address and cannot be fetched by Builder Hub.');
    }
  }
}

// Best-effort client IP for rate limiting the unauthenticated rpc/code
// endpoints. On Vercel x-forwarded-for is set by the platform.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function callJsonRpc<T>(rpcUrl: string, method: string, params: unknown[] = []): Promise<T> {
  await assertHostResolvesPublic(rpcUrl);
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(12_000),
    // Don't follow redirects: a public host could 3xx to an internal address
    // that validatePublicRpcUrl never saw (SSRF). A redirect surfaces as a
    // non-ok 3xx and is rejected below.
    redirect: 'manual',
  });

  if (!response.ok) {
    throw new Error(`RPC returned HTTP ${response.status}`);
  }

  const json = (await response.json()) as JsonRpcResponse<T>;
  if (json.error) {
    throw new Error(json.error.message || `RPC error ${json.error.code ?? ''}`.trim());
  }
  return json.result as T;
}

export function validateRpcAddress(address: string): string | null {
  return isValidAddress(address) ? null : 'Address must be a 0x-prefixed EVM address.';
}
