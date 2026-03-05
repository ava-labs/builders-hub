'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { WalletProvider } from '@/components/toolbox/providers/WalletProvider';
import { baseOptions } from '@/app/layout.config';
import { LayoutWrapper } from '@/app/layout-wrapper.client';
import { NavbarDropdownInjector } from '@/components/navigation/navbar-dropdown-injector';
import { TrackNewUser } from '@/components/analytics/TrackNewUser';
import { AutoLoginModalTrigger } from '@/components/login/AutoLoginModalTrigger';
import { LoginModalWrapper } from '@/components/login/LoginModalWrapper';

/**
 * Custom layout for chat pages
 * - /chat: fullscreen layout below the navbar (no scrolling, app-like)
 * - /chat/share/*: normal scrollable layout with navbar
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Share pages need normal scrolling, not fixed positioning
  const isSharePage = pathname.startsWith('/chat/share');

  return (
    <SessionProvider>
      <TrackNewUser />
      <NavbarDropdownInjector />
      <WalletProvider>
        <LayoutWrapper baseOptions={baseOptions}>
          {isSharePage ? (
            // Share pages: normal scrollable layout
            <div className="min-h-screen bg-background">
              {children}
            </div>
          ) : (
            // Main chat: fills viewport below the banner + sticky navbar
            <div className="h-[calc(100dvh-3.5rem-var(--fd-banner-height,0px))] overflow-hidden bg-background">
              {children}
            </div>
          )}
        </LayoutWrapper>
        <AutoLoginModalTrigger />
        <LoginModalWrapper />
      </WalletProvider>
    </SessionProvider>
  );
}
