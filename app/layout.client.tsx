'use client';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

export function Body({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <>
      {children}
      <Toaster position="bottom-right" richColors expand={true} visibleToasts={5} />
    </>
  );
}