import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { ServiceErrorSchema } from './types';

export async function getUserId(): Promise<{ userId: string | null; error?: NextResponse }> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (isDevelopment) {
    return { userId: 'dev-user-id' };
  }
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return {
      userId: null,
      error: NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please sign in to access managed testnet relayers'
        },
        { status: 401 }
      )
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

