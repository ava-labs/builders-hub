import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, ConflictError, NotFoundError } from '@/lib/api/errors';
import { prisma } from '@/prisma/prisma';

const favoriteSchema = z.object({
  playgroundId: z.string().min(1, 'Playground ID is required'),
});

// ---------------------------------------------------------------------------
// POST /api/playground/favorite
// ---------------------------------------------------------------------------

export const POST = withApi<z.infer<typeof favoriteSchema>>(
  async (_req, { session, body }) => {
    // Verify playground exists and is accessible
    const playground = await prisma.statsPlayground.findFirst({
      where: {
        id: body.playgroundId,
        OR: [{ user_id: session.user.id }, { is_public: true }],
      },
    });

    if (!playground) {
      throw new NotFoundError('Playground');
    }

    // Check for existing favorite
    const existing = await prisma.statsPlaygroundFavorite.findUnique({
      where: {
        playground_id_user_id: {
          playground_id: body.playgroundId,
          user_id: session.user.id,
        },
      },
    });

    if (existing) {
      throw new ConflictError('Playground already favorited');
    }

    await prisma.statsPlaygroundFavorite.create({
      data: {
        playground_id: body.playgroundId,
        user_id: session.user.id,
      },
    });

    const favoriteCount = await prisma.statsPlaygroundFavorite.count({
      where: { playground_id: body.playgroundId },
    });

    return successResponse({ favorite_count: favoriteCount }, 201);
  },
  { auth: true, schema: favoriteSchema },
);

// ---------------------------------------------------------------------------
// DELETE /api/playground/favorite
// ---------------------------------------------------------------------------

export const DELETE = withApi(
  async (req: NextRequest, { session }) => {
    const playgroundId = req.nextUrl.searchParams.get('playgroundId');
    if (!playgroundId) {
      throw new BadRequestError('Playground ID is required');
    }

    await prisma.statsPlaygroundFavorite.deleteMany({
      where: {
        playground_id: playgroundId,
        user_id: session.user.id,
      },
    });

    const favoriteCount = await prisma.statsPlaygroundFavorite.count({
      where: { playground_id: playgroundId },
    });

    return successResponse({ favorite_count: favoriteCount });
  },
  { auth: true },
);
