/**
 * Rate limiting for the Studio API routes.
 *
 * Two separate buckets keyed by NextAuth user id (login required for AI generation):
 *   - deck-generate:  10 / 24h
 *   - card-regenerate: 30 / 1h
 *
 * In-memory store. Mirrors `lib/chat/rateLimit.ts` so production hardening
 * (Redis-backed counters) can later swap both modules together.
 */

type Bucket = 'deck-generate' | 'card-regenerate';

interface BucketConfig {
  maxRequests: number;
  windowMs: number;
}

const BUCKETS: Record<Bucket, BucketConfig> = {
  'deck-generate': { maxRequests: 10, windowMs: 24 * 60 * 60 * 1000 },
  'card-regenerate': { maxRequests: 30, windowMs: 60 * 60 * 1000 },
};

interface Entry {
  count: number;
  windowStart: number;
}

const store = new Map<string, Entry>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  const maxWindow = Math.max(
    ...Object.values(BUCKETS).map((b) => b.windowMs),
  );
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > maxWindow) {
      store.delete(key);
    }
  }
  lastCleanup = now;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetTime: Date;
  bucket: Bucket;
}

export function checkFlashcardsRateLimit(
  bucket: Bucket,
  userId: string,
): RateLimitResult {
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    cleanup();
  }

  const cfg = BUCKETS[bucket];
  const key = `${bucket}:${userId}`;
  const existing = store.get(key);

  if (!existing || now - existing.windowStart > cfg.windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: cfg.maxRequests - 1,
      limit: cfg.maxRequests,
      resetTime: new Date(now + cfg.windowMs),
      bucket,
    };
  }

  const resetTime = new Date(existing.windowStart + cfg.windowMs);

  if (existing.count >= cfg.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      limit: cfg.maxRequests,
      resetTime,
      bucket,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: cfg.maxRequests - existing.count,
    limit: cfg.maxRequests,
    resetTime,
    bucket,
  };
}

export function createFlashcardsRateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetTime.getTime() / 1000)),
    'X-RateLimit-Bucket': result.bucket,
  };
}

export const FLASHCARDS_RATE_LIMITS = BUCKETS;
