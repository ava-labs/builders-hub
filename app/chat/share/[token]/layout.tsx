'use client';

import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';

/**
 * Layout for shared chat pages - allows normal scrolling (unlike main chat layout)
 */
export default function SharedChatLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-background overflow-y-auto">
        {children}
      </div>
    </SessionProvider>
  );
}
