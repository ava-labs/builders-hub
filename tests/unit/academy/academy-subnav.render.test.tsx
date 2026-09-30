import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const nav = vi.hoisted(() => ({ pathname: '/academy/avalanche-l1/avalanche-fundamentals' }));
const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => viewport.mobile }));

import { AcademySubNav, partMenu } from '@/components/academy/course/academy-subnav';

const render = (pathname: string) => {
  nav.pathname = pathname;
  return renderToStaticMarkup(createElement(AcademySubNav));
};
const anchors = (html: string) => html.split('<a ').slice(1).map((segment) => `<a ${segment}`);
const label = (a: string) => a.replace(/<[^>]+>/g, '');

describe('AcademySubNav', () => {
  it('lists the five parts in order, each opening on its first course', () => {
    const links = anchors(render('/academy/avalanche-l1/avalanche-fundamentals'));
    expect(links.map(label)).toEqual(['Fundamentals', 'L1 Development', 'Interoperability', 'VM Customization', 'Applications']);
    expect(links.map((a) => a.match(/href="([^"]*)"/)?.[1])).toEqual([
      '/academy/avalanche-l1/avalanche-fundamentals',
      '/academy/avalanche-l1/permissioned-l1s',
      '/academy/avalanche-l1/interchain-messaging',
      '/academy/avalanche-l1/customizing-evm',
      '/academy/blockchain/solidity-foundry',
    ]);
  });

  it.each([
    ['/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1', 'Fundamentals'],
    ['/academy/blockchain/blockchain-fundamentals', 'Fundamentals'],
    ['/academy/avalanche-l1/l1-native-tokenomics/02-custom-tokens/02-custom-native-vs-erc20-native', 'L1 Development'],
    ['/academy/avalanche-l1/native-token-bridge', 'Interoperability'],
    ['/academy/avalanche-l1/access-restriction', 'VM Customization'],
    ['/academy/blockchain/encrypted-erc', 'Applications'],
  ])('marks the part of %s: %s', (pathname, part) => {
    const current = anchors(render(pathname)).filter((a) => a.includes('data-active="true"'));
    expect(current.map(label)).toEqual([part]);
    expect(current[0]).toContain('aria-current="true"');
  });

  it('marks no part outside the 13 courses', () => {
    expect(render('/academy/team1/team1-fundamentals')).not.toContain('data-active');
  });

  it('keeps the docs bar: fixed under the navbar, its classes, a navigation landmark that is not a nav element', () => {
    const html = render('/academy/avalanche-l1/avalanche-fundamentals');
    expect(html).toMatch(/^<div id="academy-subnav" role="navigation" aria-label="Academy parts" class="[^"]*\bfixed\b[^"]*"/);
    expect(html).toContain('style="top:calc(var(--fd-banner-height, 0px) + 3.5rem)"');
    expect(html).toContain('bg-white/85');
    // --ac-subnav-height (49px, app/academy/critical.css) is the row's h-12 plus the bar's 1 px rule. Whole class
    // words, so border-b-2 or min-h-12 cannot stand in for them.
    const [barClasses, rowClasses] = (html.match(/<[^>]+>/g) ?? [])
      .slice(0, 2)
      .map((tag) => tag.match(/ class="([^"]*)"/)?.[1].split(/\s+/) ?? []);
    expect(barClasses).toContain('border-b');
    expect(rowClasses).toContain('h-12');
    expect(anchors(html).every((a) => a.includes('docs-subnav-link'))).toBe(true);
    // On desktop each part opens a hover card (Radix marks the trigger); none is open at server render.
    expect(anchors(html).every((a) => a.includes('data-state="closed"'))).toBe(true);
  });

  it('below 768 px shows the five parts as plain links: no chevron, no hover card', () => {
    viewport.mobile = true;
    try {
      const html = render('/academy/avalanche-l1/avalanche-fundamentals');
      expect(anchors(html).map((a) => a.match(/href="([^"]*)"/)?.[1])).toEqual([
        '/academy/avalanche-l1/avalanche-fundamentals',
        '/academy/avalanche-l1/permissioned-l1s',
        '/academy/avalanche-l1/interchain-messaging',
        '/academy/avalanche-l1/customizing-evm',
        '/academy/blockchain/solidity-foundry',
      ]);
      expect(html).not.toContain('<svg');
      expect(html).not.toContain('data-state');
    } finally {
      viewport.mobile = false;
    }
  });
});

describe('partMenu', () => {
  it("lists each part's courses with lessons and hours, the landing's names", () => {
    expect(partMenu('interoperability')).toEqual([
      { title: 'Interchain Messaging', url: '/academy/avalanche-l1/interchain-messaging', line: '30 lessons · 2 h' },
      { title: 'ERC20 Bridge', url: '/academy/avalanche-l1/erc20-bridge', line: '21 lessons · 2 h' },
      { title: 'Native Token Bridge', url: '/academy/avalanche-l1/native-token-bridge', line: '22 lessons · 2 h' },
    ]);
    expect(partMenu('applications').map((item) => item.title)).toEqual(['Intro to Solidity', 'x402 Payments', 'Encrypted ERC']);
  });
});
