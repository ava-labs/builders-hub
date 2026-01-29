import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';

// GET /api/chat/share/[token] - Fetch shared conversation (public, no auth required)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length < 10) {
      return NextResponse.json({ error: 'Invalid share token' }, { status: 400 });
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
      return NextResponse.json(
        { error: 'Shared conversation not found' },
        { status: 404 }
      );
    }

    // Check if sharing is enabled
    if (!conversation.is_shared) {
      return NextResponse.json(
        { error: 'This conversation is no longer shared' },
        { status: 404 }
      );
    }

    // Check if share link has expired
    if (conversation.share_expires_at && conversation.share_expires_at < new Date()) {
      return NextResponse.json(
        { error: 'This share link has expired', code: 'EXPIRED' },
        { status: 410 } // 410 Gone - indicates resource was intentionally removed
      );
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

    return NextResponse.json({
      id: conversation.id,
      title: conversation.title,
      messages: conversation.messages,
      sharedAt: conversation.shared_at,
      expiresAt: conversation.share_expires_at,
      viewCount: conversation.view_count + 1, // Include the current view
      creator,
    });
  } catch (error) {
    console.error('Error fetching shared conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
