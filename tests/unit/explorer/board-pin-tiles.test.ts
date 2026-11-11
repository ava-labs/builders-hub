import { describe, expect, it } from 'vitest';

import { pinAnswer, pinAnswerTiles, snapshotOf, type ChartTile } from '@/lib/explorer-query/board';
import { tileVisual } from '@/lib/explorer-query/tile-visual';
import type { QueryAnswer, Totals } from '@/lib/explorer-query/types';
import type { Panel, VisualSpec } from '@/lib/explorer-query/visual-spec';

const COLUMNS = [
  { name: 'contract', type: 'String' },
  { name: 'gas', type: 'UInt64' },
  { name: 'gas_before', type: 'UInt64' },
  { name: 'txs', type: 'UInt64' },
];
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ contract: `0x${i}`, gas: 1000 - i * 10, gas_before: 900 - i * 5, txs: 50 + i }));
const SQL = 'SELECT contract, sum(gas) AS gas, sum(gas_before) AS gas_before, count() AS txs FROM raw_txs GROUP BY contract ORDER BY gas DESC\nLIMIT 15';

const panel = (kind: Panel['kind'], more: Partial<Panel> = {}): Panel => ({
  title: `${kind} panel`,
  kind,
  x: 'contract',
  series: [{ column: 'gas', label: 'Gas', format: 'number', axis: 'left', mark: 'auto', transform: 'none', dashed: false }],
  markers: [],
  bands: [],
  stacked: false,
  sortDir: 'desc',
  referenceLines: [],
  width: 'full',
  ...more,
});
const twoSeries = [...panel('hbar').series, { ...panel('hbar').series[0], column: 'gas_before', label: 'Before' }];
const totals = (n: number): Totals => ({ rows: n, newest: false, sum: {}, count: {}, min: {}, max: {}, distinct: {} });

function answer(visual: VisualSpec | null, more: Partial<QueryAnswer> = {}): QueryAnswer {
  const r = rows(8);
  return {
    title: 'Gas by contract',
    note: '',
    sql: SQL,
    chart: { type: 'bar' } as QueryAnswer['chart'],
    drill: null,
    result: { columns: COLUMNS, rows: r, rowCount: r.length, elapsedMs: 1, rowsRead: 1, bytesRead: 1, truncated: false, ranAt: '2026-11-10 12:00:00' },
    names: {},
    visual,
    coverage: null,
    ...more,
  };
}

const GRID: VisualSpec = {
  stats: [{ label: 'Gas', column: 'gas', agg: 'sum', format: 'number' }],
  panels: [panel('treemap'), panel('hbar', { width: 'half' }), panel('dumbbell', { width: 'half', series: twoSeries }), panel('table', { x: undefined, series: [] })],
  callouts: ['One sentence about today.'],
};

describe('pinAnswerTiles', () => {
  it('makes the figures tile, then a tile for each panel at the panel width', () => {
    const tiles = pinAnswerTiles(answer(GRID), { thread: ['gas by contract', 'only the last day'] });
    expect(tiles.map((t) => [t.figures ?? false, t.panelIndex, t.size, t.title])).toEqual([
      [true, null, 'w', 'Gas by contract'],
      [false, 0, 'w', 'treemap panel'],
      [false, 1, 'm', 'hbar panel'],
      [false, 2, 'm', 'dumbbell panel'],
      [false, 3, 'w', 'table panel'],
    ]);
    // each tile runs the answer's SQL again and opens the same thread
    for (const t of tiles) expect([t.sql, t.question, t.then, t.snapshot?.rows.length]).toEqual([SQL, 'gas by contract', ['only the last day'], 8]);
    expect(new Set(tiles.map((t) => t.id)).size).toBe(tiles.length);
  });

  it('makes no figures tile for an answer with no stats, and skips a panel the grid cannot draw', () => {
    const tiles = pinAnswerTiles(answer({ ...GRID, stats: [], panels: [panel('line'), panel('bar', { x: undefined }), panel('area', { series: [] })] }));
    expect(tiles.map((t) => [t.figures ?? false, t.panelIndex])).toEqual([[false, 0]]);
  });

  it('pins the rows of an answer with no layout as one table tile', () => {
    expect(pinAnswerTiles(answer(null)).map((t) => [t.panelIndex, t.size])).toEqual([[0, 'w']]);
  });

  it('makes nothing when there is no SQL to run again', () => {
    expect(pinAnswerTiles(answer(GRID, { sql: '' }))).toEqual([]);
  });
});

describe('a tile snapshot', () => {
  const result = (n: number, truncated = false) => ({ columns: COLUMNS, rows: rows(n), truncated });

  it('takes its cut from the totals of the answer', () => {
    expect(snapshotOf(result(15), {}, null, { sql: SQL, totals: totals(338) })).toMatchObject({ cut: true, totals: { rows: 338 } });
    // the rows reached the LIMIT, and the totals read found no more
    expect(snapshotOf(result(15), {}, null, { sql: SQL, totals: totals(15) }).cut).toBeUndefined();
  });

  it('takes its cut from the LIMIT or the row cap when a refresh read no totals', () => {
    expect(snapshotOf(result(15), {}, null, { sql: SQL }).cut).toBe(true);
    expect(snapshotOf(result(9), {}, null, { sql: SQL }).cut).toBeUndefined();
    expect(snapshotOf(result(9, true), {}, null, { sql: SQL }).cut).toBe(true);
    expect(snapshotOf(result(9), {}).totals).toBeUndefined();
  });

  it('is cut when it keeps fewer rows than the result holds', () => {
    const snap = snapshotOf(result(501), {}, null, { sql: 'SELECT 1' });
    expect([snap.rows.length, snap.cut]).toEqual([500, true]);
  });
});

describe('tileVisual', () => {
  const tileOf = (visual: VisualSpec, more: Partial<QueryAnswer> = {}, opts: { panelIndex?: number } = {}) => pinAnswer(answer(visual, more), opts) as ChartTile;

  it('draws the figures alone on a figures tile', () => {
    const v = tileVisual(pinAnswerTiles(answer(GRID))[0]);
    expect([v.stats.length, v.panels.length, v.callouts.length]).toEqual([1, 0, 0]);
  });

  it('draws one panel alone, full width, and the whole answer with every panel', () => {
    expect(tileVisual(tileOf(GRID, {}, { panelIndex: 1 })).panels.map((p) => [p.kind, p.width])).toEqual([['hbar', 'full']]);
    expect(tileVisual(tileOf(GRID)).panels.map((p) => p.kind)).toEqual(['treemap', 'hbar', 'dumbbell', 'table']);
  });

  it('draws bars in place of a treemap over rows a LIMIT cut', () => {
    const cut = tileOf(GRID, { totals: totals(338) });
    expect(tileVisual(cut).panels[0].kind).toBe('hbar');
    expect(tileVisual({ ...cut, panelIndex: 0 }).panels[0].kind).toBe('hbar');
    // a refresh that reaches the LIMIT holds no totals, and its treemap falls back too
    const fresh = { ...cut, panelIndex: 0, snapshot: snapshotOf({ columns: COLUMNS, rows: rows(15) }, {}, null, { sql: SQL }) };
    expect(tileVisual(fresh).panels[0].kind).toBe('hbar');
  });

  it('keeps a view the rows hold, and drops one they do not', () => {
    const tile = tileOf(GRID, {}, { panelIndex: 1 });
    expect(tileVisual({ ...tile, view: 'treemap' }).panels[0].kind).toBe('treemap');
    expect(tileVisual({ ...tile, view: 'line' }).panels[0].kind).toBe('line');
    // one series is no dumbbell, and no y is no heatmap: the designer's kind stands
    expect(tileVisual({ ...tile, view: 'dumbbell' }).panels[0].kind).toBe('hbar');
    expect(tileVisual({ ...tile, view: 'heatmap' }).panels[0].kind).toBe('hbar');
  });

  it('draws a table in place of a histogram with too few rows to spread', () => {
    const spread: VisualSpec = { stats: [], callouts: [], panels: [panel('histogram', { x: 'gas' })] };
    expect(tileVisual(tileOf(spread, {}, { panelIndex: 0 })).panels[0].kind).toBe('table');
  });

  it('leaves the kind as it is until the tile holds rows', () => {
    const tile = { ...tileOf(GRID, {}, { panelIndex: 0 }), view: 'dumbbell' as const, snapshot: undefined };
    expect(tileVisual(tile).panels[0].kind).toBe('dumbbell');
  });
});
