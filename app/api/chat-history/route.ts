import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { prisma } from '@/prisma/prisma';

const chatMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

const postSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  messages: z.array(chatMessageSchema).min(1, 'At least one message is required'),
});

// GET /api/chat-history - Get user's chat conversations
export const GET = withApi(
  async (_req, { session }) => {
    const conversations = await prisma.chatConversation.findMany({
      where: { user_id: session.user.id },
      orderBy: { updated_at: 'desc' },
      include: {
        messages: {
          orderBy: { created_at: 'asc' },
        },
      },
      take: 50,
    });

    return successResponse(conversations);
  },
  { auth: true },
);

// POST /api/chat-history - Create or update a conversation
export const POST = withApi<z.infer<typeof postSchema>>(
  async (_req, { session, body }) => {
    const { id, title, messages } = body;

    // If ID provided, update existing conversation
    if (id) {
      const existing = await prisma.chatConversation.findFirst({
        where: { id, user_id: session.user.id },
      });

      if (!existing) {
        throw new NotFoundError('Conversation');
      }

      // Delete old messages and create new ones (simpler than diffing)
      await prisma.chatMessage.deleteMany({
        where: { conversation_id: id },
      });

      const conversation = await prisma.chatConversation.update({
        where: { id },
        data: {
          title,
          messages: {
            create: messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
          },
        },
        include: {
          messages: {
            orderBy: { created_at: 'asc' },
          },
        },
      });

      return successResponse(conversation);
    }

    // Create new conversation
    const conversation = await prisma.chatConversation.create({
      data: {
        user_id: session.user.id,
        title,
        messages: {
          create: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        },
      },
      include: {
        messages: {
          orderBy: { created_at: 'asc' },
        },
      },
    });

    return successResponse(conversation, 201);
  },
  {
    auth: true,
    schema: postSchema,
  },
);
