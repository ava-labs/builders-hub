import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The user button pulls in the auth client; the menus under test never render it.
vi.mock('@/components/login/user-button/UserButtonWrapper', () => ({ UserButtonWrapper: () => null }));

import { developersMenu, ecosystemMenu } from '@/app/layout.config';
import { menuSections, type NavItem, type NavSection } from '@/components/navigation/nav-config';
import { NavSectionBlock } from '@/components/navigation/navbar-dropdown';
import { activeNavSection } from '@/components/navigation/active-nav-highlighter';

type MenuItem = { text?: unknown; url?: string; menu?: { banner?: unknown; prefetch?: boolean } };

const itemsOf = (menu: unknown) => (menu as { items: MenuItem[] }).items;
/** a menu's trigger: the Link it holds as its text, read as its label, href and prefetch */
const triggerOf = (menu: unknown) => {
  const text = (menu as { text?: unknown }).text;
  if (!isValidElement(text)) return null;
  const { children, href, prefetch } = (text as ReactElement<{ children?: unknown; href?: string; prefetch?: boolean }>).props;
  return { label: children, href, prefetch };
};
const bannerSrc = (item: MenuItem) => {
  const banner = item.menu?.banner;
  return isValidElement(banner) ? (banner as ReactElement<{ src?: string }>).props.src : undefined;
};
const phoneSection = (title: string) => {
  const section = menuSections.find((s) => s.title === title);
  if (!section) throw new Error(`the phone menu has no ${title} section`);
  return section;
};
/** Every anchor in the markup, from `<a ` up to its closing tag. */
const anchors = (html: string) =>
  html.split('<a ').slice(1).map((segment) => `<a ${segment.slice(0, segment.indexOf('</a>'))}`);
const hrefOf = (anchor: string) => anchor.match(/href="([^"]+)"/)?.[1];
const render = (section: NavSection) => renderToStaticMarkup(createElement(NavSectionBlock, { section }));
/** The anchors that hold a picture: the section's cards. */
const cardsOf = (html: string) => anchors(html).filter((anchor) => anchor.includes('<img'));
/** The column (a div with a left rule) that holds the text links beside the last card, or null. */
const besideColumnOf = (html: string) => html.match(/<div class="[^"]*\bborder-l\b[^"]*">.*?<\/div>/s)?.[0] ?? null;

describe('Developers menu (desktop)', () => {
  it('opens on the docs landing and offers exactly Documentation and Academy as picture cards', () => {
    expect(developersMenu).toMatchObject({ type: 'menu' });
    expect(triggerOf(developersMenu)).toMatchObject({ label: 'Developers', href: '/docs/primary-network' });
    const items = itemsOf(developersMenu);
    expect(items.map((item) => [item.text, item.url])).toEqual([
      ['Documentation', '/docs/primary-network'],
      ['Academy', '/academy'],
    ]);
    expect(items.map(bannerSrc)).toEqual(['/nav/documentation.webp', '/nav/academy-fundamentals.webp']);
  });

  it('prefetches none of its links', () => {
    // a prefetched docs or Academy route preloads its CSS and first image into
    // the current page, and Chrome reports them as preloaded but not used
    expect(triggerOf(developersMenu)?.prefetch).toBe(false);
    expect(itemsOf(developersMenu).map((item) => item.menu?.prefetch)).toEqual([false, false]);
  });
});

describe('Developers section (phone)', () => {
  it('offers the same two cards, links and pictures as the desktop menu', () => {
    const developers = phoneSection('Developers');
    expect(developers.href).toBe('/docs/primary-network');
    expect(developers.items.map((item) => [item.text, item.href, item.image])).toEqual([
      ['Documentation', '/docs/primary-network', '/nav/documentation.webp'],
      ['Academy', '/academy', '/nav/academy-fundamentals.webp'],
    ]);
  });

  it('renders each picture item as a card that links to its page', () => {
    const html = renderToStaticMarkup(createElement(NavSectionBlock, { section: phoneSection('Developers') }));
    const cards = anchors(html).filter((anchor) => anchor.includes('<img'));
    expect(cards.map(hrefOf)).toEqual(['/docs/primary-network', '/academy']);
    expect(cards[0]).toContain('documentation.webp');
    expect(cards[0]).toContain('>Documentation<');
    expect(cards[1]).toContain('academy-fundamentals.webp');
    expect(cards[1]).toContain('>Academy<');
  });
});

describe('phone sections', () => {
  it.each(menuSections.map((section) => section.title))('%s holds at least one picture card', (title) => {
    expect(cardsOf(render(phoneSection(title))).length).toBeGreaterThan(0);
  });

  it('offers Console and Testnet Faucet as the Console cards', () => {
    // The faucet is the most tapped link of the phone menu.
    const html = render(phoneSection('Console'));
    expect(cardsOf(html).map(hrefOf)).toEqual(['/console', '/console/primary-network/faucet']);
    expect(cardsOf(html)[0]).toContain('>Console<');
    expect(cardsOf(html)[1]).toContain('>Testnet Faucet<');
  });

  it.each(['Solutions', 'Explorer', 'Ecosystem'])(
    '%s shows one picture card and its text links in the column beside it',
    (title) => {
      const section = phoneSection(title);
      const html = render(section);
      const cards = cardsOf(html);
      expect(cards.map(hrefOf)).toEqual(section.items.filter((item) => item.image).map((item) => item.href));
      expect(cards).toHaveLength(1);

      const column = besideColumnOf(html);
      expect(column, 'a column beside the card').not.toBeNull();
      // The column follows the card in the same grid row.
      expect(html.slice(html.indexOf(cards[0]) + cards[0].length)).toMatch(/^<\/a><div class="[^"]*\bborder-l\b/);
      const textLinks = section.items.filter((item) => !item.image).map((item) => item.href);
      expect(anchors(column as string).map(hrefOf)).toEqual(textLinks);
      // A label stays on one line beside the card. tests/e2e/site/navbar.e2e.ts checks that it fits its column.
      for (const row of anchors(column as string)) expect(row, hrefOf(row)).toContain('whitespace-nowrap');
      // No text link renders a second time below the cards: outside the column only the section title is left.
      const outside = anchors(html.replace(column as string, '')).filter((anchor) => !anchor.includes('<img'));
      expect(outside.map(hrefOf)).toEqual([section.href]);
    },
  );

  it('shows a two-card section with no column beside the cards', () => {
    const html = render(phoneSection('Console'));
    expect(cardsOf(html)).toHaveLength(2);
    expect(besideColumnOf(html)).toBeNull();
  });

  const textRows: NavItem[] = [
    { text: 'Inside', href: '/inside' },
    { text: 'Outside', href: 'https://example.com/outside', external: true },
    { text: 'Fresh', href: '/fresh', badge: 'New' },
  ];
  const card: NavItem = { text: 'Card', href: '/card', image: '/nav/documentation.webp' };
  it.each([
    ['below the cards', textRows],
    ['in the column beside a card', [card, ...textRows]],
  ])('opens external rows in a new tab and keeps badges on their row, %s', (_, items) => {
    const html = render({ title: 'Fixture', href: '/fixture', items });
    expect(besideColumnOf(html) !== null).toBe(items.includes(card));
    const row = (href: string) => anchors(html).find((anchor) => hrefOf(anchor) === href) ?? '';
    expect(row('https://example.com/outside')).toContain('target="_blank"');
    expect(row('https://example.com/outside')).toContain('rel="noreferrer noopener"');
    expect(row('/inside')).not.toContain('target=');
    expect(row('/fresh')).toContain('>New<');
    expect(row('/inside')).not.toContain('>New<');
  });
});

describe('card pictures', () => {
  it('exist in public/ for every card the desktop and phone menus reference', () => {
    const sources = [
      ...itemsOf(developersMenu).map(bannerSrc),
      ...menuSections.flatMap((section) => section.items.flatMap((item) => (item.image ? [item.image] : []))),
    ];
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) {
      expect(src, 'a card without a picture').toBeTruthy();
      expect(existsSync(join(process.cwd(), 'public', src as string)), `public${src}`).toBe(true);
    }
  });
});

describe('Ecosystem menu', () => {
  it('opens the /ecosystem overview from the desktop trigger without a prefetch, and from the phone header', () => {
    // a prefetched route preloads its CSS into the page that holds the navbar
    expect(triggerOf(ecosystemMenu)).toEqual({ label: 'Ecosystem', href: '/ecosystem', prefetch: false });
    expect(phoneSection('Ecosystem').href).toBe('/ecosystem');
  });

  it('holds Blog & Guides and Integrations on desktop, and Integrations and an overview card on the phone', () => {
    const desktop = itemsOf(ecosystemMenu).map((item) => item.url);
    expect(desktop).toContain('/guides');
    expect(desktop).toContain('/integrations');
    // The phone card opens the /ecosystem overview, which lists Blog & Guides.
    const phone = phoneSection('Ecosystem').items;
    expect(phone.map((item) => item.href)).toContain('/integrations');
    expect(phone.filter((item) => item.image).map((item) => item.href)).toEqual(['/ecosystem']);
  });
});

describe('active navbar section', () => {
  it.each([
    ['/academy', '/docs'],
    ['/academy/avalanche-l1/avalanche-fundamentals', '/docs'],
    ['/docs/primary-network', '/docs'],
    ['/console/layer-1/l1-node-setup', '/console'],
    ['/explorer/mainnet', '/explorer'],
    ['/stats/overview', '/stats'],
    ['/ecosystem', '/ecosystem'],
    ['/blog/some-post', '/ecosystem'],
    ['/guides', '/ecosystem'],
    ['/integrations', '/ecosystem'],
    ['/hackathons/some-hackathon', '/ecosystem'],
    ['/events', '/ecosystem'],
    ['/grants', '/ecosystem'],
    ['/audits', '/ecosystem'],
    ['/ecosystem-careers', ''],
    ['/chat', '/chat'],
    ['/', ''],
  ])('%s marks %s', (pathname, section) => {
    expect(activeNavSection(pathname)).toBe(section);
  });

  it('marks the Developers trigger on Academy pages', () => {
    // The highlighter marks every navbar link whose href starts with `${section}/`.
    expect(triggerOf(developersMenu)?.href?.startsWith(`${activeNavSection('/academy')}/`)).toBe(true);
  });

  it('marks the Ecosystem trigger on the overview and on every Builder Hub page of its menus', () => {
    // The highlighter marks the navbar link whose href equals the section. The pages come from the
    // menus, so an item added to either menu must also be added to activeNavSection.
    const pages = [
      ...itemsOf(ecosystemMenu).map((item) => item.url),
      ...phoneSection('Ecosystem').items.map((item) => item.href),
    ].filter((href): href is string => !!href?.startsWith('/'));
    expect(pages.length).toBeGreaterThan(0);
    for (const pathname of ['/ecosystem', ...pages]) {
      expect(activeNavSection(pathname), pathname).toBe(triggerOf(ecosystemMenu)?.href);
    }
  });
});
