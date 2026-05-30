import { describe, expect, it } from 'vitest';

import {
  DEGRADED_MAX_AGE_SEC,
  HEALTHY_MAX_AGE_SEC,
  deriveHealthStatus,
} from '@/hooks/useL1Health';
import { blocksBetween, trimToCount } from '@/hooks/useL1RecentBlocks';

describe('deriveHealthStatus', () => {
  it('returns "healthy" for fresh blocks', () => {
    expect(deriveHealthStatus(0)).toBe('healthy');
    expect(deriveHealthStatus(60)).toBe('healthy');
    expect(deriveHealthStatus(HEALTHY_MAX_AGE_SEC)).toBe('healthy');
  });

  it('flips to "degraded" past the healthy threshold', () => {
    expect(deriveHealthStatus(HEALTHY_MAX_AGE_SEC + 1)).toBe('degraded');
    expect(deriveHealthStatus(300)).toBe('degraded');
    expect(deriveHealthStatus(DEGRADED_MAX_AGE_SEC)).toBe('degraded');
  });

  it('flips to "stale" past the degraded threshold', () => {
    expect(deriveHealthStatus(DEGRADED_MAX_AGE_SEC + 1)).toBe('stale');
    expect(deriveHealthStatus(3_600)).toBe('stale');
  });

  it('treats negative ages (clock skew) as healthy rather than throwing', () => {
    // If the user's clock is ahead of the chain by a few seconds, blockAge
    // can come out negative. Don't blow up — treat it as the freshest end
    // of the spectrum.
    expect(deriveHealthStatus(-5)).toBe('healthy');
  });
});

describe('blocksBetween', () => {
  it('returns the exclusive range above "seen" up to but not including "latest"', () => {
    expect(blocksBetween(10n, 13n)).toEqual([11n, 12n]);
  });

  it('returns an empty array when seen >= latest (no new blocks since last poll)', () => {
    expect(blocksBetween(10n, 10n)).toEqual([]);
    expect(blocksBetween(10n, 9n)).toEqual([]);
  });

  it('handles a single new block (seen + 1 === latest)', () => {
    // No interior blocks; the hook fetches `latest` separately.
    expect(blocksBetween(10n, 11n)).toEqual([]);
  });

  it('handles large bigint deltas correctly', () => {
    const range = blocksBetween(1_000_000n, 1_000_005n);
    expect(range).toEqual([1_000_001n, 1_000_002n, 1_000_003n, 1_000_004n]);
  });

  it('handles the genesis edge — seen=0, latest=3', () => {
    expect(blocksBetween(0n, 3n)).toEqual([1n, 2n]);
  });
});

describe('trimToCount', () => {
  it('returns the array unchanged when smaller than the cap', () => {
    expect(trimToCount([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });

  it('returns the array unchanged when exactly at the cap', () => {
    expect(trimToCount([1, 2, 3], 3)).toEqual([1, 2, 3]);
  });

  it('keeps only the tail (newest entries) when over the cap', () => {
    // The hook prepends old + new blocks; trim drops the head.
    expect(trimToCount([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5]);
  });

  it('handles cap = 0 (returns empty)', () => {
    expect(trimToCount([1, 2, 3], 0)).toEqual([]);
  });

  it('preserves identity (returns same reference) when no trim needed', () => {
    // Cheap optimization — only allocate a new array when actually trimming.
    const original = [1, 2, 3];
    expect(trimToCount(original, 5)).toBe(original);
  });
});
