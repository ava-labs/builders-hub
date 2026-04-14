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
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={false}>
      {children}
      <Toaster position="bottom-right" richColors expand={true} visibleToasts={5} />
    </SessionProvider>
  );
}