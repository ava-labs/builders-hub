import { z } from 'zod';
import { withApi, successResponse, validateQuery } from '@/lib/api';
import { getBadgeByCourseId } from '@/server/services/badge';

const querySchema = z.object({
  course_id: z.string().min(1, 'course_id is required'),
});

export const GET = withApi(
  async (req) => {
    const { course_id } = validateQuery(req, querySchema);
    const badge = await getBadgeByCourseId(course_id);
    return successResponse(badge);
  },
  { auth: true },
);
