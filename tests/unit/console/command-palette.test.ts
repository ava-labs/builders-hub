import { describe, expect, it } from 'vitest';
import { PALETTE_GROUPS, PALETTE_ITEMS, orderPaletteGroups, paletteFilter } from '@/components/console/command-palette';

/** The palette titles for a query, best first, over all groups. */
function rank(search: string): string[] {
  return PALETTE_ITEMS.map((item) => ({ title: item.title, score: paletteFilter(item.title, search, item.keywords) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.title);
}

/**
 * The item that the palette shows first (and selects) for a query: the best
 * item of the first group with a match. cmdk sorts the items in a group.
 */
function firstShown(search: string, groups = orderPaletteGroups(PALETTE_GROUPS, search)): string | undefined {
  for (const [, items] of groups) {
    const scored = items
      .map((item) => ({ title: item.title, score: paletteFilter(item.title, search, item.keywords) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
    if (scored.length > 0) return scored[0].title;
  }
  return undefined;
}

describe('paletteFilter', () => {
  it('scores a title match above a keyword-only match', () => {
    const title = paletteFilter('Add Validator', 'add validator', ['register', 'validator']);
    const keywordOnly = paletteFilter('Validator Lookup', 'add validator', ['add', 'validator', 'address']);
    expect(title).toBeGreaterThan(0.5);
    expect(keywordOnly).toBeGreaterThan(0);
    expect(keywordOnly).toBeLessThanOrEqual(0.5);
  });

  it('returns 0 when neither the title nor the keywords match', () => {
    expect(paletteFilter('Testnet Faucet', 'zzz', ['get', 'free', 'avax'])).toBe(0);
  });

  it('puts the tool whose title matches first', () => {
    expect(rank('add validator')[0]).toBe('Add Validator');
    expect(rank('ICTT')[0]).toBe('ICTT Setup');
    expect(rank('faucet')[0]).toBe('Testnet Faucet');
  });

  it('still finds a tool by a description word', () => {
    expect(rank('dashboard')).toContain('Home');
  });
});

describe('orderPaletteGroups', () => {
  it('shows the tool whose title matches first, in any group', () => {
    expect(firstShown('add validator')).toBe('Add Validator');
    expect(firstShown('ICTT')).toBe('ICTT Setup');
    expect(firstShown('faucet')).toBe('Testnet Faucet');
    expect(firstShown('bridge')).toBe('C/P-Chain Bridge');
  });

  it('is needed: in registry order a description match in an earlier group shows first', () => {
    expect(firstShown('add validator', PALETTE_GROUPS)).not.toBe('Add Validator');
  });

  it('lists the best match of each group first, so a paste over another search keeps the order', () => {
    const groups = orderPaletteGroups(PALETTE_GROUPS, 'ICTT');
    expect(groups[0][1][0].title).toBe('ICTT Setup');
    for (const [, items] of groups) {
      const scores = items.map((item) => paletteFilter(item.title, 'ICTT', item.keywords));
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    }
  });

  it('keeps the registry order when the search is empty', () => {
    expect(orderPaletteGroups(PALETTE_GROUPS, '')).toBe(PALETTE_GROUPS);
  });
});

describe('PALETTE_ITEMS', () => {
  it('has a unique title for each item, because the title is the cmdk value', () => {
    const titles = PALETTE_ITEMS.map((item) => item.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('has only Console paths, because router.push cannot open an external URL', () => {
    for (const item of PALETTE_ITEMS) expect(item.url.startsWith('/console')).toBe(true);
  });
});
