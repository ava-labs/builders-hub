'use client';

import { DocsLayout, type DocsLayoutProps } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { DocsSubNav } from '@/components/navigation/docs-subnav';
import { DocsNavbarToggle } from '@/components/navigation/docs-navbar-toggle';
import { ForceMobileSidebar } from '@/components/navigation/force-mobile-sidebar';
import { NavbarDropdownInjector } from '@/components/navigation/navbar-dropdown-injector';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  documentationOptions,
  apiReferenceOptions,
  nodesOptions,
  toolingOptions,
} from '@/components/navigation/docs-nav-config';
import { DecorativeGrid } from '@/components/ui/decorative-grid';

interface DocsLayoutWrapperProps {
  children: ReactNode;
  documentationTree: any;
  apiReferenceTree: any;
  rpcsTree: any;
  toolingTree: any;
  acpsTree: any;
}

export function DocsLayoutWrapper({
  children,
  documentationTree,
  apiReferenceTree,
  rpcsTree,
  toolingTree,
  acpsTree,
}: DocsLayoutWrapperProps) {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  // Add data attribute to body for CSS targeting
  useEffect(() => {
    // Set layout attribute for scoping styles
    if (pathname.startsWith('/docs')) {
      document.body.setAttribute('data-layout', 'docs');
    } else {
      document.body.removeAttribute('data-layout');
    }

    if (pathname.startsWith('/docs/tooling')) {
      document.body.setAttribute('data-docs-section', 'tooling');
    } else if (pathname.startsWith('/docs/acps')) {
      document.body.setAttribute('data-docs-section', 'acps');
    } else if (pathname.startsWith('/docs/api-reference')) {
      document.body.setAttribute('data-docs-section', 'api-reference');
    } else if (pathname.startsWith('/docs/rpcs') || pathname.startsWith('/docs/nodes')) {
      document.body.setAttribute('data-docs-section', 'nodes');
    } else if (pathname.startsWith('/docs')) {
      document.body.setAttribute('data-docs-section', 'documentation');
    }

    return () => {
      document.body.removeAttribute('data-docs-section');
      document.body.removeAttribute('data-layout');
    };
  }, [pathname]);

  // Determine which section we're in and get the appropriate tree
  let pageTree;
  let sidebarOptions: any = {};

  if (pathname.startsWith('/docs/api-reference')) {
    pageTree = apiReferenceTree;
    sidebarOptions = {
      tabs: apiReferenceOptions,
    };
  } else if (pathname.startsWith('/docs/rpcs') || pathname.startsWith('/docs/nodes')) {
    pageTree = rpcsTree;
    sidebarOptions = {
      tabs: nodesOptions,
    };
  } else if (pathname.startsWith('/docs/tooling')) {
    pageTree = toolingTree;
    sidebarOptions = {
      tabs: toolingOptions,
    };
  } else if (pathname.startsWith('/docs/acps')) {
    pageTree = acpsTree;
    // No hamburger menu for ACPs - explicitly disable tabs
    sidebarOptions = {
      tabs: false,
    };
  } else {
    pageTree = documentationTree;
    sidebarOptions = {
      tabs: documentationOptions,
    };
  }

  const docsOptions: DocsLayoutProps = {
    tree: pageTree,
    nav: {
      enabled: false,
    },
    // Disable fumadocs search toggle - we use our own search in the main header
    searchToggle: {
      enabled: false,
    },
    // Disable fumadocs theme switch - we use our own in the main header
    themeSwitch: {
      enabled: false,
    },
    sidebar: {
      tabs: isMobile ? sidebarOptions.tabs : false,
      side: 'left', // Open sidebar from left on mobile
    } as any,
  };

  return (
    <div data-route-layout="docs">
      <NavbarDropdownInjector />
      <ForceMobileSidebar />
      <DocsNavbarToggle />
      <DocsSubNav />
      <DocsLayout {...docsOptions}>
      <DecorativeGrid />
      {children}
    </DocsLayout>
    </div>
  );
}
