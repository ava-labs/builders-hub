import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The user button pulls in the auth client; the menus under test never render it.
vi.mock('@/components/login/user-button/UserButtonWrapper', () => ({ UserButtonWrapper: () => null }));

import { developersMenu, ecosystemMenu } from '@/app/layout.config';
import { menuSections } from '@/components/navigation/nav-config';
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

  it('keeps sections without pictures as plain text rows', () => {
    const html = renderToStaticMarkup(createElement(NavSectionBlock, { section: phoneSection('Ecosystem') }));
    expect(html).not.toContain('<img');
    expect(anchors(html).map(hrefOf)).toContain('/integrations');
  });

  it('opens external rows in a new tab and keeps badges on their row', () => {
    const rows = anchors(renderToStaticMarkup(createElement(NavSectionBlock, { section: phoneSection('Ecosystem') })));
    const row = (href: string) => rows.find((anchor) => hrefOf(anchor) === href) ?? '';
    expect(row('https://www.avalanchesummit.com')).toContain('target="_blank"');
    expect(row('https://www.avalanchesummit.com')).toContain('rel="noreferrer noopener"');
    expect(row('/grants')).not.toContain('target=');
    expect(row('/audits')).toContain('>New<');
  });
});

describe('card pictures', () => {
  it('exist in public/ for every card the desktop and phone menus reference', () => {
    const sources = [
      ...itemsOf(developersMenu).map(bannerSrc),
      ...phoneSection('Developers').items.map((item) => item.image),
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

  it('holds Blog & Guides and Integrations on desktop and on the phone', () => {
    const desktop = itemsOf(ecosystemMenu).map((item) => item.url);
    const phone = phoneSection('Ecosystem').items.map((item) => item.href);
    for (const url of ['/guides', '/integrations']) {
      expect(desktop).toContain(url);
      expect(phone).toContain(url);
    }
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
