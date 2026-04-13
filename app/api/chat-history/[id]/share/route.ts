import type { NextRequest } from 'next/server';
import { z } from 'zod';
import * as crypto from 'crypto';
import { withApi } from '@/lib/api/with-api';
import { successResponse, noContentResponse } from '@/lib/api/response';
import { assertOwnership } from '@/lib/api/ownership';
import { validateBody } from '@/lib/api/validate';
import { prisma } from '@/prisma/prisma';

const shareSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).default(7),
});

function generateShareToken(): string {
  return crypto.randomBytes(18).toString('base64url');
}

// POST /api/chat-history/[id]/share - Enable sharing for a conversation
export const POST = withApi(
  async (req: NextRequest, { session, params }) => {
    const { expiresInDays } = await validateBody(req, shareSchema);

    const conversation = await assertOwnership<{
      id: string;
      is_shared: boolean;
      share_token: string | null;
      shared_at: Date | null;
      share_expires_at: Date | null;
      view_count: number;
    }>(prisma.chatConversation, params.id, session.user.id);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://build.avax.network';

    // If already shared, return existing share info
    if (conversation.is_shared && conversation.share_token) {
      return successResponse({
        shareToken: conversation.share_token,
        shareUrl: `${baseUrl}/chat/share/${conversation.share_token}`,
        sharedAt: conversation.shared_at,
        expiresAt: conversation.share_expires_at,
        viewCount: conversation.view_count,
      });
    }

    // Generate new share token and enable sharing
    const shareToken = generateShareToken();
    const sharedAt = new Date();
    const expiresAt = new Date(sharedAt.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    const updated = await prisma.chatConversation.update({
      where: { id: params.id },
      data: {
        is_shared: true,
        share_token: shareToken,
        shared_at: sharedAt,
        share_expires_at: expiresAt,
      },
    });

    return successResponse(
      {
        shareToken: updated.share_token,
        shareUrl: `${baseUrl}/chat/share/${updated.share_token}`,
        sharedAt: updated.shared_at,
        expiresAt: updated.share_expires_at,
        viewCount: updated.view_count,
      },
      201,
    );
  },
  { auth: true },
);

// DELETE /api/chat-history/[id]/share - Revoke sharing for a conversation
export const DELETE = withApi(
  async (_req, { session, params }) => {
    await assertOwnership(prisma.chatConversation, params.id, session.user.id);

    await prisma.chatConversation.update({
      where: { id: params.id },
      data: {
        is_shared: false,
        share_token: null,
        shared_at: null,
        share_expires_at: null,
        view_count: 0,
      },
    });

    return noContentResponse();
  },
  { auth: true },
);
