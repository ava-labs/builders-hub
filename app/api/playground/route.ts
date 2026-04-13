import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { successResponse, noContentResponse } from '@/lib/api/response';
import { AuthError, BadRequestError, NotFoundError } from '@/lib/api/errors';
import { assertOwnership } from '@/lib/api/ownership';
import { prisma } from '@/prisma/prisma';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createPlaygroundSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  isPublic: z.boolean().optional().default(false),
  charts: z.array(z.unknown()).optional().default([]),
  globalStartTime: z.string().nullable().optional().default(null),
  globalEndTime: z.string().nullable().optional().default(null),
});

const updatePlaygroundSchema = z.object({
  id: z.string().min(1, 'Playground ID is required'),
  name: z.string().min(1).optional(),
  isPublic: z.boolean().optional(),
  charts: z.array(z.unknown()).optional(),
  globalStartTime: z.string().nullable().optional(),
  globalEndTime: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePlayground(playground: any, extras?: Record<string, unknown>) {
  const chartsData = playground.charts as any;
  const chartsArray = Array.isArray(chartsData) ? chartsData : chartsData?.charts || [];
  const globalStartTime = Array.isArray(chartsData) ? null : chartsData?.globalStartTime || null;
  const globalEndTime = Array.isArray(chartsData) ? null : chartsData?.globalEndTime || null;

  return {
    ...playground,
    charts: chartsArray,
    globalStartTime,
    globalEndTime,
    view_count: playground.view_count || 0,
    favorites: undefined,
    _count: undefined,
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// GET /api/playground
// ---------------------------------------------------------------------------

export const GET = withApi(async (req: NextRequest, { session }) => {
  const { searchParams } = req.nextUrl;
  const playgroundId = searchParams.get('id');
  const includePublic = searchParams.get('includePublic') === 'true';

  // --- Single playground by ID (public access allowed) ---
  if (playgroundId) {
    const playground = await prisma.statsPlayground.findFirst({
      where: {
        id: playgroundId,
        OR: session?.user ? [{ user_id: session.user.id }, { is_public: true }] : [{ is_public: true }],
      },
      include: {
        favorites: session?.user ? { where: { user_id: session.user.id } } : false,
        _count: { select: { favorites: true } },
        user: {
          select: {
            id: true,
            name: true,
            user_name: true,
            image: true,
            profile_privacy: true,
          },
        },
      },
    });

    if (!playground) {
      throw new NotFoundError('Playground');
    }

    const isOwner = session?.user ? playground.user_id === session.user.id : false;
    const isFavorited = session?.user && playground.favorites ? (playground.favorites as any[]).length > 0 : false;

    return successResponse(
      normalizePlayground(playground, {
        is_owner: isOwner,
        is_favorited: isFavorited,
        favorite_count: playground._count.favorites,
        creator: playground.user
          ? {
              id: playground.user.id,
              name: playground.user.name,
              user_name: playground.user.user_name,
              image: playground.user.image,
              profile_privacy: playground.user.profile_privacy,
            }
          : undefined,
      }),
    );
  }

  // --- List playgrounds (requires auth) ---
  if (!session?.user) {
    throw new AuthError();
  }

  const whereClause = includePublic
    ? { OR: [{ user_id: session.user.id }, { is_public: true }] }
    : { user_id: session.user.id };

  const playgrounds = await prisma.statsPlayground.findMany({
    where: whereClause,
    include: { _count: { select: { favorites: true } } },
    orderBy: { updated_at: 'desc' },
    take: 100,
  });

  return successResponse(playgrounds.map((p) => normalizePlayground(p, { favorite_count: p._count.favorites })));
});

// ---------------------------------------------------------------------------
// POST /api/playground
// ---------------------------------------------------------------------------

export const POST = withApi<z.infer<typeof createPlaygroundSchema>>(
  async (_req, { session, body }) => {
    const chartsData = {
      globalStartTime: body.globalStartTime || null,
      globalEndTime: body.globalEndTime || null,
      charts: body.charts,
    };

    const playground = await prisma.statsPlayground.create({
      data: {
        user_id: session.user.id,
        name: body.name,
        is_public: body.isPublic,
        charts: chartsData as any,
      },
    });

    return successResponse(playground, 201);
  },
  { auth: true, schema: createPlaygroundSchema },
);

// ---------------------------------------------------------------------------
// PUT /api/playground
// ---------------------------------------------------------------------------

export const PUT = withApi<z.infer<typeof updatePlaygroundSchema>>(
  async (_req, { session, body }) => {
    const existing = await assertOwnership<any>(prisma.statsPlayground, body.id, session.user.id);

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.isPublic !== undefined) updateData.is_public = body.isPublic;

    if (body.charts !== undefined || body.globalStartTime !== undefined || body.globalEndTime !== undefined) {
      const existingCharts = existing.charts as any;
      const chartsArray = Array.isArray(existingCharts) ? existingCharts : existingCharts?.charts || [];

      updateData.charts = {
        globalStartTime:
          body.globalStartTime !== undefined ? body.globalStartTime || null : existingCharts?.globalStartTime || null,
        globalEndTime:
          body.globalEndTime !== undefined ? body.globalEndTime || null : existingCharts?.globalEndTime || null,
        charts: body.charts !== undefined ? body.charts : chartsArray,
      } as any;
    }

    const playground = await prisma.statsPlayground.update({
      where: { id: body.id },
      data: updateData,
    });

    return successResponse(playground);
  },
  { auth: true, schema: updatePlaygroundSchema },
);

// ---------------------------------------------------------------------------
// DELETE /api/playground
// ---------------------------------------------------------------------------

export const DELETE = withApi(
  async (req: NextRequest, { session }) => {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      throw new BadRequestError('Playground ID is required');
    }

    await assertOwnership(prisma.statsPlayground, id, session.user.id);

    await prisma.statsPlayground.delete({ where: { id } });

    return noContentResponse();
  },
  { auth: true },
);
