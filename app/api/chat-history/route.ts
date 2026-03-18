import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';

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

// POST /api/chat-history - Create or update a conversation
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, messages } = body;

    if (!title || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Title and messages are required' },
        { status: 400 }
      );
    }

    // If ID provided, update existing conversation
    if (id) {
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

      // Delete old messages and create new ones (simpler than diffing)
      await prisma.chatMessage.deleteMany({
        where: { conversation_id: id },
      });

      const conversation = await prisma.chatConversation.update({
        where: { id },
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
