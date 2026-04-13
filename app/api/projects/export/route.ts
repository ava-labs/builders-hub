import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { NotFoundError } from '@/lib/api/errors';
import { exportShowcase } from '@/server/services/exportShowcase';

// schema: not applicable — returns binary Excel buffer, not JSON
export const POST = withApi(
  async (req: NextRequest) => {
    const body = await req.json();
    const buffer = await exportShowcase(body);

    if (!buffer) {
      throw new NotFoundError('No projects found');
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  },
  { auth: true, roles: ['devrel'] },
);
