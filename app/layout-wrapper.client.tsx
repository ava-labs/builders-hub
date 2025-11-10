'use client';

import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { ActiveNavHighlighter } from '@/components/navigation/active-nav-highlighter';

interface LayoutWrapperProps {
  children: ReactNode;
  baseOptions: BaseLayoutProps;
}

export function LayoutWrapper({ children, baseOptions }: LayoutWrapperProps) {
  return (
    <>
      <ActiveNavHighlighter />
      <HomeLayout {...baseOptions}>{children}</HomeLayout>
    </>
  );
}

