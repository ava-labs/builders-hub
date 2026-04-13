import { z } from 'zod';
import { withApi, successResponse, validateQuery } from '@/lib/api';
import { getProjectBadges } from '@/server/services/project-badge';

const querySchema = z.object({
  project_id: z.string().min(1, 'project_id is required'),
});

export const GET = withApi(
  async (req) => {
    const { project_id } = validateQuery(req, querySchema);
    const badges = await getProjectBadges(project_id);
    return successResponse(badges);
  },
  { auth: true },
);
