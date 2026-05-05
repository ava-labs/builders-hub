import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { AuthOptions } from '@/lib/auth/authOptions';

const FUJI_DEBUG_RPC_URL = process.env.FUJI_DEBUG_RPC_URL;

/**
 * Whitelisted JSON-RPC debug/trace methods. Only the narrow set of methods
 * the in-app diagnostics (revert-tracing) calls. `eth_call` and
 * `eth_getTransactionReceipt` used to be on this list but no consumer uses
 * them through this proxy, and leaving them in effectively turned this
 * endpoint into a free generic RPC relay.
 */
const ALLOWED_METHODS = new Set(['debug_traceCall', 'debug_traceTransaction']);

/** Simple in-memory rate limiter: max 20 requests per identity per minute */
const rateLimits = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const CLEANUP_THRESHOLD = 500;

function checkRateLimit(identity: string): boolean {
  const now = Date.now();

  // Piggyback cleanup onto request servicing instead of running a
  // module-scope setInterval: the timer is useless in serverless (each
  // cold instance loses its state anyway) and leaks references in
  // long-lived Node processes.
  if (rateLimits.size > CLEANUP_THRESHOLD) {
    for (const [key, entry] of rateLimits.entries()) {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
        rateLimits.delete(key);
      }
    }
  }

  const entry = rateLimits.get(identity);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(identity, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  if (!FUJI_DEBUG_RPC_URL) {
    return NextResponse.json({ error: 'Debug RPC not configured' }, { status: 503 });
  }

  // Require an authenticated session. The underlying node is paid and
  // debug-enabled; without auth this endpoint can be scraped as a free
  // generic RPC proxy by anyone who finds the URL.
  const session = await getServerSession(AuthOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prefer the signed-in identity over a spoofable x-forwarded-for header
  // for rate limiting. IP stays as a secondary bucket for shared accounts.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const identity = `${email}|${ip}`;
  if (!checkRateLimit(identity)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429 });
  }

  let body: { method?: string; params?: unknown[]; id?: number | string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { method, params, id } = body;

  if (!method || typeof method !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid "method" field' }, { status: 400 });
  }

  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json(
      { error: `Method "${method}" is not allowed. Allowed: ${[...ALLOWED_METHODS].join(', ')}` },
      { status: 403 },
    );
  }

  try {
    const rpcResponse = await fetch(FUJI_DEBUG_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params: params ?? [],
        id: id ?? 1,
      }),
    });

    if (!rpcResponse.ok) {
      return NextResponse.json({ error: `Debug RPC returned ${rpcResponse.status}` }, { status: 502 });
    }

    const result = await rpcResponse.json();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Debug RPC proxy error:', err);
    return NextResponse.json({ error: 'Failed to reach debug RPC node' }, { status: 502 });
  }
}
