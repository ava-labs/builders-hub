import { describe, expect, it, vi } from 'vitest';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const nav = vi.hoisted(() => ({ pathname: '/academy/avalanche-l1/erc20-bridge' }));
const media = vi.hoisted(() => ({ drawer: false as boolean | null, query: null as string | null }));
const layout = vi.hoisted(() => ({ sidebar: null as null | { tabs?: unknown; banner?: unknown } }));

vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
vi.mock('fumadocs-core/utils/use-media-query', () => ({
  useMediaQuery: (query: string) => {
    media.query = query;
    return media.drawer;
  },
}));
vi.mock('fumadocs-ui/layouts/notebook', () => ({
  DocsLayout: ({ sidebar, children }: { sidebar: { tabs?: unknown; banner?: unknown }; children: ReactNode }) => {
    layout.sidebar = sidebar;
    return children;
  },
}));
vi.mock('@/components/navigation/navbar-dropdown-injector', () => ({ NavbarDropdownInjector: () => null }));
vi.mock('@/components/navigation/force-mobile-sidebar', () => ({ ForceMobileSidebar: () => null }));
vi.mock('@/components/navigation/docs-navbar-toggle', () => ({ DocsNavbarToggle: () => null }));
vi.mock('@/components/ui/decorative-grid', () => ({ DecorativeGrid: () => null }));

import { AcademyDocsLayoutWrapper } from '@/app/academy/layout-wrapper.client';

const EMPTY = { name: 'Academy', children: [] };
const renderLayout = (pathname: string, drawer: boolean | null) => {
  nav.pathname = pathname;
  media.drawer = drawer;
  return renderToStaticMarkup(
    createElement(AcademyDocsLayoutWrapper, {
      defaultTree: EMPTY,
      avalancheTree: EMPTY,
      blockchainTree: EMPTY,
      team1Tree: EMPTY,
      children: createElement('p', null, 'COURSE_PAGE'),
    }),
  );
};

describe('the course page layout', () => {
  it('mounts the part sub-nav before the docs layout', () => {
    const html = renderLayout('/academy/avalanche-l1/erc20-bridge', false);
    expect(html.indexOf('id="academy-subnav"')).toBeGreaterThan(-1);
    expect(html.indexOf('id="academy-subnav"')).toBeLessThan(html.indexOf('COURSE_PAGE'));
  });

  it('gives the desktop sidebar no course dropdown and no course title', () => {
    renderLayout('/academy/avalanche-l1/erc20-bridge/02-intro/01-intro', false);
    expect(layout.sidebar?.tabs).toBe(false);
    expect(layout.sidebar?.banner).toBeUndefined();
  });

  it("lists the current part's courses in the drawer below 1024 px, each with its course icon", () => {
    renderLayout('/academy/avalanche-l1/erc20-bridge/02-intro/01-intro', true);
    // ForceMobileSidebar's drawer breakpoint (components/navigation/force-mobile-sidebar.tsx).
    expect(media.query).toBe('(max-width: 1023px)');
    const tabs = layout.sidebar?.tabs as { title: string; icon: ReactElement; description: ReactElement; url: string }[];
    // At the docs config's icon size (components/navigation/docs-nav-config.tsx:35): fumadocs' option box does not size
    // the icons of a tabs array.
    const svgClass = (icon: ReactElement) => renderToStaticMarkup(icon).match(/^<svg [^>]*class="([^"]*)"/)?.[1];
    expect(tabs.map((tab) => ({ ...tab, icon: svgClass(tab.icon), description: renderToStaticMarkup(tab.description) }))).toEqual([
      { title: 'Interchain Messaging', icon: 'lucide lucide-send-horizontal w-5 h-5', description: '<span data-academy="docs" class="text-ac-ink-3">30 lessons · 2 h</span>', url: '/academy/avalanche-l1/interchain-messaging' },
      { title: 'ERC20 Bridge', icon: 'lucide lucide-arrow-left-right w-5 h-5', description: '<span data-academy="docs" class="text-ac-ink-3">21 lessons · 2 h</span>', url: '/academy/avalanche-l1/erc20-bridge' },
      { title: 'Native Token Bridge', icon: 'lucide lucide-arrow-left-right w-5 h-5', description: '<span data-academy="docs" class="text-ac-ink-3">22 lessons · 2 h</span>', url: '/academy/avalanche-l1/native-token-bridge' },
    ]);
  });

  it('leaves a Team1 course its default course dropdown and no heading, at every width', () => {
    renderLayout('/academy/team1/team1-fundamentals', true);
    expect(layout.sidebar?.tabs).toBeUndefined();
    expect(layout.sidebar?.banner).toBeUndefined();
    renderLayout('/academy/team1/team1-fundamentals', false);
    expect(layout.sidebar?.tabs).toBeUndefined();
    expect(layout.sidebar?.banner).toBeUndefined();
  });

  it('keeps no dropdown on a course of the 13 before the media query answers', () => {
    renderLayout('/academy/avalanche-l1/erc20-bridge', null);
    expect(layout.sidebar?.tabs).toBe(false);
  });
});
