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
      <Toaster position="top-right" richColors expand visibleToasts={3} offset="80px" />
    </>
  );
}