import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError } from '@/lib/api/errors';
import { SetWinner } from '@/server/services/set-project-winner';

// schema: not applicable — simple project_id + isWinner body, validated inline
export const PUT = withApi(
  async (req: NextRequest, { session }) => {
    const body = await req.json();

    if (!body.project_id) {
      throw new BadRequestError('project_id is required');
    }
    if (!body.isWinner) {
      throw new BadRequestError('isWinner is required');
    }

    const badge = await SetWinner(body.project_id, body.isWinner, session.user.name || 'user');

    return successResponse(badge);
  },
  { auth: true, roles: ['badge_admin'] },
);
