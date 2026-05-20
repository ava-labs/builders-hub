'use client';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { SessionProvider } from 'next-auth/react';

/** Seconds between background session polls (must stay below session.maxAge). */
const SESSION_REFETCH_INTERVAL_SECONDS = 60 * 60;

export function Body({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <SessionProvider
      refetchInterval={SESSION_REFETCH_INTERVAL_SECONDS}
      refetchOnWindowFocus={false}
    >
      {children}
      {/* Custom wrapper from components/ui/sonner.tsx adds the project's
          theme observer (so toasts match site light/dark) and per-variant
          classNames (tone-colored left border, refined action buttons). */}
      <Toaster position="bottom-right" richColors expand visibleToasts={3} />
    </SessionProvider>
  );
}
