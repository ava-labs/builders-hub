import { describe, expect, it } from 'vitest';

import type { ChainPulse } from '@/app/api/chain-pulse/route';
import { CLOCK_SLACK_MS, QUIET_MS, RATE_WINDOW_MS, chainClock, coverRates, extendCover, networkTps, type Cover } from '@/components/explorer-v2/network/throughput';

const NOW = 1_790_000_000_000;
const block = (height: number, secondsAgo: number, txCount: number) => ({ height, at: NOW - secondsAgo * 1000, txCount });
const pulseOf = (rows: [string, number | null, boolean?][]) =>
  new Map<string, ChainPulse>(
    rows.map(([chainId, txPerMin, ok = true]) => [chainId, { chainId, height: 1, lastBlockAt: NOW, txs: 0, spanSec: 10, txPerMin, ok }]),
  );

describe('extendCover', () => {
  it('opens a run at its oldest block, whose transactions came before the run', () => {
    const c = extendCover(undefined, [block(12, 2, 30), block(10, 10, 99), block(11, 6, 20)], undefined)!;
    expect(c.since).toBe(NOW - 10_000);
    expect(c.blocks.map((b) => b.height)).toEqual([11, 12]);
  });

  it('carries a run on through the next heights, and starts a new one after a gap', () => {
    const run = extendCover(undefined, [block(10, 10, 5), block(11, 6, 5)], undefined);
    expect(extendCover(run, [block(12, 3, 5), block(11, 6, 5)], 11)).toEqual({ since: NOW - 10_000, blocks: [block(11, 6, 5), block(12, 3, 5)] });
    expect(extendCover(run, [block(20, 2, 5), block(21, 1, 5)], 11)).toEqual({ since: NOW - 2_000, blocks: [block(21, 1, 5)] });
    expect(extendCover(run, [], 11)).toBe(run);
  });
});

describe('coverRates', () => {
  it('rates each chain over its own time, not one span shared by all', () => {
    const covers = new Map<string, Cover>([
      // a fast chain: 20 seconds covered, 200 transactions
      ['fast', { since: NOW - 20_000, blocks: [block(2, 10, 100), block(3, 0, 100)] }],
      // a slow chain: quiet for the whole window
      ['slow', { since: NOW - 70_000, blocks: [] }],
    ]);
    const rates = coverRates(covers, NOW);
    expect(rates.get('fast')).toBe(10);
    expect(rates.get('slow')).toBe(0);
  });

  it('ends a busy chain span at its newest block, so the feed delay does not dilute it', () => {
    const covers = new Map<string, Cover>([['busy', { since: NOW - 20_000, blocks: [block(2, 10, 60), block(3, 3, 60)] }]]);
    expect(coverRates(covers, NOW).get('busy')).toBeCloseTo(120 / 17);
  });

  it('leaves out a run too short to read, and reads a long one over the window alone', () => {
    const covers = new Map<string, Cover>([
      ['young', { since: NOW - 8_000, blocks: [block(2, 4, 50)] }],
      ['old', { since: NOW - 300_000, blocks: [block(2, 100, 999), block(3, 30, 150)] }],
    ]);
    const rates = coverRates(covers, NOW);
    expect(rates.has('young')).toBe(false);
    // quiet since its last block: the span reaches toward now, and the rate fades
    expect(rates.get('old')).toBe((150 * 1000) / (RATE_WINDOW_MS - QUIET_MS));
  });
});

describe('chainClock', () => {
  it('reads now off the newest block, whatever the browser clock says', () => {
    const covers = new Map<string, Cover>([['a', { since: NOW - 9_000, blocks: [block(2, 2, 1)] }]]);
    expect(chainClock(covers, NOW + 3_000)).toBe(NOW - 2_000);
    expect(chainClock(covers, NOW - 30_000)).toBe(NOW - 2_000);
  });

  it('gives way to the browser clock when the feed goes stale', () => {
    const covers = new Map<string, Cover>([['a', { since: NOW - 200_000, blocks: [block(2, 120, 1)] }]]);
    expect(chainClock(covers, NOW)).toBe(NOW - CLOCK_SLACK_MS);
  });
});

describe('networkTps', () => {
  it('waits for the pulse, so the figure is never a few chains alone', () => {
    expect(networkTps(null, new Map([['43114', 9]]))).toBeNull();
  });

  it('takes a chain live rate where the feed has one, else its pulse', () => {
    const pulse = pulseOf([['43114', 360], ['2', 120], ['3', null, false]]);
    expect(networkTps(pulse, null)).toBe(8);
    expect(networkTps(pulse, new Map([['43114', 7.5], ['99', 0.5]]))).toBe(10);
  });

  it('counts a chain no RPC reads at its window average, and each chain once', () => {
    const pulse = pulseOf([['43114', 360], ['3', null, false]]);
    const average = new Map([['43114', 20], ['3', 1.5], ['NoRpcChain', 0.5]]);
    expect(networkTps(pulse, new Map([['43114', 7]]), average)).toBe(9);
  });
});
