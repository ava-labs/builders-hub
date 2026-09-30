import { describe, expect, it } from 'vitest';

import { labelError } from '@/lib/explorer-query/stat-label';

type Series = { column: string; transform: 'none' | 'share' };
const stat = (label: string, column: string, format: 'usd' | 'percent' | 'number', agg: 'sum' | 'max' = 'max') => ({ label, column, agg, format });
const bars = (series: Series[], stacked = true) => ({ stacked, series });
// r7's D09 rows: priced_swaps and swaps_not_counted overlap, 32,438 + 639 against 32,803 swaps
const D09 = [
  { t: '2026-09-28', swaps_not_counted: 639, swaps: 32803, priced_swaps: 32438 },
  { t: '2026-09-29', swaps_not_counted: 976, swaps: 42486, priced_swaps: 41825 },
];

describe('labelError', () => {
  it('refuses a share that is no percent (r7 L03: "AVAX share" showed $2.37M)', () => {
    expect(labelError({ stats: [stat('AVAX share', 'borrows_usd', 'usd')], panels: [] }, [{ borrows_usd: 1 }], null)).toMatch(/^"AVAX share" shows borrows_usd as usd, and a share is a percent/);
    expect(labelError({ stats: [stat('Leader share', 'share_pct', 'percent')], panels: [] }, [{ share_pct: 12 }], null)).toBeNull();
  });

  it('refuses a stack of parts that add up to more than their whole (r7 D09)', () => {
    const panels = [bars([{ column: 'priced_swaps', transform: 'none' }, { column: 'swaps_not_counted', transform: 'none' }])];
    expect(labelError({ stats: [], panels }, D09, null)).toBe(
      'priced_swaps and swaps_not_counted add up to more than swaps in row 1, so they overlap and the stack counts some swaps twice: stack only parts that add up to swaps, or draw them side by side',
    );
  });

  it('passes parts that add up, bars side by side, shares and a stack with no whole in the rows', () => {
    const parts = D09.map((r) => ({ ...r, unpriced_swaps: r.swaps - r.priced_swaps }));
    const series = (b: string): Series[] => [{ column: 'priced_swaps', transform: 'none' }, { column: b, transform: 'none' }];
    expect(labelError({ stats: [], panels: [bars(series('unpriced_swaps'))] }, parts, null)).toBeNull();
    expect(labelError({ stats: [], panels: [bars(series('swaps_not_counted'), false)] }, D09, null)).toBeNull();
    expect(labelError({ stats: [], panels: [bars([{ column: 'priced_swaps', transform: 'share' }, { column: 'swaps_not_counted', transform: 'share' }])] }, D09, null)).toBeNull();
    expect(labelError({ stats: [], panels: [bars([{ column: 'buys', transform: 'none' }, { column: 'sells', transform: 'none' }])] }, [{ buys: 5, sells: 7, trades: 9 }], null)).toBeNull();
  });
});
