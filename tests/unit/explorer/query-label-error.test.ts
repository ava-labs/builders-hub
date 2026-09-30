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

  it('refuses a percent over a count (r11 G10: 390 registrations read "390.0%")', () => {
    expect(labelError({ stats: [stat('Registrations', 'registrations', 'percent', 'sum')], panels: [] }, [{ registrations: 390 }], null)).toBe(
      '"Registrations" shows registrations as a percent, and registrations is no rate or share: give it format number, or show a pct, rate or share column',
    );
    for (const c of ['fail_rate', 'revert_pct', 'share_of_volume', 'apr']) expect(labelError({ stats: [stat('Rate', c, 'percent')], panels: [] }, [{ [c]: 5 }], null)).toBeNull();
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

describe('a max or a min over rows a LIMIT cut', () => {
  // r11's G07: 15 of 9,664 arbitrages kept by fee; "Peak gas" read 1.01M, where the week's peak was 18.79M
  const SQL = 'SELECT tx_hash, fee_avax, gas_charged, count() OVER () AS of_total FROM raw_txs ORDER BY fee_avax DESC LIMIT 15';
  const rows = [
    { fee_avax: 9.1, gas_charged: 1_010_000, of_total: 9664 },
    { fee_avax: 4.2, gas_charged: 350_000, of_total: 9664 },
  ];
  const cut = { rows: 9664, newest: false, sum: {}, count: {}, min: {}, max: {}, distinct: {} };
  const peak = (label: string, column: string, agg: 'max' | 'min' = 'max', sub?: string) => ({ label, column, agg, format: 'number' as const, sub });

  it('is refused when the LIMIT kept the rows by another column', () => {
    expect(labelError({ stats: [peak('Peak gas', 'gas_charged')], panels: [] }, rows, cut, SQL)).toBe(
      '"Peak gas" shows the largest gas_charged of the 2 rows shown, not of all 9664: the LIMIT kept them by fee_avax. Name it for the rows shown ("Peak gas, top 2"), or leave it out',
    );
    expect(labelError({ stats: [peak('Highest fee', 'fee_avax', 'min')], panels: [] }, rows, cut, SQL)).toMatch(/^"Highest fee" shows the smallest fee_avax/);
  });

  it("passes the ranking's own peak, a figure every row holds, one named for the rows shown and one the totals carry", () => {
    expect(labelError({ stats: [peak('Largest fee', 'fee_avax'), peak('Arbitrages', 'of_total')], panels: [] }, rows, cut, SQL)).toBeNull();
    expect(labelError({ stats: [peak('Peak gas', 'gas_charged', 'max', 'of the top 15')], panels: [] }, rows, cut, SQL)).toBeNull();
    expect(labelError({ stats: [peak('Peak gas', 'gas_charged')], panels: [] }, rows, { ...cut, max: { gas_charged: 18_790_000 } }, SQL)).toBeNull();
    expect(labelError({ stats: [peak('Peak gas', 'gas_charged')], panels: [] }, rows, { ...cut, rows: 2 }, SQL)).toBeNull();
  });
});
