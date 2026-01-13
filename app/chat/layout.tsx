'use client';

import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { WalletProvider } from '@/components/toolbox/providers/WalletProvider';

/**
 * Custom layout for chat page - fullscreen without footer or standard navigation
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <WalletProvider>
        <div className="fixed inset-0 bg-background overflow-hidden">
          {children}
        </div>
      </WalletProvider>
    </SessionProvider>
  );
}
