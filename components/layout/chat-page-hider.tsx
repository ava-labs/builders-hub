'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Wrapper that hides its children on /chat and /chat/* pages
 * Used to hide global elements (Banner, Privacy Policy, etc.) on the fullscreen chat experience
 */
export function HideOnChatPage({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Hide on /chat and all /chat/* subpaths (including /chat/share/[token])
  if (pathname === '/chat' || pathname.startsWith('/chat/')) {
    return null;
  }

  return <>{children}</>;
}
