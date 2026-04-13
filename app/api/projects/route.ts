// schema: not applicable — project creation with dynamic fields validated by service layer
import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { parsePagination } from '@/lib/api/pagination';
import { successResponse, paginatedResponse } from '@/lib/api/response';
import { createProject, getFilteredProjects } from '@/server/services/projects';
import type { GetProjectOptions } from '@/server/services/projects';

export const GET = withApi(
  async (req: NextRequest) => {
    const { page, pageSize } = parsePagination(req);
    const searchParams = req.nextUrl.searchParams;

    const options: GetProjectOptions = {
      page,
      pageSize,
      search: searchParams.get('search') || undefined,
      event: searchParams.get('events') || undefined,
    };

    const response = await getFilteredProjects(options);

    return paginatedResponse(response.projects, {
      page: response.page,
      pageSize: response.pageSize,
      total: response.total,
    });
  },
  { auth: true },
);

export const POST = withApi(
  async (req: NextRequest, { session }) => {
    const body = await req.json();

    // Ensure the authenticated user is added as a member
    const members = body.members || [];
    const userIsMember = members.some((m: any) => m.user_id === session.user.id);

    if (!userIsMember) {
      members.push({
        user_id: session.user.id,
        role: 'Member',
        status: 'Confirmed',
      });
    }

    const newProject = await createProject({
      ...body,
      members,
    });

    return successResponse(newProject, 201);
  },
  { auth: true },
);
