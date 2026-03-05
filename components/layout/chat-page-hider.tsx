'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Wrapper that hides its children on embedded chat share pages.
 * The main /chat page shows all global elements (Banner, Privacy Policy, etc.)
 * but share embeds (/chat/share/*) use a minimal layout.
 */
export function HideOnChatPage({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Only hide on share embeds — the main /chat page shows everything
  if (pathname.startsWith('/chat/share')) {
    return null;
  }

  return <>{children}</>;
}
