'use client';

import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { ActiveNavHighlighter } from '@/components/navigation/active-nav-highlighter';
import { useDynamicBlogMenu } from '@/components/navigation/dynamic-blog-menu';
import { CustomCountdownBanner } from '@/components/ui/custom-countdown-banner';

interface LayoutWrapperProps {
  children: ReactNode;
  baseOptions: BaseLayoutProps;
}

export function LayoutWrapper({ children, baseOptions }: LayoutWrapperProps) {
  const dynamicBlogMenu = useDynamicBlogMenu();
  
  // Replace the blog menu with the dynamic one
  const updatedOptions = {
    ...baseOptions,
    links: baseOptions.links?.map(link => {
      if (link && typeof link === 'object' && 'text' in link && link.text === 'Blog') {
        return dynamicBlogMenu;
      }
      return link;
    }),
  };

  return (
    <>
      <ActiveNavHighlighter />
      <CustomCountdownBanner />
      <HomeLayout {...updatedOptions}>{children}</HomeLayout>
    </>
  );
}
