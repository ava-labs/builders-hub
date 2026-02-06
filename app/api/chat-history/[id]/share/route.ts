import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';
import * as crypto from 'crypto';

// Generate a cryptographically secure, URL-safe token
function generateShareToken(): string {
  // 18 bytes = 24 characters in base64url encoding
  return crypto.randomBytes(18).toString('base64url');
}

// POST /api/chat-history/[id]/share - Enable sharing for a conversation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Parse optional expiration from body
    let expiresInDays = 7; // Default: 7 days
    try {
      const body = await req.json();
      if (body.expiresInDays && typeof body.expiresInDays === 'number') {
        expiresInDays = Math.min(Math.max(body.expiresInDays, 1), 365); // Clamp 1-365 days
      }
    } catch {
      // No body or invalid JSON - use default
    }

    // Verify ownership
    const conversation = await prisma.chatConversation.findFirst({
      where: { id, user_id: session.user.id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // If already shared, return existing share info
    if (conversation.is_shared && conversation.share_token) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://build.avax.network';
      return NextResponse.json({
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
      where: { id },
      data: {
        is_shared: true,
        share_token: shareToken,
        shared_at: sharedAt,
        share_expires_at: expiresAt,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://build.avax.network';
    return NextResponse.json({
      shareToken: updated.share_token,
      shareUrl: `${baseUrl}/chat/share/${updated.share_token}`,
      sharedAt: updated.shared_at,
      expiresAt: updated.share_expires_at,
      viewCount: updated.view_count,
    });
  } catch (error) {
    console.error('Error enabling chat sharing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/chat-history/[id]/share - Revoke sharing for a conversation
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const conversation = await prisma.chatConversation.findFirst({
      where: { id, user_id: session.user.id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Revoke sharing - clear all share fields
    await prisma.chatConversation.update({
      where: { id },
      data: {
        is_shared: false,
        share_token: null,
        shared_at: null,
        share_expires_at: null,
        view_count: 0, // Reset view count on revoke
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking chat sharing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
