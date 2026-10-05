/**
 * Chat Rate Limiting
 *
 * Implements tiered rate limiting for the chat API:
 * - Anonymous users: Limited by IP address (10 messages per hour)
 * - Authenticated users: High limit per user ID (1000 messages per hour)
 *
 * The counters live in Redis, because a per-instance Map means nothing on
 * serverless: every cold start restores the full allowance and each instance
 * counts on its own, so the effective limit is the limit times the number of
 * instances. When Redis is unreachable we fall back to counting in this
 * instance's memory — weaker, but never unprotected and never offline.
 */

import { redis } from '@/lib/redis';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  limit: number;
}

// Rate limit configuration
const RATE_LIMITS = {
  anonymous: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  authenticated: {
    maxRequests: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
} as const;

// In-memory storage for rate limits
// Key format: "anon:{ip}" or "auth:{userId}"
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupOldEntries(): void {
  const now = Date.now();
  const maxWindowMs = Math.max(
    RATE_LIMITS.anonymous.windowMs,
    RATE_LIMITS.authenticated.windowMs
  );

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > maxWindowMs) {
      rateLimitStore.delete(key);
    }
  }
  lastCleanup = now;
}

export { getClientIP } from '@/lib/net/clientIp';


/** the loopback address in any of the spellings a dev server forwards, port included */
function isLoopback(identifier: string): boolean {
  const host = identifier
    .replace(/^\[([^\]]+)\](:\d+)?$/, '$1')
    .replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, '$1')
    .toLowerCase();
  return host === 'unknown' || host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '::ffff:127.0.0.1';
}

/** INCR the window counter, setting its expiry on the first request only, so
 *  the window stays fixed instead of sliding forward with every call. */
const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('PTTL', KEYS[1])}
`;

/**
 * Check rate limit for a chat request
 *
 * Shared across instances through Redis; falls back to this instance's memory
 * when Redis is unavailable.
 *
 * @param identifier - User ID for authenticated users, IP for anonymous
 * @param isAuthenticated - Whether the user is logged in
 * @returns Rate limit result with allowed status and metadata
 */
export async function checkChatRateLimit(
  identifier: string,
  isAuthenticated: boolean
): Promise<RateLimitResult> {
  const now = Date.now();

  // Local development: every request arrives from the one loopback address
  // (or with no proxy header at all), so a few smoke tests would lock the
  // developer out for an hour. Production is not affected.
  if (process.env.NODE_ENV === 'development' && !isAuthenticated && isLoopback(identifier)) {
    return {
      allowed: true,
      remaining: RATE_LIMITS.anonymous.maxRequests,
      resetTime: new Date(now + RATE_LIMITS.anonymous.windowMs),
      limit: RATE_LIMITS.anonymous.maxRequests,
    };
  }

  const config = isAuthenticated
    ? RATE_LIMITS.authenticated
    : RATE_LIMITS.anonymous;
  const key = isAuthenticated ? `auth:${identifier}` : `anon:${identifier}`;

  try {
    const client = await redis();
    if (client) {
      const [used, ttlMs] = (await client.eval(RATE_LIMIT_SCRIPT, {
        keys: [`chat-ratelimit:v1:${key}`],
        arguments: [String(config.windowMs)],
      })) as [number, number];

      // A blocked request still counts, so a caller that keeps hammering
      // cannot learn when the window reopens by watching the counter stall.
      // PEXPIRE ran only on the first request, so the reset time does not move.
      const remainingMs = Number(ttlMs) > 0 ? Number(ttlMs) : config.windowMs;

      return {
        allowed: Number(used) <= config.maxRequests,
        remaining: Math.max(0, config.maxRequests - Number(used)),
        resetTime: new Date(now + remainingMs),
        limit: config.maxRequests,
      };
    }
  } catch (error) {
    // Redis down is not a reason to serve the most expensive endpoint
    // unmetered, nor to answer 500: count in memory and carry on.
    console.warn(
      '[chat] rate limit: Redis unavailable, counting in this instance only',
      error instanceof Error ? error.message : error
    );
  }

  return checkLocalRateLimit(key, config, now);
}

/** Per-instance counting: the pre-Redis behavior, kept as the fallback. */
function checkLocalRateLimit(
  key: string,
  config: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS],
  now: number
): RateLimitResult {
  // Periodic cleanup
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    cleanupOldEntries();
  }

  const entry = rateLimitStore.get(key);

  // No existing entry - create new window
  if (!entry) {
    rateLimitStore.set(key, {
      count: 1,
      windowStart: now,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: new Date(now + config.windowMs),
      limit: config.maxRequests,
    };
  }

  // Check if window has expired
  if (now - entry.windowStart > config.windowMs) {
    // Start new window
    rateLimitStore.set(key, {
      count: 1,
      windowStart: now,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: new Date(now + config.windowMs),
      limit: config.maxRequests,
    };
  }

  // Within current window - check limit
  const resetTime = new Date(entry.windowStart + config.windowMs);

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime,
      limit: config.maxRequests,
    };
  }

  // Increment count
  entry.count++;

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime,
    limit: config.maxRequests,
  };
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.resetTime.getTime() / 1000).toString(),
  };
}

/**
 * Format reset time for user-friendly message
 */
export function formatResetTime(resetTime: Date): string {
  const now = Date.now();
  const diffMs = resetTime.getTime() - now;
  const diffMinutes = Math.ceil(diffMs / (1000 * 60));

  if (diffMinutes <= 1) {
    return 'in less than a minute';
  } else if (diffMinutes < 60) {
    return `in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  } else {
    const diffHours = Math.ceil(diffMinutes / 60);
    return `in about ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  }
}

// Export config for testing/debugging
export const CHAT_RATE_LIMITS = RATE_LIMITS;
