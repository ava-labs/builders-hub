import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { InternalError } from '@/lib/api/errors';

export const runtime: 'nodejs' = 'nodejs';

// schema: not applicable — no request body, uses POST for side-effect-free fetch from external service
export const POST = withApi(
  async (_req: NextRequest, { session }) => {
    const baseUrl = process.env.NEXT_PUBLIC_AVALANCHE_WORKERS_URL;
    const avalancheWorkersApiKey = process.env.AVALANCHE_WORKERS_API_KEY;

    if (!baseUrl || !avalancheWorkersApiKey) {
      throw new InternalError('Notification service not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const upstream = await fetch(`${baseUrl}/notifications/get/inbox`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': avalancheWorkersApiKey,
        },
        body: JSON.stringify({ authUser: session.user.id }),
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!upstream.ok) {
        // Gracefully handle upstream service unavailable
        if (upstream.status >= 500) {
          return successResponse({});
        }

        const text = await upstream.text();
        throw new InternalError(text || 'Failed to fetch notifications');
      }

      const payload = await upstream.json();
      return successResponse(payload);
    } catch (err: unknown) {
      // Gracefully handle network errors (workers not deployed / timeout)
      if (err instanceof Error && err.name === 'AbortError') {
        return successResponse({});
      }
      // Re-throw API errors
      if (err instanceof Error && 'statusCode' in err) throw err;
      // Gracefully degrade on unexpected errors
      return successResponse({});
    } finally {
      clearTimeout(timeoutId);
    }
  },
  { auth: true },
);
