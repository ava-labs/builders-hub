import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { parsePagination } from '@/lib/api/pagination';
import { successResponse, paginatedResponse } from '@/lib/api/response';
import { createHackathon, getFilteredHackathons } from '@/server/services/hackathons';
import type { GetHackathonsOptions } from '@/server/services/hackathons';
import { HackathonStatus } from '@/types/hackathons';
import { getUserById } from '@/server/services/getUser';

// schema: not applicable — POST body is dynamic hackathon creation payload
export const GET = withApi(async (req: NextRequest, { session }) => {
  const { page, pageSize } = parsePagination(req);
  const searchParams = req.nextUrl.searchParams;

  const options: GetHackathonsOptions = {
    page,
    pageSize,
    location: searchParams.get('location') || undefined,
    date: searchParams.get('date') || undefined,
    status: (searchParams.get('status') as HackathonStatus) || undefined,
    search: searchParams.get('search') || undefined,
    event: searchParams.get('event') || undefined,
  };

  const userId = session?.user?.id;

  if (userId) {
    const user = await getUserById(userId);

    if (user) {
      const customAttributes: string[] = user.custom_attributes || [];
      const isDevrel = customAttributes.includes('devrel');
      const isTeam1Admin = customAttributes.includes('team1-admin');
      const isHackathonCreator = customAttributes.includes('hackathonCreator');

      options.created_by = isDevrel ? undefined : userId;
      if (!isDevrel) {
        options.cohost_email = user.email || undefined;
      }
      options.include_private = isDevrel || isTeam1Admin || isHackathonCreator;
    } else {
      options.include_private = false;
    }
  } else {
    options.include_private = false;
  }

  const response = await getFilteredHackathons(options);

  return paginatedResponse(response.hackathons, {
    page: response.page,
    pageSize: response.pageSize,
    total: response.total,
  });
});

export const POST = withApi(
  async (req: NextRequest) => {
    const body = await req.json();
    const newHackathon = await createHackathon(body);

    return successResponse(newHackathon, 201);
  },
  { auth: true, roles: ['devrel'] },
);
