import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';
import { Footer } from '@/components/navigation/footer';
import { baseOptions } from '@/app/layout.config';

export default function Layout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return <HomeLayout {...baseOptions}>
    {children}
    <Footer />
    </HomeLayout>;
}
