/**
 * Rate limiting for MCP server endpoints using Vercel KV
 *
 * Implements distributed rate limiting that works across serverless instances.
 * Clients are identified by origin header (browsers) or hashed IP (non-browser clients).
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { createHash } from 'crypto';

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute

/**
 * Hash an IP address for privacy-preserving rate limiting
 */
function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/**
 * Get client identifier from request
 * - Browsers: origin header (public info, no hashing needed)
 * - Non-browser: hashed IP address (privacy-preserving)
 */
function getClientId(request: NextRequest): string {
  const origin = request.headers.get('origin');
  if (origin) return `origin:${origin}`;

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0].trim();
    return `ip:${hashIp(ip)}`;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return `ip:${hashIp(realIp)}`;
  }

  return 'unknown';
}

/**
 * Check rate limit using Vercel KV
 * Returns null if allowed, or NextResponse with 429 if rate limit exceeded
 */
export async function checkMCPRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const clientId = getClientId(request);
  const now = Date.now();
  const key = `mcp-ratelimit:${clientId}`;

  try {
    // Get current request timestamps from KV
    const timestamps = await kv.get<number[]>(key) || [];

    // Remove timestamps outside the current window
    const validTimestamps = timestamps.filter(t => now - t < WINDOW_MS);

    // Check if limit exceeded
    if (validTimestamps.length >= MAX_REQUESTS) {
      const oldestRequest = validTimestamps[0];
      const resetTime = oldestRequest + WINDOW_MS;
      const retryAfter = Math.ceil((resetTime - now) / 1000);

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32000,
            message: `Rate limit exceeded. Maximum ${MAX_REQUESTS} requests per minute allowed.`
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

    // Add current request timestamp
    validTimestamps.push(now);

    // Store in KV with TTL slightly longer than window (to allow for clock skew)
    await kv.set(key, validTimestamps, { px: WINDOW_MS + 5000 });

    return null;
  } catch (error) {
    // If KV fails, fail open to avoid breaking the service
    console.error('Rate limit check failed:', error);
    return null;
  }
}

/**
 * Get current rate limit status for a client
 * Used to add headers to successful responses
 */
export async function getRateLimitHeaders(request: NextRequest): Promise<Record<string, string>> {
  const clientId = getClientId(request);
  const now = Date.now();
  const key = `mcp-ratelimit:${clientId}`;

  try {
    const timestamps = await kv.get<number[]>(key) || [];
    const validTimestamps = timestamps.filter(t => now - t < WINDOW_MS);

    const remaining = Math.max(0, MAX_REQUESTS - validTimestamps.length);
    const resetTime = validTimestamps.length > 0
      ? validTimestamps[0] + WINDOW_MS
      : now + WINDOW_MS;

    return {
      'RateLimit-Limit': MAX_REQUESTS.toString(),
      'RateLimit-Remaining': remaining.toString(),
      'RateLimit-Reset': new Date(resetTime).toISOString(),
    };
  } catch (error) {
    console.error('Failed to get rate limit headers:', error);
    return {
      'RateLimit-Limit': MAX_REQUESTS.toString(),
      'RateLimit-Remaining': MAX_REQUESTS.toString(),
      'RateLimit-Reset': new Date(now + WINDOW_MS).toISOString(),
    };
  }
}
