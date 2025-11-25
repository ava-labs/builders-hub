'use client';

import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { ActiveNavHighlighter } from '@/components/navigation/active-nav-highlighter';
import { useDynamicBlogMenu } from '@/components/navigation/dynamic-blog-menu';

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
      <HomeLayout {...updatedOptions}>{children}</HomeLayout>
    </>
  );
}

