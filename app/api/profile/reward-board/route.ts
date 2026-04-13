import { z } from 'zod';
import { withApi, successResponse, validateQuery } from '@/lib/api';
import { getRewardBoard } from '@/server/services/rewardBoard';

const querySchema = z.object({
  user_id: z.string().min(1, 'user_id is required'),
});

export const GET = withApi(
  async (req) => {
    const { user_id } = validateQuery(req, querySchema);
    const badges = await getRewardBoard(user_id);
    return successResponse(badges);
  },
  { auth: true },
);
