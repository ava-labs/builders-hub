import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';
import { z } from 'zod';
import { readJsonBody } from '@/lib/api/json-body';

// GET /api/chat-history - Get user's chat conversations
export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await prisma.chatConversation.findMany({
      where: { user_id: session.user.id },
      orderBy: { updated_at: 'desc' },
      include: {
        messages: {
          orderBy: { created_at: 'asc' },
        },
      },
      // Include sharing fields in response (they're part of the model)
      take: 50, // Limit to last 50 conversations
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Server-side validation constraints for stored messages
const MAX_CONTENT_LENGTH = 100_000; // Max characters per message

// Each message: role must be "user" or "assistant", and content must be a
// string within the size cap. This stops a caller from storing messages with
// an arbitrary role (for example as the assistant on shared pages) and bounds
// stored content size. The id is checked by hand below, so that a wrong id
// keeps its own answer.
const saveBodySchema = z.object({
  id: z.unknown().optional(),
  title: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(MAX_CONTENT_LENGTH),
    })
  ),
});

// POST /api/chat-history - Create or update a conversation
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await readJsonBody(req, saveBodySchema);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    const { id, title, messages } = body;

    // An ID is text. Prisma reads a JSON object in its place as a filter
    // (for example { not: '' }), which matches rows the caller does not own.
    if (id !== undefined && id !== null && typeof id !== 'string') {
      return NextResponse.json({ error: 'Invalid conversation id' }, { status: 400 });
    }

    // If ID provided, update existing conversation
    if (typeof id === 'string' && id) {
      // Verify ownership
      const existing = await prisma.chatConversation.findFirst({
        where: { id, user_id: session.user.id },
      });

      if (!existing) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }

      // Delete old messages and create new ones (simpler than diffing).
      // Both writes use the ID of the row the ownership check returned.
      await prisma.chatMessage.deleteMany({
        where: { conversation_id: existing.id },
      });

      const conversation = await prisma.chatConversation.update({
        where: { id: existing.id },
        data: {
          title,
          messages: {
            create: messages.map((msg: { role: string; content: string }) => ({
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

      return NextResponse.json(conversation);
    }

    // Create new conversation
    const conversation = await prisma.chatConversation.create({
      data: {
        user_id: session.user.id,
        title,
        messages: {
          create: messages.map((msg: { role: string; content: string }) => ({
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

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error saving chat conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
