'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { WalletProvider } from '@/components/toolbox/providers/WalletProvider';

/**
 * Custom layout for chat pages
 * - /chat: fullscreen fixed layout (no scrolling, app-like)
 * - /chat/share/*: normal scrollable layout
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Share pages need normal scrolling, not fixed positioning
  const isSharePage = pathname.startsWith('/chat/share');

  return (
    <SessionProvider>
      <WalletProvider>
        {isSharePage ? (
          // Share pages: normal scrollable layout
          <div className="min-h-screen bg-background">
            {children}
          </div>
        ) : (
          // Main chat: fullscreen fixed layout
          <div className="fixed inset-0 bg-background overflow-hidden">
            {children}
          </div>
        )}
      </WalletProvider>
    </SessionProvider>
  );
}
