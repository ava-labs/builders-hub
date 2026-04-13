import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { prisma } from '@/prisma/prisma';

// ---------------------------------------------------------------------------
// POST /api/playground/[id]/view  — Increment view count (rate-limited by IP)
// ---------------------------------------------------------------------------

// withApi: auth intentionally omitted — public view tracking, rate limited
// schema: not applicable — no request body, POST for increment side-effect
export const POST = withApi(
  async (_req: NextRequest, { params }) => {
    const playground = await prisma.statsPlayground.update({
      where: { id: params.id },
      data: { view_count: { increment: 1 } },
      select: { view_count: true },
    });

    return successResponse({ view_count: playground.view_count });
  },
  {
    rateLimit: { windowMs: 60_000, maxRequests: 10, identifier: 'ip' },
  },
);
