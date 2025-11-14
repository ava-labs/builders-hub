import type { ReactNode } from 'react';
import { Footer } from '@/components/navigation/footer';
import { baseOptions } from '@/app/layout.config';
import { LayoutWrapper } from '@/app/layout-wrapper.client';

export default function Layout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return <LayoutWrapper baseOptions={baseOptions}>
    {children}
    <Footer />
    </LayoutWrapper>;
}