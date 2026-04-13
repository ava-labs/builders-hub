import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError } from '@/lib/api/errors';
import { GetProjectsByUserId } from '@/server/services/memberProject';

export const GET = withApi(
  async (_req: NextRequest, { params }) => {
    const { id } = params;
    if (!id) throw new BadRequestError('User ID required');

    const projects = await GetProjectsByUserId(id);
    return successResponse(projects);
  },
  { auth: true },
);
