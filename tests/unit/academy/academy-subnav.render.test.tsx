import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const nav = vi.hoisted(() => ({ pathname: '/academy/avalanche-l1/avalanche-fundamentals' }));
const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => viewport.mobile }));

import { AcademySubNav, PartCourses, partMenu } from '@/components/academy/course/academy-subnav';
import type { AcademyPartId } from '@/components/academy/learning-path-configs/academy.config';
import { academyCourse } from '@/lib/academy/academy-programme';

const render = (pathname: string) => {
  nav.pathname = pathname;
  return renderToStaticMarkup(createElement(AcademySubNav));
};
// A part's hover card list alone: Radix portals the card's content and keeps it closed at server render.
const card = (part: AcademyPartId, currentId?: string) =>
  renderToStaticMarkup(createElement(PartCourses, { items: partMenu(part), current: currentId ? academyCourse(currentId) : null }));
const anchors = (html: string) => html.split('<a ').slice(1).map((segment) => `<a ${segment}`);
const label = (a: string) => a.replace(/<[^>]+>/g, '');
// lucide-react classes its svg `lucide lucide-<icon name>`.
const iconName = (a: string) => a.match(/<svg [^>]*class="lucide (lucide-[a-z0-9-]+)/)?.[1];
const paragraphs = (a: string) => [...a.matchAll(/<p [^>]*>(.*?)<\/p>/g)].map(([, text]) => text.replace(/&#x27;/g, "'"));

describe('AcademySubNav', () => {
  it('lists the five parts in order, each opening on its first course', () => {
    const links = anchors(render('/academy/avalanche-l1/avalanche-fundamentals'));
    expect(links.map(label)).toEqual(['Fundamentals', 'L1 Development', 'Interoperability', 'VM Customization', 'Applications']);
    expect(links.map((a) => a.match(/href="([^"]*)"/)?.[1])).toEqual([
      '/academy/blockchain/blockchain-fundamentals',
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
        '/academy/blockchain/blockchain-fundamentals',
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

describe('PartCourses', () => {
  it("lists a part's courses as the docs card lists a section: each course's icon, title, description, lessons and hours", () => {
    const links = anchors(card('interoperability', 'erc20-bridge'));
    expect(links.map((a) => a.match(/href="([^"]*)"/)?.[1])).toEqual([
      '/academy/avalanche-l1/interchain-messaging',
      '/academy/avalanche-l1/erc20-bridge',
      '/academy/avalanche-l1/native-token-bridge',
    ]);
    // Each course folder's own icon (course-icons.tsx): the two bridges share theirs.
    expect(links.map(iconName)).toEqual(['lucide-send-horizontal', 'lucide-arrow-left-right', 'lucide-arrow-left-right']);
    expect(links.map(paragraphs)).toEqual([
      ['Interchain Messaging', "Build apps leveraging Avalanche's Interchain Messaging", '30 lessons · 2 h'],
      ['ERC20 Bridge', 'Bridge ERC20 tokens between chains using Interchain Token Transfer', '21 lessons · 2 h'],
      ['Native Token Bridge', 'Build a cross-chain L1 with native tokenomics and token bridging', '22 lessons · 2 h'],
    ]);
    expect(links.map((a) => a.includes('aria-current="true"'))).toEqual([false, true, false]);
  });

  it('copies the docs card item class for class, the icon muted and hidden at the docs size', () => {
    // components/navigation/docs-subnav.tsx:118-143, and the icon size of components/navigation/docs-nav-config.tsx.
    const [first] = anchors(card('interoperability'));
    expect([...first.matchAll(/<(a|div|svg|p)\b[^>]* class="([^"]*)"/g)].map(([, tag, classes]) => [tag, classes])).toEqual([
      ['a', 'flex items-start gap-2 rounded-none p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900'],
      ['div', 'mt-0.5 text-muted-foreground'],
      ['svg', 'lucide lucide-send-horizontal w-5 h-5'],
      ['div', 'grid gap-0.5'],
      ['p', 'text-sm font-medium leading-none'],
      ['p', 'text-xs text-muted-foreground line-clamp-2'],
      ['p', 'text-xs text-muted-foreground'],
    ]);
    expect(first).toMatch(/<svg [^>]*aria-hidden="true"/);
  });

  it("marks no course in another part's card", () => {
    const html = card('fundamentals', 'erc20-bridge');
    expect(anchors(html)).toHaveLength(2);
    expect(html).not.toContain('aria-current');
  });

  it('prints the card copy of Blockchain Fundamentals, Access Restriction and Intro to Solidity', () => {
    // Each course's title and description, as its card prints them.
    const copy = (part: AcademyPartId) => Object.fromEntries(anchors(card(part)).map((a) => paragraphs(a).slice(0, 2)));
    expect({
      'Blockchain Fundamentals': copy('fundamentals')['Blockchain Fundamentals'],
      'Access Restriction': copy('vm-customization')['Access Restriction'],
      'Intro to Solidity': copy('applications')['Intro to Solidity'],
    }).toEqual({
      'Blockchain Fundamentals': 'Learn the basics of blockchain and Solidity',
      'Access Restriction': 'Control who can transact and deploy contracts with allowlist precompiles',
      'Intro to Solidity': 'Learn Solidity basics with Foundry',
    });
  });
});

describe('partMenu', () => {
  it("lists each part's courses with their names and descriptions from academy.config.ts, lessons and hours, and the course id", () => {
    expect(partMenu('interoperability')).toEqual([
      {
        id: 'interchain-messaging',
        title: 'Interchain Messaging',
        description: "Build apps leveraging Avalanche's Interchain Messaging",
        url: '/academy/avalanche-l1/interchain-messaging',
        line: '30 lessons · 2 h',
      },
      {
        id: 'erc20-bridge',
        title: 'ERC20 Bridge',
        description: 'Bridge ERC20 tokens between chains using Interchain Token Transfer',
        url: '/academy/avalanche-l1/erc20-bridge',
        line: '21 lessons · 2 h',
      },
      {
        id: 'native-token-bridge',
        title: 'Native Token Bridge',
        description: 'Build a cross-chain L1 with native tokenomics and token bridging',
        url: '/academy/avalanche-l1/native-token-bridge',
        line: '22 lessons · 2 h',
      },
    ]);
    expect(partMenu('applications').map((item) => item.title)).toEqual(['Intro to Solidity', 'x402 Payments', 'Encrypted ERC']);
  });

  it('lists Blockchain Fundamentals first in Fundamentals', () => {
    expect(partMenu('fundamentals').map((item) => item.title)).toEqual(['Blockchain Fundamentals', 'Avalanche Fundamentals']);
  });
});
