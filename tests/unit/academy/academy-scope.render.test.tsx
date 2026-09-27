import { describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const nav = vi.hoisted(() => ({ pathname: '/academy' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

// Children that need a session, a browser or fumadocs' providers are stubbed; this file
// tests the two scope roots only.
vi.mock('@/components/academy/shared/academy-learning-path', () => ({ AcademyLearningPath: () => 'LEARNING_PATH' }));
vi.mock('fumadocs-ui/layouts/notebook', () => ({ DocsLayout: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/components/navigation/navbar-dropdown-injector', () => ({ NavbarDropdownInjector: () => null }));
vi.mock('@/components/navigation/force-mobile-sidebar', () => ({ ForceMobileSidebar: () => null }));
vi.mock('@/components/navigation/docs-navbar-toggle', () => ({ DocsNavbarToggle: () => null }));
vi.mock('@/components/ui/decorative-grid', () => ({ DecorativeGrid: () => null }));

import { AcademyLayout } from '@/components/academy/shared/academy-layout';
import { AcademyDocsLayoutWrapper } from '@/app/academy/layout-wrapper.client';
import { avalancheDeveloperAcademyLandingPageConfig } from '@/app/(home)/academy/avalanche-l1/config';

/** The first opening tag of the markup. */
const firstTag = (html: string) => html.slice(0, html.indexOf('>') + 1);

describe('Academy scope roots', () => {
  it('puts data-academy="landing" on the element that wraps the whole landing', () => {
    nav.pathname = '/academy';
    const html = renderToStaticMarkup(createElement(AcademyLayout, { config: avalancheDeveloperAcademyLandingPageConfig, courseStats: {} }));
    const tag = firstTag(html);
    const name = tag.slice(1).split(/[\s>]/)[0];
    expect(tag).toContain('data-academy="landing"');
    expect(html.endsWith(`</${name}>`)).toBe(true);
    expect(html).toContain('LEARNING_PATH');
    expect(html.match(/data-academy=/g)).toHaveLength(1);
  });

  it('puts data-academy="docs" on the course page root and keeps data-route-layout', () => {
    nav.pathname = '/academy/avalanche-l1/avalanche-fundamentals';
    const tree = { name: 'Academy', children: [] };
    const html = renderToStaticMarkup(
      createElement(AcademyDocsLayoutWrapper, {
        defaultTree: tree,
        avalancheTree: tree,
        blockchainTree: tree,
        entrepreneurTree: tree,
        team1Tree: tree,
        children: createElement('p', null, 'COURSE_PAGE'),
      }),
    );
    const tag = firstTag(html);
    expect(tag).toContain('data-route-layout="academy"');
    expect(tag).toContain('data-academy="docs"');
    expect(html.endsWith('</div>')).toBe(true);
    expect(html).toContain('<p>COURSE_PAGE</p>');
    expect(html.match(/data-academy=/g)).toHaveLength(1);
  });
});
