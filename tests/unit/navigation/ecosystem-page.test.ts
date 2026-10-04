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
  it('lists every item of the phone menu once, in the phone order, with its title, badge and external flag', () => {
    expect(phoneItems.length).toBeGreaterThan(0);
    expect(entries.map((entry) => entry.href)).toEqual(phoneItems.map((item) => page(item.href)));
    for (const item of phoneItems) {
      const entry = entries.find((e) => e.href === page(item.href));
      expect(entry, item.text).toMatchObject({ title: item.text });
      expect(entry?.badge, `${item.text} badge`).toBe(item.badge);
      expect(Boolean(entry?.external), `${item.text} external`).toBe(Boolean(item.external));
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
