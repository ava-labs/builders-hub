import { lookup } from 'node:dns/promises';
import { isValidAddress } from '@/lib/console/upgrade-json';
import { getClientIP } from '@/lib/net/clientIp';
import { isBlockedHost, validatePublicRpcUrl } from '@/lib/net/public-host';

export { validatePublicRpcUrl };

type JsonRpcResponse<T> = {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { code?: number; message?: string };
};

// Text checks on the hostname aren't enough: a public name (e.g. lvh.me,
// localtest.me) can resolve to 127.0.0.1 or 169.254.169.254: a DNS-based SSRF
// bypass. Resolve the host and reject if ANY answer is a blocked address.
// (Residual: fetch re-resolves DNS, so a rebinding attacker returning a
// different answer per query isn't fully closed: pinning the socket to this
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
// endpoints. Delegates to the shared resolver, which only trusts headers the
// edge overwrites: the leftmost x-forwarded-for entry read here previously is
// client-supplied, so any caller could rotate their own bucket per request.
export function getClientIp(request: Request): string {
  return getClientIP(request);
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
