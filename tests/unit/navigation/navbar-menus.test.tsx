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

type MenuItem = { text?: unknown; url?: string; menu?: { banner?: unknown } };

const itemsOf = (menu: unknown) => (menu as { items: MenuItem[] }).items;
const urlOf = (menu: unknown) => (menu as { url?: string }).url;
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
    expect(developersMenu).toMatchObject({ type: 'menu', text: 'Developers', url: '/docs/primary-network' });
    const items = itemsOf(developersMenu);
    expect(items.map((item) => [item.text, item.url])).toEqual([
      ['Documentation', '/docs/primary-network'],
      ['Academy', '/academy'],
    ]);
    expect(items.map(bannerSrc)).toEqual(['/nav/docs.webp', '/nav/academy.webp']);
  });
});

describe('Developers section (phone)', () => {
  it('offers the same two cards, links and pictures as the desktop menu', () => {
    const developers = phoneSection('Developers');
    expect(developers.href).toBe('/docs/primary-network');
    expect(developers.items.map((item) => [item.text, item.href, item.image])).toEqual([
      ['Documentation', '/docs/primary-network', '/nav/docs.webp'],
      ['Academy', '/academy', '/nav/academy.webp'],
    ]);
  });

  it('renders each picture item as a card that links to its page', () => {
    const html = renderToStaticMarkup(createElement(NavSectionBlock, { section: phoneSection('Developers') }));
    const cards = anchors(html).filter((anchor) => anchor.includes('<img'));
    expect(cards.map(hrefOf)).toEqual(['/docs/primary-network', '/academy']);
    expect(cards[0]).toContain('docs.webp');
    expect(cards[0]).toContain('>Documentation<');
    expect(cards[1]).toContain('academy.webp');
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
    ['/blog/some-post', '/guides'],
    ['/guides', '/guides'],
    ['/integrations', '/integrations'],
    ['/explorer/mainnet', '/explorer'],
    ['/stats/overview', '/stats'],
    ['/hackathons/some-hackathon', '/events'],
    ['/events', '/events'],
    ['/grants', '/grants'],
    ['/audits', '/audits'],
    ['/university', '/university'],
    ['/chat', '/chat'],
    ['/', ''],
  ])('%s marks %s', (pathname, section) => {
    expect(activeNavSection(pathname)).toBe(section);
  });

  it('marks the Developers trigger on Academy pages', () => {
    // The highlighter marks every navbar link whose href starts with `${section}/`.
    expect(urlOf(developersMenu)?.startsWith(`${activeNavSection('/academy')}/`)).toBe(true);
  });
});
