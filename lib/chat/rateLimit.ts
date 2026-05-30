/**
 * Chat Rate Limiting
 *
 * Implements tiered rate limiting for the chat API:
 * - Anonymous users: Limited by IP address (10 messages per hour)
 * - Authenticated users: High limit per user ID (1000 messages per hour)
 *
 * Uses in-memory storage with automatic cleanup.
 * For production scale, consider upgrading to Redis.
 */

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

/**
 * Extract client IP address from request headers
 * Handles various proxy configurations (Cloudflare, Vercel, nginx, etc.)
 */
export function getClientIP(request: Request): string {
  const headers = request.headers;

  // Cloudflare
  const cfConnectingIP = headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;

  // Vercel / standard proxy
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2"
    // The first one is the original client
    const firstIP = xForwardedFor.split(',')[0].trim();
    if (firstIP) return firstIP;
  }

  // Generic proxy
  const xRealIP = headers.get('x-real-ip');
  if (xRealIP) return xRealIP;

  // Fallback - this might be the load balancer IP in production
  return 'unknown';
}

/**
 * Check rate limit for a chat request
 *
 * @param identifier - User ID for authenticated users, IP for anonymous
 * @param isAuthenticated - Whether the user is logged in
 * @returns Rate limit result with allowed status and metadata
 */
export function checkChatRateLimit(
  identifier: string,
  isAuthenticated: boolean
): RateLimitResult {
  const now = Date.now();

  // Periodic cleanup
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    cleanupOldEntries();
  }

  const config = isAuthenticated
    ? RATE_LIMITS.authenticated
    : RATE_LIMITS.anonymous;

  const key = isAuthenticated ? `auth:${identifier}` : `anon:${identifier}`;
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
