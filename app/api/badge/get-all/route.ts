import { withApi, successResponse } from '@/lib/api';
import { getAllBadges } from '@/server/services/badge';

export const GET = withApi(
  async () => {
    const badges = await getAllBadges();
    return successResponse(badges);
  },
  { auth: true },
);
