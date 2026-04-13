import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, ForbiddenError } from '@/lib/api/errors';
import { CheckInvitation } from '@/server/services/projects';

export const GET = withApi(
  async (req: NextRequest, { session }) => {
    const invitationId = req.nextUrl.searchParams.get('invitation');
    const userId = req.nextUrl.searchParams.get('user_id');

    if (!invitationId) {
      throw new BadRequestError('invitation parameter is required');
    }

    // Verify user_id matches session if provided
    if (userId && userId !== session.user.id) {
      throw new ForbiddenError('You can only check invitations for yourself');
    }

    const member = await CheckInvitation(invitationId, session.user.id);
    return successResponse(member);
  },
  { auth: true },
);
