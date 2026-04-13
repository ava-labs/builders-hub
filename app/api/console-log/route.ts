import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { prisma } from '@/prisma/prisma';
import { checkAndAwardConsoleBadges } from '@/server/services/consoleBadge/consoleBadgeService';
import type { AwardedConsoleBadge } from '@/server/services/consoleBadge/types';

const consoleLogSchema = z.object({
  status: z.string().min(1, 'Status is required'),
  actionPath: z.string().min(1, 'actionPath is required'),
  data: z.any().optional(),
  timezone: z.string().optional(),
});

export const GET = withApi(
  async (_req: NextRequest, { session }) => {
    const logs = await prisma.consoleLog.findMany({
      where: { user_id: session.user.id },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    return successResponse(logs);
  },
  { auth: true },
);

export const POST = withApi<z.infer<typeof consoleLogSchema>>(
  async (_req: NextRequest, { session, body }) => {
    const { status, actionPath, data, timezone } = body;

    const logEntry = await prisma.consoleLog.create({
      data: {
        user_id: session.user.id,
        status,
        action_path: actionPath,
        data,
      },
    });

    let awardedBadges: AwardedConsoleBadge[] = [];
    try {
      awardedBadges = await checkAndAwardConsoleBadges(session.user.id, 'console_log', { timezone });
    } catch {
      // Badge check is non-critical
    }

    return successResponse({ ...logEntry, awardedBadges });
  },
  { auth: true, schema: consoleLogSchema },
);

// Log deletion is disabled for audit / metric purposes
