import { withApi, successResponse } from '@/lib/api';
import { prisma } from '@/prisma/prisma';
import { evaluateAllConsoleBadges } from '@/server/services/consoleBadge/consoleBadgeService';

// schema: not applicable — no request body, migration trigger only
export const POST = withApi(
  async () => {
    // Get distinct user IDs from all console-related tables
    const [consoleLogUsers, faucetClaimUsers, nodeRegistrationUsers] = await Promise.all([
      prisma.consoleLog.findMany({ select: { user_id: true }, distinct: ['user_id'] }),
      prisma.faucetClaim.findMany({ select: { user_id: true }, distinct: ['user_id'] }),
      prisma.nodeRegistration.findMany({ select: { user_id: true }, distinct: ['user_id'] }),
    ]);

    const uniqueUserIds = new Set([
      ...consoleLogUsers.map((u) => u.user_id),
      ...faucetClaimUsers.map((u) => u.user_id),
      ...nodeRegistrationUsers.map((u) => u.user_id),
    ]);

    const results: { userId: string; badgesAwarded: number }[] = [];
    let totalBadgesAwarded = 0;

    for (const userId of uniqueUserIds) {
      const awarded = await evaluateAllConsoleBadges(userId);
      if (awarded.length > 0) {
        results.push({ userId, badgesAwarded: awarded.length });
        totalBadgesAwarded += awarded.length;
      }
    }

    return successResponse({
      usersProcessed: uniqueUserIds.size,
      totalBadgesAwarded,
      details: results,
    });
  },
  { auth: true, roles: ['devrel'] },
);
