'use client';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { SessionProvider } from 'next-auth/react';

export function Body({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <SessionProvider>
      {children}
      <Toaster position="bottom-right" richColors expand visibleToasts={3} />
    </SessionProvider>
  );
}
