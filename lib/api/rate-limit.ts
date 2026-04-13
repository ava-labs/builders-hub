// NOTE: Run `npx prisma migrate dev --name add_api_rate_limit_log` to generate the migration
// after merging this change into the main branch.

import type { NextRequest } from 'next/server';
import { prisma } from '@/prisma/prisma';
import { AuthError } from '@/lib/api/errors';
import type { RateLimitConfig } from '@/lib/api/types';

/** Extract the client IP address from request headers (Cloudflare, Vercel, nginx). */
export function getClientIP(req: NextRequest): string {
  const headers = req.headers;

  // Cloudflare
  const cfConnectingIP = headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;

  // Vercel / standard proxy -- first IP is the original client
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const firstIP = xForwardedFor.split(',')[0].trim();
    if (firstIP) return firstIP;
  }

  // Generic proxy
  const xRealIP = headers.get('x-real-ip');
  if (xRealIP) return xRealIP;

  return 'unknown';
}

/** Check rate limit using Prisma-backed log entries. Returns status and standard headers. */
export async function checkPrismaRateLimit(
  identifier: string,
  endpoint: string,
  config: { windowMs: number; maxRequests: number }
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  headers: Record<string, string>;
}> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);
  const resetAt = new Date(now.getTime() + config.windowMs);

  // Use a serializable transaction to prevent TOCTOU race conditions.
  // Without this, two concurrent requests could both pass the count check.
  return prisma.$transaction(async (tx) => {
    const count = await tx.apiRateLimitLog.count({
      where: {
        identifier,
        endpoint,
        created_at: { gte: windowStart },
      },
    });

    const remaining = Math.max(0, config.maxRequests - count);
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.floor(resetAt.getTime() / 1000).toString(),
    };

    if (count >= config.maxRequests) {
      const oldest = await tx.apiRateLimitLog.findFirst({
        where: {
          identifier,
          endpoint,
          created_at: { gte: windowStart },
        },
        orderBy: { created_at: 'asc' },
        select: { created_at: true },
      });

      const preciseResetAt = oldest
        ? new Date(oldest.created_at.getTime() + config.windowMs)
        : resetAt;

      headers['X-RateLimit-Remaining'] = '0';
      headers['X-RateLimit-Reset'] = Math.floor(preciseResetAt.getTime() / 1000).toString();

      return { allowed: false, remaining: 0, resetAt: preciseResetAt, headers };
    }

    // Under limit -- log this request atomically within the same transaction
    await tx.apiRateLimitLog.create({
      data: { identifier, endpoint },
    });

    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - count - 1),
      headers: {
        ...headers,
        'X-RateLimit-Remaining': Math.max(0, config.maxRequests - count - 1).toString(),
      },
      resetAt,
    };
  }, { isolationLevel: 'Serializable' });
}

/** Delete rate limit log entries older than the given threshold. Returns count deleted. */
export async function cleanupRateLimitLogs(olderThanMs = 86400000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await prisma.apiRateLimitLog.deleteMany({
    where: { created_at: { lt: cutoff } },
  });
  return result.count;
}

/** Resolve the rate limit identifier from config, session, and request. */
export function getRateLimitIdentifier(
  req: NextRequest,
  session: any,
  config: RateLimitConfig
): string {
  if (typeof config.identifier === 'function') {
    return config.identifier(req, session);
  }

  if (config.identifier === 'ip') {
    return getClientIP(req);
  }

  if (config.identifier === 'user') {
    if (!session?.user?.id) {
      throw new AuthError('Authentication required for user-based rate limiting');
    }
    return session.user.id;
  }

  // Default: use user ID if session exists, otherwise fall back to IP
  if (session?.user?.id) {
    return session.user.id;
  }
  return getClientIP(req);
}
