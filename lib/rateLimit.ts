import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  lastRequest: number;
  count: number;
}

const rateLimits = new Map<string, RateLimitEntry>();
export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  identifier?: (req: NextRequest) => Promise<string>;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  windowMs: 24 * 60 * 60 * 1000,
  maxRequests: 1,
};

async function defaultIdentifier(): Promise<string> {
    const session = await import('@/lib/auth/authSession').then(mod => mod.getAuthSession());
    if (!session) throw new Error('Authentication required');
    const userId = session.user.id;
    return userId;
}

function getResetTime(timestamp: number): string {
  const resetTime = new Date(timestamp); 
  const localString = resetTime.toLocaleString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: '2-digit',
    timeZoneName: 'short'
  });
  
  // add relative time for better user experience
  const now = Date.now();
  const diffMs = timestamp - now;
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.ceil(diffMs / (1000 * 60));
  
  let relativeTime = '';
  if (diffHours >= 1) {
    relativeTime = `in about ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  } else if (diffMinutes > 1) {
    relativeTime = `in about ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  } else {
    relativeTime = 'in less than a minute';
  }
  
  return `${localString} (${relativeTime})`;
}

export function rateLimit(handler: Function, options?: Partial<RateLimitOptions>) {
  const opts: RateLimitOptions = { 
    ...DEFAULT_OPTIONS, 
    identifier: defaultIdentifier,
    ...options 
  };
  
  return async (req: NextRequest, ...args: any[]) => {
    try {
      const identifier = await opts.identifier!(req);
      const now = Date.now();
      const entry = rateLimits.get(identifier);
      
      if (!entry || (now - entry.lastRequest) > opts.windowMs) {
        rateLimits.set(identifier, { lastRequest: now, count: 1 });
      }
      else if (entry.count >= opts.maxRequests) {
        const resetTime = getResetTime(entry.lastRequest + opts.windowMs);
        return NextResponse.json(
          { 
            success: false, 
            message: `Rate limit exceeded. You can try again after ${resetTime}.` 
          },
          { status: 429 }
        );
      }
      else {
        entry.count += 1;
        entry.lastRequest = now;
        rateLimits.set(identifier, entry);
      }
      return handler(req, ...args);
    } catch (error) {
      console.error('Error in rate limiter middleware', error);
      const status = error instanceof Error && error.message === 'Authentication required' ? 401 : 500;
      const message = error instanceof Error && error.message === 'Authentication required' 
        ? 'Authentication required: Please login to continue' 
        : 'Error processing request';   
      return NextResponse.json(
        { success: false, message },
        { status }
      );
    }
  };
}