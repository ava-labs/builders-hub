import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';
import { getAuthSession } from '@/lib/auth/authSession';

interface FaucetRateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  identifier?: (req: NextRequest) => Promise<string>;
}

async function getResetTime(timestamp: Date): Promise<string> {
  const resetTime = new Date(timestamp.getTime() + 24 * 60 * 60 * 1000);
  const diffHours = Math.ceil((resetTime.getTime() - Date.now()) / (1000 * 60 * 60));
  return diffHours >= 1 ? `in about ${diffHours} hour${diffHours > 1 ? 's' : ''}` : 'in less than an hour';
}

export function faucetRateLimit(handler: Function, options?: FaucetRateLimitOptions) {
  const { windowMs = 24 * 60 * 60 * 1000, maxRequests = 1, identifier } = options || {};
  
  return async (req: NextRequest, ...args: any[]) => {
    try {
      const session = await getAuthSession();
      if (!session?.user) throw new Error('Authentication required');
      
      const userId = session.user.id;
      const id = identifier ? await identifier(req) : userId;
      const now = new Date();
      
      const entry = await prisma.faucetRateLimit.findUnique({
        where: { user_id_identifier: { user_id: userId, identifier: id } }
      });
      
      const windowStart = new Date(now.getTime() - windowMs);
      
      if (!entry || entry.last_request < windowStart) {
        await prisma.faucetRateLimit.upsert({
          where: { user_id_identifier: { user_id: userId, identifier: id } },
          update: { last_request: now, count: 1 },
          create: { user_id: userId, identifier: id, last_request: now, count: 1 }
        });
      } else if (entry.count >= maxRequests) {
        const resetTime = await getResetTime(entry.last_request);
        return NextResponse.json(
          { success: false, message: `Rate limit exceeded. You can try again ${resetTime}.` },
          { status: 429 }
        );
      } else {
        await prisma.faucetRateLimit.update({
          where: { user_id_identifier: { user_id: userId, identifier: id } },
          data: { count: entry.count + 1, last_request: now }
        });
      }
      
      return handler(req, ...args);
    } catch (error) {
      console.error('Faucet rate limit error:', error);
      return NextResponse.json(
        { success: false, message: error instanceof Error && error.message === 'Authentication required' 
          ? 'Authentication required: Please login to continue' 
          : 'Error processing request' },
        { status: error instanceof Error && error.message === 'Authentication required' ? 401 : 500 }
      );
    }
  };
}

// Optional cleanup function
export async function cleanupOldFaucetRateLimits(olderThanDays: number = 7) {
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const { count } = await prisma.faucetRateLimit.deleteMany({
    where: { last_request: { lt: cutoffDate } }
  });
  return count;
}
