import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { rateLimit } from '@/lib/rateLimit';
import { isValidAvalancheId } from '@/lib/console/l1-upgrade-selection';
import { ServiceErrorSchema } from './types';

export async function getUserId(): Promise<{ userId: string | null; error?: NextResponse }> {
  const session = await getAuthSession();
  // Signed in locally, you see the nodes Studio and Quick L1 made for your account; signed out, a shared dev account.
  if (!session?.user?.id && process.env.NODE_ENV === 'development') {
    return { userId: 'dev-user-id' };
  }
  if (!session?.user?.id) {
    return {
      userId: null,
      error: NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please sign in to access managed testnet nodes',
        },
        { status: 401 },
      ),
    };
  }
  return { userId: session.user.id };
}

// Subnet and blockchain IDs go into upstream URL paths. Only base58 text of an ID's
// length may pass: that alphabet has no '/', '.', '%', '?' or '#', so the value cannot
// change the path. The checksum is not verified here: the node service refuses a subnet
// that does not exist.
export function validateSubnetId(subnetId: string): boolean {
  return typeof subnetId === 'string' && subnetId === subnetId.trim() && isValidAvalancheId(subnetId);
}
export const validateBlockchainId = validateSubnetId;

// The node service keys a node on (subnet, node index), reuses a freed slot, and knows
// nothing about accounts. A registration holds its slot only while it is active and
// unexpired. Never send a stale one to the service: another account can hold the slot.
export function isLiveRegistration(row: { status: string; expires_at: Date }): boolean {
  return row.status === 'active' && row.expires_at.getTime() > Date.now();
}

export function toDateFromEpoch(epoch: number): Date {
  const ms = epoch > 1e12 ? epoch : epoch * 1000;
  return new Date(ms);
}

type RateLimitConfig = {
  dev: { windowMs: number; max: number };
  prod: { windowMs: number; max: number };
  identifier: () => Promise<string>;
};

export function rateLimited(handler: (request: NextRequest) => Promise<NextResponse>, config: RateLimitConfig) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  return rateLimit(handler, {
    windowMs: isDevelopment ? config.dev.windowMs : config.prod.windowMs,
    maxRequests: isDevelopment ? config.dev.max : config.prod.max,
    identifier: config.identifier,
  });
}

// Must match slimnode's ASSIGNMENT_EXPIRATION_TIME. Shorter and the UI
// expires a node the service is still serving.
export const NODE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function jsonOk(payload: any, status = 200) {
  return NextResponse.json(payload, { status });
}

export function jsonError(status: number, message: string, error?: unknown) {
  if (error) {
    try {
      // eslint-disable-next-line no-console
      console.error(message, typeof error === 'string' ? error.slice(0, 500) : error);
    } catch {}
  }
  return NextResponse.json({ error: 'Error', message }, { status });
}

// The message for a reply that is not JSON from the node service. A proxy in front of
// the service can answer with an HTML page: never show that page to the user.
export function serviceStatusMessage(status: number): string {
  return `The managed node service did not accept the request (HTTP ${status}). Try again later.`;
}

function looksLikeHtml(text: string): boolean {
  return /^\s*</.test(text);
}

// Extracts a useful error message from a non-OK Response from the external service
export async function extractServiceErrorMessage(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const body = await response.json();
      const parsed = ServiceErrorSchema.safeParse(body);
      if (parsed.success) {
        return parsed.data.error || parsed.data.message || null;
      }
    } catch {}
  } else {
    try {
      const text = await response.text();
      if (text && looksLikeHtml(text)) {
        console.error(`Managed node service returned HTML (HTTP ${response.status}):`, text.slice(0, 300));
        return serviceStatusMessage(response.status);
      }
      if (text) return text.slice(0, 200);
    } catch {}
  }
  return null;
}
