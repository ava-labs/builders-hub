import { withApi, successResponse } from '@/lib/api';
import { evaluateAllConsoleBadges } from '@/server/services/consoleBadge/consoleBadgeService';

// schema: not applicable — body is optional (timezone hint), parsed defensively
export const POST = withApi(
  async (req, { session }) => {
    let timezone: string | undefined;
    try {
      const body = await req.json();
      timezone = body?.timezone;
    } catch {
      // No body or invalid JSON — timezone stays undefined
    }

    const awardedBadges = await evaluateAllConsoleBadges(session.user.id, { timezone });
    return successResponse({ awardedBadges });
  },
  { auth: true },
);
