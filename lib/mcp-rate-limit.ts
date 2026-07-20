/**
 * Rate limiting for MCP server endpoints using Redis
 *
 * Implements distributed rate limiting that works across serverless instances.
 * Clients are identified by origin + trusted proxy IP (browsers) or hashed IP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'redis';
import { createHash } from 'crypto';

// Singleton Redis client for connection reuse
let redisClient: ReturnType<typeof createClient> | null = null;
let redisPromise: Promise<ReturnType<typeof createClient>> | null = null;

/**
 * Get or create Redis client connection
 */
async function getRedisClient() {
  if (redisClient?.isOpen) {
    return redisClient;
  }

  // Prevent multiple simultaneous connection attempts
  if (redisPromise) {
    return redisPromise;
  }

  redisPromise = (async () => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable not set');
    }

    const client = createClient({ url: redisUrl });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      redisClient = null;
      redisPromise = null;
    });

    await client.connect();
    redisClient = client;
    return client;
  })().catch((error) => {
    redisClient = null;
    redisPromise = null;
    throw error;
  });

  return redisPromise;
}

const WINDOW_MS = 60 * 1000; // 1 minute
// Per-client anti-abuse guard (origin/hashed-IP). Backend protection is the query
// gateway's job (it rate-limits and admission-controls each data source), so this
// is sized only to stop a single client from hammering the MCP.
const MAX_REQUESTS = 120; // per client per minute
const MAX_LOCAL_CLIENTS = 10_000;
const localLimits = new Map<string, { used: number; resetAt: number }>();

function consumeLocal(key: string, cost: number, now: number): { used: number; resetAt: number } {
  let entry = localLimits.get(key);
  if (!entry || entry.resetAt <= now) entry = { used: 0, resetAt: now + WINDOW_MS };
  entry.used += cost;
  if (!localLimits.has(key) && localLimits.size >= MAX_LOCAL_CLIENTS) {
    const oldest = localLimits.keys().next().value;
    if (oldest) localLimits.delete(oldest);
  }
  localLimits.set(key, entry);
  return entry;
}

function localStatus(key: string, now: number): { used: number; resetAt: number } {
  const entry = localLimits.get(key);
  if (!entry || entry.resetAt <= now) return { used: 0, resetAt: now + WINDOW_MS };
  return entry;
}

function limitedResponse(resetTime: number, now: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetTime - now) / 1000));
  return NextResponse.json(
    {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32000,
        message: `Rate limit exceeded. Maximum ${MAX_REQUESTS} cost units per minute allowed.`
      }
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'RateLimit-Limit': MAX_REQUESTS.toString(),
        'RateLimit-Remaining': '0',
        'RateLimit-Reset': new Date(resetTime).toISOString(),
      }
    }
  );
}

/**
 * Hash an IP address for privacy-preserving rate limiting
 */
function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/**
 * Get client identifier from request
 * - Browsers: origin plus hashed trusted-proxy IP
 * - Non-browser: hashed IP address (privacy-preserving)
 */
export function getClientId(request: NextRequest): string {
  const origin = request.headers.get('origin');
  const vercelIp = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  // Use the proxy-nearest (rightmost) entry as the generic fallback so a caller-
  // supplied leftmost X-Forwarded-For value cannot cheaply rotate the bucket.
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').map((part) => part.trim()).filter(Boolean);
  const ip = vercelIp || realIp || forwarded?.[forwarded.length - 1] || 'unknown';
  const ipId = hashIp(ip);
  return origin ? `origin:${origin}:ip:${ipId}` : `ip:${ipId}`;
}

/** Charge batches by item and data-producing tool calls by their higher cost. */
export function getMCPRequestCost(body: unknown): number {
  const messages = Array.isArray(body) ? body : [body];
  return Math.max(
    1,
    messages.reduce((total, message) => {
      if (!message || typeof message !== 'object') return total + 1;
      const record = message as { method?: unknown; params?: { name?: unknown } };
      if (record.method !== 'tools/call') return total + 1;
      const name = record.params?.name;
      return total + (name === 'onchain_activity' || name === 'chain_stats' || name === 'onchain_query' ? 4 : 2);
    }, 0)
  );
}

const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCRBY', KEYS[1], ARGV[1])
if count == tonumber(ARGV[1]) then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return {count, redis.call('PTTL', KEYS[1])}
`;

/**
 * Check rate limit using Redis
 * Returns null if allowed, or NextResponse with 429 if rate limit exceeded
 */
export async function checkMCPRateLimit(request: NextRequest, cost = 1): Promise<NextResponse | null> {
  const clientId = getClientId(request);
  const now = Date.now();
  // Versioned because v1 stored a JSON timestamp array; mixing that value with
  // INCRBY during a rolling deploy would make both limiter versions fail open.
  const key = `mcp-ratelimit:v2:${clientId}`;

  try {
    const redis = await getRedisClient();

    const result = await redis.eval(RATE_LIMIT_SCRIPT, {
      keys: [key],
      arguments: [String(Math.max(1, Math.floor(cost))), String(WINDOW_MS)],
    }) as [number, number];
    const used = Number(result[0]);
    const ttlMs = Math.max(0, Number(result[1]));

    if (used > MAX_REQUESTS) {
      const resetTime = now + ttlMs;
      return limitedResponse(resetTime, now);
    }

    return null;
  } catch (error) {
    // Redis failure falls back to a per-instance limiter: less globally precise,
    // but never completely unprotected and never takes the MCP offline.
    console.error('Rate limit check failed:', error);
    const fallback = consumeLocal(key, Math.max(1, Math.floor(cost)), now);
    return fallback.used > MAX_REQUESTS ? limitedResponse(fallback.resetAt, now) : null;
  }
}

/**
 * Get current rate limit status for a client
 * Used to add headers to successful responses
 */
export async function getRateLimitHeaders(request: NextRequest): Promise<Record<string, string>> {
  const clientId = getClientId(request);
  const now = Date.now();
  const key = `mcp-ratelimit:v2:${clientId}`;

  try {
    const redis = await getRedisClient();
    const [data, ttlMsRaw] = await Promise.all([redis.get(key), redis.pTTL(key)]);
    const used = Number(data || 0);
    const ttlMs = ttlMsRaw > 0 ? ttlMsRaw : WINDOW_MS;
    const remaining = Math.max(0, MAX_REQUESTS - used);
    const resetTime = now + ttlMs;

    return {
      'RateLimit-Limit': MAX_REQUESTS.toString(),
      'RateLimit-Remaining': remaining.toString(),
      'RateLimit-Reset': new Date(resetTime).toISOString(),
    };
  } catch (error) {
    console.error('Failed to get rate limit headers:', error);
    const fallback = localStatus(key, now);
    return {
      'RateLimit-Limit': MAX_REQUESTS.toString(),
      'RateLimit-Remaining': Math.max(0, MAX_REQUESTS - fallback.used).toString(),
      'RateLimit-Reset': new Date(fallback.resetAt).toISOString(),
    };
  }
}
