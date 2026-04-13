import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, InternalError } from '@/lib/api/errors';

// schema: not applicable — forwards notification IDs to external service
export const POST = withApi(
  async (req: NextRequest, { session }) => {
    const baseUrl = process.env.NEXT_PUBLIC_AVALANCHE_WORKERS_URL;
    const avalancheWorkersApiKey = process.env.AVALANCHE_WORKERS_API_KEY;

    if (!baseUrl || !avalancheWorkersApiKey) {
      throw new InternalError('Notification service not configured');
    }

    const body = await req.json();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const upstream = await fetch(`${baseUrl}/notifications/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': avalancheWorkersApiKey,
        },
        body: JSON.stringify({
          notifications: body,
          authUser: session.user.id,
        }),
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!upstream.ok) {
        const text = await upstream.text();
        throw new BadRequestError(text || 'Failed to read notifications');
      }

      const contentType = upstream.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const payload = await upstream.json();
        return successResponse(payload);
      }

      return successResponse({ ok: true });
    } finally {
      clearTimeout(timeoutId);
    }
  },
  { auth: true },
);
