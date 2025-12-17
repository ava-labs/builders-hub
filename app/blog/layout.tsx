"use client";

import { ReactNode } from 'react';
import { Footer } from '@/components/navigation/footer';
import { baseOptions } from '@/app/layout.config';
import { SessionProvider } from 'next-auth/react';
import { LayoutWrapper } from '@/app/layout-wrapper.client';
import { NavbarDropdownInjector } from '@/components/navigation/navbar-dropdown-injector';
import { TrackNewUser } from '@/components/analytics/TrackNewUser';

export default function Layout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <SessionProvider>
      <TrackNewUser />
      <LayoutWrapper baseOptions={baseOptions}>
        <NavbarDropdownInjector />
        {children}
        <Footer />
      </LayoutWrapper>
    </SessionProvider>
  );
}
