import { NextResponse, type NextRequest } from 'next/server';
import { getClientId } from '@/lib/mcp-rate-limit';
import { checkRateLimit } from '@/lib/rateLimit';

/* The same-origin relay for the Avalanche public API. iOS WebKit can refuse the CORS preflight that every JSON-RPC
   POST to api.avax(-test).network needs, so the console's fetch wrapper retries a refused call here. The upstream is
   one of the two fixed public hosts, never a URL from the request; only the chain and info endpoints the console
   wallet uses are forwarded, and each only with its own method namespace (no admin, no keystore). */

export const runtime = 'nodejs';

const HOSTS: Record<string, string> = {
  fuji: 'https://api.avax-test.network',
  mainnet: 'https://api.avax.network',
};

const ENDPOINTS: Record<string, string> = {
  'ext/bc/P': 'platform.',
  'ext/bc/X': 'avm.',
  'ext/bc/C/avax': 'avax.',
  'ext/info': 'info.',
  'ext/index/P/block': 'index.',
  'ext/index/X/tx': 'index.',
  'ext/index/X/block': 'index.',
  'ext/index/C/block': 'index.',
};

const MAX_BODY = 512 * 1024;
const TIMEOUT_MS = 15_000;
const LIMIT = { windowMs: 60_000, maxRequests: 300 };

const fail = (status: number, message: string) =>
  NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message } }, { status });

export async function POST(request: NextRequest, { params }: { params: Promise<{ network: string; path: string[] }> }) {
  const { network, path } = await params;
  const host = HOSTS[network];
  const endpoint = path.join('/');
  const namespace = ENDPOINTS[endpoint];
  if (!host || !namespace) return fail(404, 'Unknown endpoint');

  if (!checkRateLimit(`avalanche-api:${getClientId(request)}`, LIMIT).allowed) return fail(429, 'Too many requests');

  const body = await request.text();
  if (body.length > MAX_BODY) return fail(413, 'Request too large');
  let calls: unknown;
  try {
    calls = JSON.parse(body);
  } catch {
    return fail(400, 'Body must be JSON-RPC');
  }
  const methods = (Array.isArray(calls) ? calls : [calls]).map((c) => (c as { method?: unknown })?.method);
  if (
    methods.length === 0 ||
    methods.length > 20 ||
    !methods.every((m) => typeof m === 'string' && m.startsWith(namespace))
  )
    return fail(400, `Only ${namespace}* methods are forwarded to /${endpoint}`);

  try {
    const upstream = await fetch(`${host}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch (error) {
    console.error('[avalanche-api relay]', endpoint, error);
    return fail(502, 'Upstream unavailable');
  }
}
