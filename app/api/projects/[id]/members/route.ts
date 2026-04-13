// schema: not applicable — PATCH body is member role update with dynamic fields
import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, ForbiddenError } from '@/lib/api/errors';
import { isUserProjectMember } from '@/server/services/fileValidation';
import { GetMembersByProjectId, UpdateRoleMember } from '@/server/services/memberProject';

export const GET = withApi(
  async (_req: NextRequest, { session, params }) => {
    const { id } = params;
    if (!id) throw new BadRequestError('project id is required');

    const isMember = await isUserProjectMember(session.user.id, id);
    if (!isMember) throw new ForbiddenError('You are not a member of this project');

    const members = await GetMembersByProjectId(id);
    return successResponse(members ?? []);
  },
  { auth: true },
);

export const PATCH = withApi(
  async (req: NextRequest, { session, params }) => {
    const { id } = params;
    if (!id) throw new BadRequestError('project id is required');

    const body = await req.json();
    const { member_id, role } = body;

    if (!member_id || !role) {
      throw new BadRequestError('member_id and role are required');
    }

    const isMember = await isUserProjectMember(session.user.id, id);
    if (!isMember) throw new ForbiddenError('You are not a member of this project');

    const updatedMember = await UpdateRoleMember(member_id, role);
    return successResponse(updatedMember);
  },
  { auth: true },
);
