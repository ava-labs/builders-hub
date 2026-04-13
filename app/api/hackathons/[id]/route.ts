import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError } from '@/lib/api/errors';
import { getHackathon, updateHackathon } from '@/server/services/hackathons';

export const GET = withApi(async (_req: NextRequest, { params }) => {
  const { id } = params;
  if (!id) throw new BadRequestError('ID required');

  const hackathon = await getHackathon(id);
  return successResponse(hackathon);
});

// schema: not applicable — partial hackathon update with dynamic fields
export const PUT = withApi(
  async (req: NextRequest, { session, params }) => {
    const { id } = params;
    if (!id) throw new BadRequestError('ID required');

    const updateData = await req.json();
    const userId = session.user.id;

    // Short-circuit: if only toggling is_public, restrict the update to that field
    if (
      updateData.hasOwnProperty('is_public') &&
      typeof updateData.is_public === 'boolean' &&
      Object.keys(updateData).length === 1
    ) {
      const updated = await updateHackathon(id, { is_public: updateData.is_public }, userId);
      return successResponse(updated);
    }

    const updated = await updateHackathon(updateData.id ?? id, updateData, userId);
    return successResponse(updated);
  },
  { auth: true, roles: ['devrel'] },
);

export const PATCH = withApi(
  async (req: NextRequest, { session, params }) => {
    const { id } = params;
    if (!id) throw new BadRequestError('ID required');

    const updateData = await req.json();
    const userId = session.user.id;

    if (updateData.hasOwnProperty('is_public') && typeof updateData.is_public === 'boolean') {
      const updated = await updateHackathon(id, { is_public: updateData.is_public }, userId);
      return successResponse(updated);
    }

    throw new BadRequestError('Only is_public field can be updated via PATCH');
  },
  { auth: true, roles: ['devrel'] },
);
