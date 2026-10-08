import { describe, expect, it } from 'vitest';

import { basicVisual } from '@/lib/explorer-query/draft';
import type { ChartSpec } from '@/lib/explorer-query/types';

const day = [{ name: 't', type: 'Date' }];
const name = [{ name: 'contract', type: 'String' }];
const axes = (chart: ChartSpec, columns = day) => basicVisual(chart, columns).panels.map((p) => ({ kind: p.kind, width: p.width, title: p.title, series: p.series.map((s) => `${s.column}:${s.axis}:${s.mark}`) }));

describe('the draft layout', () => {
  it('puts a series in another unit on the right axis, as a line over bars', () => {
    const chart: ChartSpec = { kind: 'bar', x: 't', series: [{ column: 'txs', label: 'Transactions', unit: 'txs' }, { column: 'reverted', label: 'Reverted', unit: 'txs' }, { column: 'revert_pct', label: 'Revert rate', unit: '%' }] };
    expect(axes(chart)).toEqual([{ kind: 'bar', width: 'full', title: '', series: ['txs:left:auto', 'reverted:left:auto', 'revert_pct:right:line'] }]);
    // a price beside a count: the count takes the right axis, the price stays the line it was
    const gas: ChartSpec = { kind: 'line', x: 't', series: [{ column: 'avg_gas_price_gwei', label: 'Average gas price', unit: 'gwei' }, { column: 'txs', label: 'Transactions', unit: 'txs' }] };
    expect(axes(gas)[0].series).toEqual(['avg_gas_price_gwei:left:auto', 'txs:right:auto']);
  });

  it('keeps counts of any kind, and a small series in the same unit, on one axis', () => {
    const counts: ChartSpec = { kind: 'bar', x: 't', series: [{ column: 'txs', label: 'Transactions', unit: 'txs' }, { column: 'transfers', label: 'Transfers', unit: 'transfers' }, { column: 'reverted', label: 'Reverted' }] };
    expect(axes(counts)[0].series).toEqual(['txs:left:auto', 'transfers:left:auto', 'reverted:left:auto']);
    const prices: ChartSpec = { kind: 'line', x: 't', series: [{ column: 'avg_navax', label: 'Average', unit: 'nAVAX' }, { column: 'max_navax', label: 'Highest', unit: 'nAVAX' }] };
    expect(axes(prices)[0].series).toEqual(['avg_navax:left:auto', 'max_navax:left:auto']);
  });

  it('gives a ranking in two units two half-width panels, each titled by its figures', () => {
    const chart: ChartSpec = { kind: 'bar', x: 'contract', series: [{ column: 'gas_charged', label: 'Gas charged', unit: 'gas' }, { column: 'fees_avax', label: 'Fees', unit: 'AVAX' }] };
    expect(axes(chart, name)).toEqual([
      { kind: 'hbar', width: 'half', title: 'Gas charged', series: ['gas_charged:left:auto'] },
      { kind: 'hbar', width: 'half', title: 'Fees', series: ['fees_avax:left:auto'] },
    ]);
  });

  it('keeps stacked parts of one whole on one axis, and a table a table', () => {
    const stacked: ChartSpec = { kind: 'area', x: 't', stacked: true, series: [{ column: 'a', label: 'A', unit: 'AVAX' }, { column: 'b', label: 'B', unit: 'USD' }] };
    expect(axes(stacked)[0].series).toEqual(['a:left:auto', 'b:left:auto']);
    expect(axes({ kind: 'table', series: [] })).toEqual([{ kind: 'table', width: 'full', title: 'Rows', series: [] }]);
  });
});
