'use client';

import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { useSession } from 'next-auth/react';
import { ActiveNavHighlighter } from '@/components/navigation/active-nav-highlighter';
import { hasPermission } from '@/lib/auth/rolePermissions';

interface LayoutWrapperProps {
  children: ReactNode;
  baseOptions: BaseLayoutProps;
}

export function LayoutWrapper({ children, baseOptions }: LayoutWrapperProps) {
  const { data: session } = useSession();
  const canSeeTeam1 = hasPermission(session?.user?.custom_attributes, { resource: "academy:team1", action: "read" });

  // Gate Team1 Academy.
  const updatedOptions = {
    ...baseOptions,
    links: baseOptions.links?.map(link => {
      if (
        !canSeeTeam1 &&
        link &&
        typeof link === 'object' &&
        'text' in link &&
        link.text === 'Academy' &&
        'items' in link &&
        Array.isArray((link as { items?: unknown }).items)
      ) {
        const academyLink = link as typeof link & { items: unknown[] };
        return {
          ...academyLink,
          items: academyLink.items.filter(
            (item) =>
              !(
                item &&
                typeof item === 'object' &&
                'url' in item &&
                (item as { url?: string }).url === '/academy/team1'
              ),
          ),
        };
      }
      return link;
    }),
  };

  return (
    <>
      <ActiveNavHighlighter />
      {/* <CustomCountdownBanner /> */}
      <HomeLayout {...updatedOptions}>{children}</HomeLayout>
    </>
  );
}
