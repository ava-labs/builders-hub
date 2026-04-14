'use client';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { SessionProvider } from 'next-auth/react';

export function Body({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={false}>
      {children}
      {/* Custom wrapper from components/ui/sonner.tsx adds the project's
          theme observer (so toasts match site light/dark) and per-variant
          classNames (tone-colored left border, refined action buttons). */}
      <Toaster position="bottom-right" richColors expand visibleToasts={3} />
    </SessionProvider>
  );
}
