import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SharedChatView } from '@/components/chat/shared-chat-view';
import { prisma } from '@/prisma/prisma';
import Link from 'next/link';
import { Clock, AlertCircle } from 'lucide-react';

// Force dynamic rendering to ensure fresh data for shared links
// This prevents caching issues when a share link is first created
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ token: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;

  try {
    const conversation = await prisma.chatConversation.findUnique({
      where: { share_token: token },
      select: {
        title: true,
        is_shared: true,
        share_expires_at: true,
      },
    });

    if (!conversation || !conversation.is_shared) {
      return {
        title: 'Shared Chat Not Found | Avalanche AI',
        description: 'This shared conversation could not be found.',
      };
    }

    // Check expiration
    if (conversation.share_expires_at && conversation.share_expires_at < new Date()) {
      return {
        title: 'Shared Chat Expired | Avalanche AI',
        description: 'This shared conversation link has expired.',
      };
    }

    return {
      title: `${conversation.title} | Avalanche AI`,
      description: `Shared conversation with Avalanche AI: ${conversation.title}`,
      openGraph: {
        title: `${conversation.title} | Avalanche AI`,
        description: `Shared conversation with Avalanche AI`,
        type: 'article',
        siteName: 'Avalanche Builder Hub',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${conversation.title} | Avalanche AI`,
        description: `Shared conversation with Avalanche AI`,
      },
    };
  } catch {
    return {
      title: 'Shared Chat | Avalanche AI',
      description: 'View a shared conversation with Avalanche AI',
    };
  }
}

// Error states component
function ErrorState({
  type,
}: {
  type: 'not-found' | 'expired';
}) {
  const isExpired = type === 'expired';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          {isExpired ? (
            <Clock className="w-8 h-8 text-amber-500" />
          ) : (
            <AlertCircle className="w-8 h-8 text-zinc-400" />
          )}
        </div>

        <h1 className="text-2xl font-semibold mb-2">
          {isExpired ? 'Link Expired' : 'Conversation Not Found'}
        </h1>

        <p className="text-muted-foreground mb-6">
          {isExpired
            ? 'This shared conversation link has expired. The owner may have stopped sharing or the link reached its expiration date.'
            : 'This shared conversation could not be found. It may have been deleted or the link is incorrect.'}
        </p>

        <Link
          href="/chat"
          className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
        >
          Start your own chat
        </Link>
      </div>
    </div>
  );
}

export default async function SharedChatPage({ params }: Props) {
  const { token } = await params;

  if (!token || token.length < 10) {
    notFound();
  }

  // Fetch the conversation from database
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

  // Not found
  if (!conversation || !conversation.is_shared) {
    return <ErrorState type="not-found" />;
  }

  // Expired
  if (conversation.share_expires_at && conversation.share_expires_at < new Date()) {
    return <ErrorState type="expired" />;
  }

  // Increment view count (fire and forget, don't await)
  prisma.chatConversation.update({
    where: { id: conversation.id },
    data: { view_count: { increment: 1 } },
  }).catch(console.error);

  // Determine creator info based on privacy
  const creator = conversation.user && conversation.user.profile_privacy !== 'private'
    ? { name: conversation.user.name, image: conversation.user.image }
    : null;

  // Transform to expected format
  const sharedConversation = {
    id: conversation.id,
    title: conversation.title,
    messages: conversation.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      created_at: m.created_at.toISOString(),
    })),
    sharedAt: conversation.shared_at?.toISOString() || new Date().toISOString(),
    expiresAt: conversation.share_expires_at?.toISOString() || null,
    viewCount: conversation.view_count + 1, // Include current view
    creator,
  };

  return <SharedChatView conversation={sharedConversation} />;
}
