import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { ForbiddenError } from '@/lib/api/errors';
import { isUserProjectMember } from '@/server/services/fileValidation';
import { generateInvitation } from '@/server/services/inviteProjectMember';

/**
 * Flat invite-member endpoint for backward compatibility.
 * Accepts project_id in the request body rather than the URL.
 * Prefer /api/projects/[id]/invite for new code.
 */
// schema: not applicable — invitation payload with dynamic fields
export const POST = withApi(
  async (req: NextRequest, { session }) => {
    const body = await req.json();

    // If project_id is provided, verify user is a member
    if (body.project_id) {
      const isMember = await isUserProjectMember(session.user.id, body.project_id);
      if (!isMember) {
        throw new ForbiddenError('You must be a member of the project to invite others');
      }
    }

    const result = await generateInvitation(
      body.hackathon_id,
      session.user.id,
      session.user.name,
      body.emails,
      body.project_id,
      body.stage,
    );

    return successResponse(result);
  },
  { auth: true },
);
