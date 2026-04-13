// schema: not applicable — member status update with dynamic fields
import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, ForbiddenError } from '@/lib/api/errors';
import { isUserProjectMember } from '@/server/services/fileValidation';
import { UpdateStatusMember } from '@/server/services/memberProject';

export const PATCH = withApi(
  async (req: NextRequest, { session, params }) => {
    const { id } = params;
    if (!id) throw new BadRequestError('project id is required');

    const body = await req.json();
    const { user_id, status, wasInOtherProject } = body;

    const isMember = await isUserProjectMember(session.user.id, id);
    if (!isMember) throw new ForbiddenError('You are not a member of this project');

    // Users can only update their own status
    if (user_id && user_id !== session.user.id) {
      throw new ForbiddenError('You can only update your own member status');
    }

    const updatedMember = await UpdateStatusMember(
      session.user.id,
      id,
      status,
      session.user.email || '',
      wasInOtherProject,
    );

    return successResponse(updatedMember);
  },
  { auth: true },
);
