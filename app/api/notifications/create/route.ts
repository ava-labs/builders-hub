import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, InternalError } from '@/lib/api/errors';

function stripMdxExpressions(content: string): string {
  return content
    .replace(/^export\s[^\n]*/gm, '')
    .replace(/^import\s[^\n]*/gm, '')
    .replace(/\{[^}]*\}/g, '')
    .trim();
}

const CreateNotificationsSchema = z.object({
  notifications: z.array(z.record(z.string(), z.unknown())).min(1, 'At least one notification is required'),
});

type CreateNotificationsBody = z.infer<typeof CreateNotificationsSchema>;

export const POST = withApi<CreateNotificationsBody>(
  async (_req: NextRequest, { session, body }) => {
    const baseUrl = process.env.NEXT_PUBLIC_AVALANCHE_WORKERS_URL;
    const avalancheWorkersApiKey = process.env.AVALANCHE_WORKERS_API_KEY;

    if (!baseUrl || !avalancheWorkersApiKey) {
      throw new InternalError('Notification service not configured');
    }

    const notifications = body.notifications.map((n: any) => ({
      ...n,
      content: typeof n.content === 'string' ? stripMdxExpressions(n.content) : n.content,
    }));

    const upstream = await fetch(`${baseUrl}/notifications/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': avalancheWorkersApiKey,
      },
      body: JSON.stringify({
        notifications,
        authUser: session.user.id,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      throw new BadRequestError(text || 'Failed to create notifications');
    }

    const contentType = upstream.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const payload = await upstream.json();
      return successResponse(payload);
    }

    return successResponse({ ok: true });
  },
  { auth: true, roles: ['devrel', 'notify_event'], schema: CreateNotificationsSchema },
);
