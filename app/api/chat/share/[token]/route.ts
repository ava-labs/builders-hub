import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, NotFoundError } from '@/lib/api/errors';
import { prisma } from '@/prisma/prisma';

// GET /api/chat/share/[token] - Fetch shared conversation (public, no auth required)
export const GET = withApi(async (_req: NextRequest, { params }) => {
  const token = params.token;

  if (!token || token.length < 10) {
    throw new BadRequestError('Invalid share token');
  }

  // Find conversation by share token
  const conversation = await prisma.chatConversation.findUnique({
    where: { share_token: token },
    include: {
      messages: {
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          created_at: true,
        },
      },
      user: {
        select: {
          name: true,
          image: true,
          profile_privacy: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new NotFoundError('Shared conversation');
  }

  // Check if sharing is enabled
  if (!conversation.is_shared) {
    throw new NotFoundError('Shared conversation');
  }

  // Check if share link has expired
  if (conversation.share_expires_at && conversation.share_expires_at < new Date()) {
    throw new BadRequestError('This share link has expired');
  }

  // Atomically increment view count
  await prisma.chatConversation.update({
    where: { id: conversation.id },
    data: { view_count: { increment: 1 } },
  });

  // Determine creator info based on privacy settings
  let creator: { name: string | null; image: string | null } | null = null;
  if (conversation.user && conversation.user.profile_privacy !== 'private') {
    creator = {
      name: conversation.user.name,
      image: conversation.user.image,
    };
  }

  return successResponse({
    id: conversation.id,
    title: conversation.title,
    messages: conversation.messages,
    sharedAt: conversation.shared_at,
    expiresAt: conversation.share_expires_at,
    viewCount: conversation.view_count + 1, // Include the current view
    creator,
  });
});
