import { describe, expect, it } from 'vitest';

import { dayKey, localDate, nextPick, rangeLabel } from '@/components/explorer-v2/defi/rwa-time';

describe("the range picker's label", () => {
  it('names a preset', () => {
    expect(rangeLabel({ preset: 'all' })).toBe('All time');
    expect(rangeLabel({ preset: '30d' })).toBe('Last 30 days');
    expect(rangeLabel({ preset: 'ytd' })).toBe('Year to date');
  });

  it('spells out a custom range', () => {
    expect(rangeLabel({ from: '2025-10-01', to: '2026-09-30' })).toBe('Oct 1, 2025 to Sep 30, 2026');
  });
});

describe("the calendar's days", () => {
  it('read a picked local date as its own calendar day, in any zone', () => {
    const zone = process.env.TZ;
    process.env.TZ = 'Pacific/Auckland';
    try {
      // midnight on Oct 1 in Auckland is still Sep 30 in UTC; the pick means Oct 1
      expect(dayKey(new Date(2026, 9, 1))).toBe('2026-10-01');
      const back = localDate('2026-10-01');
      expect([back.getFullYear(), back.getMonth(), back.getDate()]).toEqual([2026, 9, 1]);
    } finally {
      process.env.TZ = zone;
    }
  });
});

describe('a pick on the range calendar', () => {
  it('starts a range on the first click and closes it on the second, in either order', () => {
    const oct1 = new Date(2026, 9, 1);
    const sep10 = new Date(2026, 8, 10);
    expect(nextPick(undefined, oct1)).toEqual({ start: oct1 });
    expect(nextPick(oct1, sep10)).toEqual({ from: '2026-09-10', to: '2026-10-01' });
    expect(nextPick(sep10, oct1)).toEqual({ from: '2026-09-10', to: '2026-10-01' });
  });

  it('takes a second click on the same day as a one-day range', () => {
    const oct1 = new Date(2026, 9, 1);
    expect(nextPick(oct1, new Date(2026, 9, 1))).toEqual({ from: '2026-10-01', to: '2026-10-01' });
  });
});
