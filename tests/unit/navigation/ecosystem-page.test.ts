import { describe, expect, it, vi } from 'vitest';

// The user button pulls in the auth client; the menus under test never render it.
vi.mock('@/components/login/user-button/UserButtonWrapper', () => ({ UserButtonWrapper: () => null }));

import { ecosystemMenu } from '@/app/layout.config';
import { menuSections } from '@/components/navigation/nav-config';
import { ECOSYSTEM_GROUPS } from '@/components/ecosystem/entries';

type DesktopItem = { url?: string; menu?: { className?: string } };

// The menus link /guides, which redirects to /blog; the overview links /blog.
const page = (href: string) => (href === '/guides' ? '/blog' : href);

const entries = ECOSYSTEM_GROUPS.flatMap((group) => group.entries.map((entry) => ({ ...entry, group: group.id })));
const phoneItems = menuSections.find((section) => section.title === 'Ecosystem')?.items ?? [];
const desktopItems = (ecosystemMenu as { items: DesktopItem[] }).items;

describe('/ecosystem overview', () => {
  it('lists every phone menu link other than the overview card once, with its badge and external flag', () => {
    // The phone card opens /ecosystem itself. The phone labels are shorter than the overview titles on purpose,
    // so the titles are not compared.
    const links = phoneItems.filter((item) => item.href !== '/ecosystem');
    expect(links.length).toBeGreaterThan(0);
    for (const item of links) {
      const matches = entries.filter((e) => e.href === page(item.href));
      expect(matches, item.href).toHaveLength(1);
      expect(matches[0].badge, `${item.href} badge`).toBe(item.badge);
      expect(Boolean(matches[0].external), `${item.href} external`).toBe(Boolean(item.external));
    }
  });

  it('lists every item of the desktop menu, grouped as its columns are', () => {
    const column = (item: DesktopItem) => item.menu?.className?.match(/lg:col-start-(\d)/)?.[1];
    const groupOf = (url: string) => entries.find((entry) => entry.href === page(url))?.group;
    const groupsByColumn = new Map<string, Set<string | undefined>>();
    for (const item of desktopItems) {
      expect(item.url && groupOf(item.url), item.url).toBeTruthy();
      const key = column(item) ?? '';
      groupsByColumn.set(key, (groupsByColumn.get(key) ?? new Set()).add(groupOf(item.url as string)));
    }
    // one group per column, and a different group for each column
    expect([...groupsByColumn.values()].every((groups) => groups.size === 1)).toBe(true);
    expect(new Set([...groupsByColumn.values()].map((groups) => [...groups][0])).size).toBe(groupsByColumn.size);
  });

  it('says what each page is in one sentence of plain text', () => {
    for (const entry of entries) {
      expect(entry.line, entry.title).toMatch(/^[A-Z].*\.$/);
      // no em dash or en dash (U+2014, U+2013)
      expect(entry.line, entry.title).not.toMatch(/[\u2014\u2013]/);
      expect(entry.line.split(/\.\s/).length, entry.title).toBe(1);
    }
  });

  it('opens only Builder Hub paths in the same tab', () => {
    for (const entry of entries) {
      expect(entry.href.startsWith('/'), entry.title).toBe(!entry.external);
    }
  });
});
