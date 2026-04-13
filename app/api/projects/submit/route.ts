import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { ForbiddenError } from '@/lib/api/errors';
import { GetProjectByHackathonAndUser } from '@/server/services/projects';
import { createProject } from '@/server/services/submitProject';

// schema: not applicable — project submission with dynamic fields validated by service layer
export const POST = withApi(
  async (req: NextRequest, { session }) => {
    const body = await req.json();
    const newProject = await createProject({
      ...body,
      submittedBy: session.user.email,
    });

    return successResponse(newProject, 201);
  },
  { auth: true },
);

export const GET = withApi(
  async (req: NextRequest, { session }) => {
    const searchParams = req.nextUrl.searchParams;
    const hackathonId = searchParams.get('hackathon_id') ?? '';
    const userId = searchParams.get('user_id');
    const invitationId = searchParams.get('invitation_id') ?? '';

    // Verify user_id matches session user if provided
    if (userId && userId !== session.user.id) {
      throw new ForbiddenError('You can only access your own projects');
    }

    const project = await GetProjectByHackathonAndUser(hackathonId, session.user.id, invitationId);

    return successResponse({ project: project || null });
  },
  { auth: true },
);
