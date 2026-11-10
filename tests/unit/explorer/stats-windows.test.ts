import { describe, expect, it } from 'vitest';

import { latestComplete, periodStart, sumComplete, type Bucket } from '@/lib/stats-windows';

const t = (iso: string) => Date.parse(iso) / 1000;
const at = (iso: string, value: number): Bucket => ({ timestamp: t(iso), value });

/* Real C-Chain txCount buckets from stats-api.avax.network, read at 03:46 UTC
   on 2026-09-27. It stores complete periods only: Sep 27 has no daily bucket
   yet, and its hourly buckets stop at the last complete hour. */
const DAYS = [
  at('2026-09-26T00:00:00Z', 405_816),
  at('2026-09-25T00:00:00Z', 624_955),
  at('2026-09-24T00:00:00Z', 762_026),
  at('2026-09-23T00:00:00Z', 557_648),
  at('2026-09-22T00:00:00Z', 595_191),
  at('2026-09-21T00:00:00Z', 872_755),
  at('2026-09-20T00:00:00Z', 964_435),
  at('2026-09-19T00:00:00Z', 949_193),
];
const SEP26_HOURS = [
  21_818, 28_516, 25_622, 20_255, 14_375, 16_175, 16_985, 13_367, 14_272, 16_849, 16_282, 20_888,
  19_062, 18_025, 19_294, 21_839, 17_273, 13_301, 11_745, 9_116, 15_424, 11_195, 10_113, 14_025,
];
const HOURS = [
  at('2026-09-25T23:00:00Z', 18_006),
  ...SEP26_HOURS.map((v, h) => at(`2026-09-26T${String(h).padStart(2, '0')}:00:00Z`, v)),
  at('2026-09-27T00:00:00Z', 16_907),
  at('2026-09-27T01:00:00Z', 11_645),
  at('2026-09-27T02:00:00Z', 6_831),
  at('2026-09-27T03:00:00Z', 9_733),
];

describe('latestComplete', () => {
  // The route took the second-newest bucket, a rule for a feed whose newest
  // bucket was the partial current day. This feed has none, so "day" read
  // Sep 25 (624,955) at 00:47 UTC on Sep 27.
  it('reads the newest bucket when its period has ended, not the one before it', () => {
    expect(latestComplete(DAYS, 'day', t('2026-09-27T00:47:00Z'))?.value).toBe(405_816);
  });

  it('lets the period before stand in only while the latest one is being stored', () => {
    const stored = DAYS.slice(1);
    expect(latestComplete(stored, 'day', t('2026-09-27T00:10:00Z'))?.value).toBe(624_955);
    expect(latestComplete(stored, 'day', t('2026-09-27T01:00:00Z'))).toBeNull();
  });

  it("never reads a quiet chain's older bucket as the latest period's", () => {
    expect(latestComplete([at('2026-09-22T00:00:00Z', 305)], 'day', t('2026-09-27T00:47:00Z'))).toBeNull();
  });

  it('reads the latest complete Monday-to-Sunday week and calendar month', () => {
    const weeks = [at('2026-09-14T00:00:00Z', 1_349_469), at('2026-09-07T00:00:00Z', 2_362_573)];
    expect(latestComplete(weeks, 'week', t('2026-09-27T04:00:00Z'))?.value).toBe(1_349_469);
    const months = [at('2026-09-01T00:00:00Z', 9), at('2026-08-01T00:00:00Z', 13_182_851)];
    expect(latestComplete(months, 'month', t('2026-09-27T04:00:00Z'))?.value).toBe(13_182_851);
    expect(latestComplete(months, 'month', t('2026-10-02T04:00:00Z'))?.value).toBe(9);
  });
});

describe('sumComplete', () => {
  it('sums the last 24 complete hours: the explorer labels "day" 24 hours', () => {
    // at 00:47 the 24 hours are exactly Sep 26, and match its daily bucket
    expect(sumComplete(HOURS, 'hour', 24, t('2026-09-27T00:47:00Z'))).toBe(405_816);
    // at 04:02 they run from 04:00 on Sep 26, the 03:00 hour already stored
    expect(sumComplete(HOURS, 'hour', 24, t('2026-09-27T04:02:00Z'))).toBe(354_721);
  });

  it('ends the window an hour early while the hour just ended is not stored', () => {
    const stored = HOURS.filter((b) => b.timestamp < t('2026-09-27T03:00:00Z'));
    expect(sumComplete(stored, 'hour', 24, t('2026-09-27T04:05:00Z'))).toBe(365_243);
    // past the settle time a missing hour is a quiet one: the window stays on the clock
    expect(sumComplete(stored, 'hour', 24, t('2026-09-27T04:45:00Z'))).toBe(344_988);
  });

  it('sums the last 7 complete days, the newest included', () => {
    // the stats API's own lastWeek for the C-Chain at the same time
    expect(sumComplete(DAYS, 'day', 7, t('2026-09-27T03:46:00Z'))).toBe(4_782_826);
  });

  it('adds a sparse chain across its gaps and has no figure without a bucket in the window', () => {
    const grotto = [at('2026-09-26T19:00:00Z', 15), at('2026-09-26T16:00:00Z', 1), at('2026-09-25T22:00:00Z', 4)];
    expect(sumComplete(grotto, 'hour', 24, t('2026-09-27T04:02:00Z'))).toBe(16);
    expect(sumComplete([at('2026-09-22T10:00:00Z', 7)], 'hour', 24, t('2026-09-27T04:02:00Z'))).toBeNull();
  });
});

describe('periodStart', () => {
  it('starts weeks on Monday, as the stats API stamps them', () => {
    expect(periodStart(t('2026-09-27T23:59:59Z'), 'week')).toBe(t('2026-09-21T00:00:00Z'));
    expect(periodStart(t('2026-09-21T00:00:00Z'), 'week')).toBe(t('2026-09-21T00:00:00Z'));
  });
});
