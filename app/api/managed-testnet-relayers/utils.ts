import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { ServiceErrorSchema } from './types';
import { validatePublicRpcUrl } from '@/app/api/console/l1-upgrade/rpc-utils';

export async function getUserId(): Promise<{ userId: string | null; error?: NextResponse }> {
  const session = await getAuthSession();
  // Signed in locally, you see the relayers Studio and Quick L1 made for your account; signed out, a shared dev account.
  if (!session?.user?.id && process.env.NODE_ENV === 'development') {
    return { userId: 'dev-user-id' };
  }
  if (!session?.user?.id) {
    return {
      userId: null,
      error: NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please sign in to access managed testnet relayers',
        },
        { status: 401 },
      ),
    };
  }
  // A session before the terms are accepted has no account row (its id is "pending_<email>"), so it can own nothing.
  if (session.user.id.startsWith('pending_')) {
    return {
      userId: null,
      error: NextResponse.json(
        { error: 'Account required', message: 'Finish sign-up to use managed testnet relayers' },
        { status: 403 },
      ),
    };
  }
  return { userId: session.user.id };
}

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
      if (text) return text.slice(0, 200);
    } catch {}
  }
  return null;
}

/** Null for a URL the relayer service may connect to, else the reason. */
export function relayerUrlError(config: { rpcUrl: string; wsUrl: string }): string | null {
  if (!/^https?:\/\//i.test(config.rpcUrl)) return 'rpcUrl must use http or https';
  if (!/^wss?:\/\//i.test(config.wsUrl)) return 'wsUrl must use ws or wss';
  // the host rules are the same for both: read the ws URL as its http form
  return validatePublicRpcUrl(config.rpcUrl) ?? validatePublicRpcUrl(config.wsUrl.replace(/^ws/i, 'http'));
}
