import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { ForbiddenError } from '@/lib/api/errors';
import { isUserProjectMember } from '@/server/services/fileValidation';
import { generateInvitation } from '@/server/services/inviteProjectMember';

// schema: not applicable — invitation payload with dynamic fields
export const POST = withApi(
  async (req: NextRequest, { session, params }) => {
    const { id } = params;
    const body = await req.json();

    // If project id is provided via route param, verify membership
    if (id) {
      const isMember = await isUserProjectMember(session.user.id, id);
      if (!isMember) {
        throw new ForbiddenError('You must be a member of the project to invite others');
      }
    }

    const result = await generateInvitation(
      body.hackathon_id,
      session.user.id,
      session.user.name,
      body.emails,
      id || body.project_id,
      body.stage,
    );

    return successResponse(result);
  },
  { auth: true },
);
