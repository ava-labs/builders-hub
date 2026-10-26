import { describe, expect, it } from 'vitest';

import {
  heldWindow,
  metricsReadFor,
  statsWindow,
  type Metrics,
  type StatsWindow,
} from '@/components/explorer-v2/evm/metric-charts';

/* exp-range-hold: while the next window loads, the window on screen stays, marked stale; it is never blanked. */
const MONTH = { clock: 'month', txs: 34_000_000 };
const QUARTER = { clock: 'quarter', txs: 195_600_000 };

describe('heldWindow', () => {
  it('keeps the window on screen, marked stale, while the next one loads', () => {
    expect(heldWindow(MONTH, null, true)).toEqual({ data: MONTH, stale: true });
  });

  it('shows the next window once it has landed, not stale', () => {
    expect(heldWindow(MONTH, QUARTER, false)).toEqual({ data: QUARTER, stale: false });
    // a window read from memory lands at once, while its read behind it is still out
    expect(heldWindow(MONTH, QUARTER, true)).toEqual({ data: QUARTER, stale: false });
  });

  it('has nothing to hold on a first load: null, not stale', () => {
    expect(heldWindow(null, null, true)).toEqual({ data: null, stale: false });
    expect(heldWindow(null, MONTH, false)).toEqual({ data: MONTH, stale: false });
  });

  it('holds nothing once the next window has failed, so the failure shows', () => {
    expect(heldWindow(MONTH, null, false)).toEqual({ data: null, stale: false });
  });

  it('returns the windows it was given, not copies', () => {
    expect(heldWindow(MONTH, null, true).data).toBe(MONTH);
    expect(heldWindow(MONTH, QUARTER, false).data).toBe(QUARTER);
  });
});

/* statsWindow: which window Network Stats draws, and which one it keeps as the last complete window. A read is a
   payload as useChainMetrics answers it; the payloads stand for the 90-day, the 1-year and the C-Chain fee reads. */
const D90: Metrics = { txCount: { data: [], current_value: 34_000_000 } };
const Y1: Metrics = { txCount: { data: [], current_value: 195_600_000 } };
const FEES: Metrics = { feesPaid: { data: [], current_value: 805 } };
const LOADING = { metrics: null, failed: false };
const MONTH_WINDOW: StatsWindow<string> = { clock: 'month', metrics: D90, fees: null, complete: true };

describe('statsWindow', () => {
  it('mainnet: draws a window once its read lands, keeps it, and holds it, stale, through the next load', () => {
    const landed = statsWindow(null, 'month', { metrics: D90, failed: false });
    expect(landed).toEqual({ view: MONTH_WINDOW, stale: false, keep: MONTH_WINDOW });
    expect(landed.keep).toBe(landed.view);
    // the next window is on its way: the month stays, stale
    const held = statsWindow(MONTH_WINDOW, 'quarter', LOADING);
    expect(held).toEqual({ view: MONTH_WINDOW, stale: true, keep: null });
    expect(held.view).toBe(MONTH_WINDOW);
    // it lands, and replaces the month
    const quarter = { clock: 'quarter', metrics: Y1, fees: null, complete: true };
    expect(statsWindow(MONTH_WINDOW, 'quarter', { metrics: Y1, failed: false })).toEqual({
      view: quarter,
      stale: false,
      keep: quarter,
    });
  });

  it('a new clock on the same read is a new window (1D and 1W share the 30-day read)', () => {
    const week = statsWindow({ ...MONTH_WINDOW, clock: 'day' }, 'week', { metrics: D90, failed: false });
    expect(week.view).toEqual({ ...MONTH_WINDOW, clock: 'week' });
    expect(week.keep).toBe(week.view);
  });

  it('a window built afresh on every render is still the same window: nothing more to keep, no render loop', () => {
    const first = statsWindow(null, 'month', { metrics: D90, failed: false });
    // the next render: the same reads, the window just kept
    const again = statsWindow(first.keep, 'month', { metrics: D90, failed: false });
    expect(again.keep).toBeNull();
    expect(again.view).toBe(first.keep);
    expect(again.stale).toBe(false);
  });

  it('Fuji waits for both reads: the last window stays, stale, until the C-Chain fee read has answered too', () => {
    const rollupOnly = statsWindow(MONTH_WINDOW, 'quarter', { metrics: Y1, failed: false }, LOADING);
    expect(rollupOnly).toEqual({ view: MONTH_WINDOW, stale: true, keep: null });
    const both = statsWindow(MONTH_WINDOW, 'quarter', { metrics: Y1, failed: false }, { metrics: FEES, failed: false });
    const quarter = { clock: 'quarter', metrics: Y1, fees: FEES, complete: true };
    expect(both).toEqual({ view: quarter, stale: false, keep: quarter });
  });

  it('a C-Chain fee read that fails still completes the window, so the stats never stay dimmed', () => {
    const failedFees = statsWindow(
      MONTH_WINDOW,
      'quarter',
      { metrics: Y1, failed: false },
      { metrics: null, failed: true },
    );
    const quarter = { clock: 'quarter', metrics: Y1, fees: null, complete: true };
    expect(failedFees).toEqual({ view: quarter, stale: false, keep: quarter });
  });

  it('a failed metrics read holds nothing, so the failure shows', () => {
    expect(statsWindow(MONTH_WINDOW, 'quarter', { metrics: null, failed: true })).toEqual({
      view: null,
      stale: false,
      keep: null,
    });
  });

  it('a first visit has nothing to hold, and draws each read as it lands', () => {
    expect(statsWindow(null, 'month', LOADING)).toEqual({ view: null, stale: false, keep: null });
    // Fuji: the rollup has landed, the fee read is still out: drawn as it is, not kept, not stale
    const partial = statsWindow(null, 'month', { metrics: D90, failed: false }, LOADING);
    expect(partial).toEqual({
      view: { clock: 'month', metrics: D90, fees: null, complete: false },
      stale: false,
      keep: null,
    });
  });
});

/* metricsReadFor: what useChainMetrics answers for the url it is asked now. Each read keeps the url it answers; in the
   render between a new window and its read, the hook answers that url's memory or nothing, never the last payload. */
describe('metricsReadFor', () => {
  const D30_URL = '/api/chain-stats/all?metrics=txCount&timeRange=30d';
  const D90_URL = '/api/chain-stats/all?metrics=txCount&timeRange=90d';
  const Y1_URL = '/api/chain-stats/all?metrics=txCount&timeRange=1y';
  // the explorer's memory holds the 90-day payload from an earlier visit
  const memory = new Map<string, Metrics>([[D90_URL, D90]]);
  const recall = (url: string) => memory.get(url) ?? null;

  it('answers the read itself when it is for the url asked', () => {
    expect(metricsReadFor(D30_URL, { url: D30_URL, metrics: Y1, failed: false }, recall)).toEqual({
      metrics: Y1,
      failed: false,
    });
    expect(metricsReadFor(D30_URL, { url: D30_URL, metrics: null, failed: true }, recall)).toEqual({
      metrics: null,
      failed: true,
    });
  });

  it("a read for another url answers the asked url's memory or null, never the previous payload", () => {
    const previous = { url: D30_URL, metrics: Y1, failed: false };
    expect(metricsReadFor(D90_URL, previous, recall)).toEqual({ metrics: D90, failed: false });
    expect(metricsReadFor(Y1_URL, previous, recall)).toEqual({ metrics: null, failed: false });
    expect(metricsReadFor(Y1_URL, previous, recall).metrics).not.toBe(Y1);
  });

  it("the last url's failure does not mark the new window failed", () => {
    expect(metricsReadFor(Y1_URL, { url: D30_URL, metrics: null, failed: true }, recall)).toEqual({
      metrics: null,
      failed: false,
    });
  });

  it('asks the memory only for the url asked, and only when the read is for another url', () => {
    const asked: string[] = [];
    const spy = (url: string) => {
      asked.push(url);
      return recall(url);
    };
    metricsReadFor(D30_URL, { url: D30_URL, metrics: Y1, failed: false }, spy);
    expect(asked).toEqual([]);
    metricsReadFor(D90_URL, { url: D30_URL, metrics: Y1, failed: false }, spy);
    expect(asked).toEqual([D90_URL]);
  });
});
