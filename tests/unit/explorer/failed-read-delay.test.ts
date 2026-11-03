import { describe, expect, it } from 'vitest';

import { failedReadDelay } from '@/components/explorer-v2/page-data';

// usePolledJson's retryFailedMs: the waits between the reads of a feed that keeps failing
describe('failedReadDelay', () => {
  it('waits the first delay, then twice as long each time', () => {
    expect([0, 1, 2].map((n) => failedReadDelay(20_000, n))).toEqual([20_000, 40_000, 80_000]);
  });

  it('never waits longer than 2 minutes', () => {
    expect([3, 4, 10, 100].map((n) => failedReadDelay(20_000, n))).toEqual([120_000, 120_000, 120_000, 120_000]);
    expect(failedReadDelay(5 * 60_000, 0)).toBe(120_000);
  });
});
