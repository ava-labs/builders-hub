// schema: not applicable — partial project update with allowlisted fields
import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/api/errors';
import { updateProject } from '@/server/services/projects';
import { isUserProjectMember } from '@/server/services/fileValidation';
import { GetProjectByIdWithMembers } from '@/server/services/memberProject';

/** Fields that callers are allowed to update via PUT. Prevents mass-assignment of
 *  sensitive columns like is_winner, hackaton_id, created_at, etc. */
const UPDATABLE_FIELDS = [
  'project_name',
  'short_description',
  'full_description',
  'tech_stack',
  'github_repository',
  'demo_link',
  'demo_video_link',
  'logo_url',
  'cover_url',
  'screenshots',
  'tracks',
  'categories',
  'other_category',
  'tags',
  'open_source',
  'origin',
] as const;

export const GET = withApi(
  async (_req: NextRequest, { session, params }) => {
    const { id } = params;
    if (!id) throw new BadRequestError('ID required');

    const isMember = await isUserProjectMember(session.user.id, id);
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this project');
    }

    const project = await GetProjectByIdWithMembers(id);
    if (!project) {
      throw new NotFoundError('Project');
    }
    return successResponse(project);
  },
  { auth: true },
);

export const PUT = withApi(
  async (req: NextRequest, { session, params }) => {
    const { id } = params;
    if (!id) throw new BadRequestError('ID required');

    const isMember = await isUserProjectMember(session.user.id, id);
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this project');
    }

    const raw = await req.json();

    // Whitelist: only copy allowed fields to prevent mass assignment
    const sanitized: Record<string, unknown> = {};
    for (const key of UPDATABLE_FIELDS) {
      if (key in raw) {
        sanitized[key] = raw[key];
      }
    }

    const updatedProject = await updateProject(id, sanitized);
    return successResponse(updatedProject);
  },
  { auth: true },
);
