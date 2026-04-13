import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { successResponse, noContentResponse } from '@/lib/api/response';
import { assertOwnership } from '@/lib/api/ownership';
import { validateBody } from '@/lib/api/validate';
import { prisma } from '@/prisma/prisma';

const patchSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .transform((v) => v.trim()),
});

// PATCH /api/chat-history/[id] - Rename a conversation
export const PATCH = withApi(
  async (req: NextRequest, { session, params }) => {
    const { title } = await validateBody(req, patchSchema);

    await assertOwnership(prisma.chatConversation, params.id, session.user.id);

    const updated = await prisma.chatConversation.update({
      where: { id: params.id },
      data: { title },
    });

    return successResponse(updated);
  },
  { auth: true },
);

// DELETE /api/chat-history/[id] - Delete a conversation
export const DELETE = withApi(
  async (_req, { session, params }) => {
    await assertOwnership(prisma.chatConversation, params.id, session.user.id);

    await prisma.chatConversation.delete({
      where: { id: params.id },
    });

    return noContentResponse();
  },
  { auth: true },
);
