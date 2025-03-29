'use client';
import type { ReactNode } from 'react';

export function Body({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
  <div>
    {children}
    </div>
);
}