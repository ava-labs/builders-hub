'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Wrapper that hides its children on the /chat page
 * Used to hide global elements (Chatbot, Banner, etc.) on the fullscreen chat experience
 */
export function HideOnChatPage({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/chat') {
    return null;
  }

  return <>{children}</>;
}
