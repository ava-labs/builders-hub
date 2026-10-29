import { describe, expect, it } from 'vitest';

import { fmt } from '@/components/explorer-v2/evm/query-format';
import { AVAX_USD_PROXY, avaxUsdNotes, avaxUsdWith, missingPrice, showPrice } from '@/lib/explorer-query/avax-usd';
import { guardSql } from '@/lib/explorer-query/guard';
import { collapseMacros, expandMacros } from '@/lib/explorer-query/macros';
import { systemPrompt } from '@/lib/explorer-query/prompt';
import { sqlWindow } from '@/lib/explorer-query/scope';
import { withSources } from '@/lib/explorer-query/sources';

const C = 43114;
const since = 'toStartOfDay(now()) - INTERVAL 7 DAY';
const FEES = `, f AS (SELECT toStartOfHour(block_time) AS h, sum(toFloat64(gas_used) * gas_price) / 1e18 AS fee FROM raw_txs WHERE chain_id = ${C} AND block_time >= ${since} GROUP BY h) SELECT toDate(f.h) AS t, round(sum(f.fee * nullIf(p.price, 0)), 2) AS fees_usd FROM f LEFT JOIN avax_usd AS p ON f.h = p.hour GROUP BY t ORDER BY t`;
const prompt = (chainId: number, dex = false) => systemPrompt({ chainId, chainName: 'x', symbol: 'AVAX', schema: '', coverage: null, dex });

describe('$AVAXUSD', () => {
  it("writes the hourly Chainlink series out from the window's start, with an end when it has one", () => {
    const x = expandMacros(`$AVAXUSD(${since})${FEES}`, C);
    expect(x.ok && x.sql).toBe(avaxUsdWith(since) + FEES);
    const sql = x.ok ? x.sql : '';
    expect(sql).toMatch(/^WITH avax_usd AS \(SELECT hour, price FROM \(/);
    expect(sql).toContain(`block_time >= toStartOfHour(toDateTime(${since})) - INTERVAL 1 DAY GROUP BY hour`);
    expect(sql).toContain(`WHERE hour >= toStartOfHour(toDateTime(${since})))`);
    expect(sql).toContain('WITH FILL STEP toIntervalHour(1) INTERPOLATE (price)');
    // the first aggregator before the hour the second took over, the second after
    expect(sql).toContain("if(block_time < toDateTime('2024-09-30 09:00:00'), address = unhex('9450a29ef091b625e976ce66f2a5818e20791999'), address = unhex('cfbfe648ba88bf7d9776d970417a0b26c315feb4'))");
    expect(sql).not.toContain('block_time < toStartOfDay');
    const day = expandMacros("$AVAXUSD('2025-07-18', '2025-07-19') SELECT hour, price FROM avax_usd ORDER BY hour", C);
    expect(day.ok && day.sql).toContain("block_time >= toStartOfHour(toDateTime(toDateTime('2025-07-18'))) - INTERVAL 1 DAY AND block_time < toDateTime('2025-07-19') GROUP BY hour");
  });

  it('goes back to the shorthand the writer typed, and refuses a slug or no start', () => {
    const typed = `$AVAXUSD(${since})${FEES}`;
    const x = expandMacros(typed, C);
    expect(x.ok && collapseMacros(x.sql, C)).toBe(typed);
    const r = (sql: string) => {
      const y = expandMacros(sql, C);
      return y.ok ? '' : y.error;
    };
    expect(r(`$AVAXUSD(${since}, 'pharaoh') SELECT 1 FROM avax_usd`)).toMatch(/^\$AVAXUSD takes no slug: /);
    expect(r('$AVAXUSD() SELECT 1 FROM avax_usd')).toMatch(/^\$AVAXUSD takes the window's start first/);
    expect(r(`$PRICES(${since}) SELECT 1 FROM lpx WHERE 1 = $AVAXUSD(now())`)).toMatch(/^the shorthand stands for the query's WITH, once, at its start: .*\$AVAXUSD\(start\) or \$AVAXUSD\(start, end\) for AVAX in USD/);
  });

  it('passes the guard, and its window is the shorthand\'s', () => {
    const g = guardSql(`$AVAXUSD(${since})${FEES}`, C);
    expect(g.ok, g.ok ? '' : g.error).toBe(true);
    const now = Date.UTC(2026, 9, 23, 12);
    expect(sqlWindow(`$AVAXUSD(${since})${FEES}`, now)).toMatchObject({ start: Date.UTC(2026, 9, 16), open: true });
  });

  it('is told on the mainnet C-Chain only, beside the DEX chapter too', () => {
    for (const p of [prompt(C), prompt(C, true)]) {
      expect(p).toContain('- Dollars: AVAX has a USD price.');
      expect(p).toContain('Never answer kind "none" for want of an AVAX price');
      expect(p).toMatch(/\n\$AVAXUSD\(toStartOfDay\(now\(\)\) - INTERVAL 7 DAY\), f AS \(SELECT/);
    }
    for (const chainId of [43113, 432204]) expect(prompt(chainId)).not.toContain('AVAXUSD');
  });

  it('runs the worked example through the guard as written', () => {
    const line = prompt(C).split('\n').find((l) => l.startsWith('$AVAXUSD('))!;
    const g = guardSql(line, C);
    expect(g.ok, g.ok ? '' : g.error).toBe(true);
  });
});

describe('the AVAX/USD source line', () => {
  it('names the feed on an answer that reads it, typed or written out, and on no other', async () => {
    const typed = `$AVAXUSD(${since})${FEES}`;
    const out = expandMacros(typed, C);
    for (const sql of [typed, out.ok ? out.sql : '']) {
      const [note] = avaxUsdNotes(sql, C);
      expect(note.text).toContain("Chainlink's AVAX/USD price feed");
      expect(note.text.toLowerCase()).toContain(AVAX_USD_PROXY);
      expect(note.text).toContain('July 14, 2021');
      expect(note.label).toBe('');
    }
    expect(avaxUsdNotes(`SELECT count() FROM raw_txs WHERE chain_id = ${C} AND block_time >= ${since}`, C)).toEqual([]);
    expect(avaxUsdNotes(typed, 43113)).toEqual([]);
    const { sources } = await withSources(out.ok ? out.sql : '', C);
    expect(sources.map((s) => s.table)).toEqual(['avax_usd']);
  });
});

describe('the AVAX price on a priced answer', () => {
  const sql = `$AVAXUSD(${since})${FEES}`;
  const rows = [
    { t: '2026-10-21', fees_usd: 8488.62, fees_avax: 870.05, avax_price_usd: 9.7565 },
    { t: '2026-10-22', fees_usd: 6700.76, fees_avax: 722.96, avax_price_usd: 9.254 },
  ];
  const tile = (label: string, column: string, format: 'usd' | 'avax' | 'number') => ({ label, column, agg: 'sum' as const, format });
  const panel = { title: 'Fees', kind: 'bar' as const, x: 't', series: [{ column: 'fees_usd', label: 'Fees', format: 'usd' as const, axis: 'left' as const, mark: 'auto' as const, transform: 'none' as const, dashed: false }], markers: [], bands: [], stacked: false, sortDir: 'desc' as const, referenceLines: [], width: 'full' as const };

  it('sends a query back once when its rows do not carry the price, and lets one that does pass', () => {
    expect(missingPrice(sql, { columns: [{ name: 't' }, { name: 'fees_usd' }] }, C)).toMatch(/^the rows are valued at the AVAX price but do not show it: add round\(avg\(nullIf\(p\.price, 0\)\), 4\) AS avax_price_usd/);
    expect(missingPrice(sql, { columns: [{ name: 'fees_usd' }, { name: 'avax_price_usd' }] }, C)).toBeNull();
    expect(missingPrice(`SELECT count() AS txs FROM raw_txs WHERE chain_id = ${C} AND block_time >= ${since}`, { columns: [{ name: 'txs' }] }, C)).toBeNull();
    expect(missingPrice(sql, { columns: [{ name: 'fees_usd' }] }, 43113)).toBeNull();
  });

  it('adds a price tile in place of a fourth, a price line on the right axis, and names twin tiles by unit', () => {
    const v = showPrice({ stats: [tile('Fees burned', 'fees_usd', 'usd'), tile('Fees burned', 'fees_avax', 'avax'), tile('Txs', 'txs', 'number'), tile('Most', 'txs', 'number')], panels: [panel], callouts: [] }, rows, C);
    expect(v.stats.map((s) => s.label)).toEqual(['Fees burned in USD', 'Fees burned in AVAX', 'Txs', 'AVAX price']);
    expect(v.stats[3]).toMatchObject({ column: 'avax_price_usd', agg: 'last', format: 'usd', sub: '$9.25 to $9.76 in these rows' });
    expect(v.panels[0].series.map((s) => [s.column, s.axis, s.mark])).toEqual([['fees_usd', 'left', 'auto'], ['avax_price_usd', 'right', 'line']]);
    // a layout that shows the price already, and rows with no price, are left as they are
    expect(showPrice(v, rows, C)).toEqual(v);
    const plain = { stats: [], panels: [panel], callouts: [] };
    expect(showPrice(plain, [{ t: '2026-10-22', fees_usd: 1 }], C)).toEqual(plain);
    expect(showPrice(plain, rows, 43113)).toEqual(plain);
  });

  it('shows a fee of a fraction of a cent to three significant digits', () => {
    expect(fmt(0.025658, 'usd', 'AVAX')).toBe('$0.0257');
    expect(fmt(0.45, 'usd', 'AVAX')).toBe('$0.45');
    expect(fmt(9.254, 'usd', 'AVAX')).toBe('$9.25');
    expect(fmt(64600, 'usd', 'AVAX')).toBe('$64.6k');
  });
});
