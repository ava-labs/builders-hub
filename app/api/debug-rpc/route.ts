import { NextRequest, NextResponse } from 'next/server';

const FUJI_DEBUG_RPC_URL = process.env.FUJI_DEBUG_RPC_URL;

/**
 * Whitelisted JSON-RPC methods that are safe to proxy.
 * Only debug/trace methods — no state-changing operations.
 */
const ALLOWED_METHODS = new Set([
  'debug_traceTransaction',
  'debug_traceCall',
  'debug_traceBlockByNumber',
  'debug_traceBlockByHash',
  'eth_getTransactionReceipt',
  'eth_call',
]);

/** Simple in-memory rate limiter: max 20 requests per IP per minute */
const rateLimits = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimits.delete(key);
    }
  }
}, 300_000);

export async function POST(request: NextRequest) {
  if (!FUJI_DEBUG_RPC_URL) {
    return NextResponse.json(
      { error: 'Debug RPC not configured' },
      { status: 503 },
    );
  }

  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in a minute.' },
      { status: 429 },
    );
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

  // Only allow whitelisted methods
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
      return NextResponse.json(
        { error: `Debug RPC returned ${rpcResponse.status}` },
        { status: 502 },
      );
    }

    const result = await rpcResponse.json();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Debug RPC proxy error:', err);
    return NextResponse.json(
      { error: 'Failed to reach debug RPC node' },
      { status: 502 },
    );
  }
}
