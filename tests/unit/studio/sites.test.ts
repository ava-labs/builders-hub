import { describe, expect, it, vi } from 'vitest';

vi.mock('@/prisma/prisma', () => ({ prisma: {} }));

import { SITE_SLUG, sitePath, slugify } from '@/server/services/studio/sites';

describe('site addresses', () => {
  it('turns a project name into a URL-safe slug', () => {
    expect(slugify('Creator Tips — v2!')).toBe('creator-tips-v2');
    expect(slugify('Café Münzen')).toBe('cafe-munzen');
    expect(slugify('   ')).toBe('');
    expect(slugify('a'.repeat(60))).toHaveLength(40);
  });

  it('accepts only lowercase letters, digits and inner dashes', () => {
    for (const ok of ['guestbook', 'usdc-checkout', 'a', 'v2']) expect(SITE_SLUG.test(ok)).toBe(true);
    for (const bad of ['-x', 'x-', 'Upper', 'a/b', '../x', 'a b', 'a'.repeat(41)]) expect(SITE_SLUG.test(bad)).toBe(false);
  });

  it('builds the public path under /builder', () => {
    expect(sitePath({ owner_slug: 'sarp', slug: 'guestbook' })).toBe('/builder/sarp/guestbook');
  });
});
