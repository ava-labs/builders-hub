'use client';

import { DocsLayout, type DocsLayoutProps } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { NavbarDropdownInjector } from '@/components/navigation/navbar-dropdown-injector';
import { ForceMobileSidebar } from '@/components/navigation/force-mobile-sidebar';
import { DocsNavbarToggle } from '@/components/navigation/docs-navbar-toggle';
import { AcademyLayoutClient } from './layout.client';
import { AcademyBubbleNav } from '@/components/academy/shared/academy-bubble-nav';
import { DecorativeGrid } from '@/components/ui/decorative-grid';

type Tree = DocsLayoutProps['tree'];

interface AcademyDocsLayoutWrapperProps {
    children: ReactNode;
    defaultTree: Tree;
    avalancheTree: Tree;
    blockchainTree: Tree;
    entrepreneurTree: Tree;
    team1Tree: Tree;
}

export function AcademyDocsLayoutWrapper({
    children,
    defaultTree,
    avalancheTree,
    blockchainTree,
    entrepreneurTree,
    team1Tree,
}: AcademyDocsLayoutWrapperProps) {
    const pathname = usePathname();

    const activeTree = useMemo(() => {
        if (pathname.startsWith('/academy/entrepreneur')) {
            return entrepreneurTree ?? defaultTree;
        }
        if (pathname.startsWith('/academy/blockchain')) {
            return blockchainTree ?? defaultTree;
        }
        if (pathname.startsWith('/academy/team1')) {
            return team1Tree ?? defaultTree;
        }
        if (pathname === '/academy' || pathname.startsWith('/academy/avalanche-l1')) {
            return avalancheTree ?? defaultTree;
        }
        return defaultTree;
    }, [pathname, defaultTree, avalancheTree, blockchainTree, entrepreneurTree, team1Tree]);

    const academyOptions: DocsLayoutProps = useMemo(
        () => ({
            tree: activeTree,
            nav: {
                enabled: false,
            },
            sidebar: {
                collapsible: false,
            },
        }),
        [activeTree],
    );

    return (
        <div data-route-layout="academy">
            <NavbarDropdownInjector />
            <ForceMobileSidebar />
            <AcademyLayoutClient />
            <DocsNavbarToggle />
            <AcademyBubbleNav />
            <DocsLayout {...academyOptions}>
                <DecorativeGrid />
                {children}
            </DocsLayout>
        </div>
    );
}

