import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { getPopularSkills } from '@/server/services/profile/profile.service';

export const GET = withApi(
  async (_req: NextRequest) => {
    const popularSkills = await getPopularSkills();
    return NextResponse.json(
      { success: true, data: popularSkills },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
  },
  { auth: true },
);
