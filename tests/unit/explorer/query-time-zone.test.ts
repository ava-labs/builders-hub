import { describe, expect, it } from 'vitest';

import { zoneName, zoneStamp } from '@/components/explorer-v2/format';
import { chipRange, chipValue, fmtX, tipX, zoneOf } from '@/components/explorer-v2/evm/query-format';

// A Query chart's x reads in the viewer's time zone; the rows write UTC. Days, weeks and months keep the UTC day they
// count. Each case names its zone: CI runs in UTC, a laptop in its owner's zone.
const NY = 'America/New_York';
const KOLKATA = 'Asia/Kolkata';
const unix = (utc: string) => Date.parse(`${utc.replace(' ', 'T')}Z`) / 1000;

describe('the zone a chart x reads in', () => {
  it("is the viewer's for times inside a day", () => {
    expect(zoneOf(['2026-10-06 00:00:00', '2026-10-06 01:00:00'], NY)).toBe(NY);
    expect(zoneOf(['2026-10-06 14:05:00', '2026-10-06 14:06:00'], KOLKATA)).toBe(KOLKATA);
  });

  it('is UTC for days, weeks and months, which start at a UTC midnight', () => {
    expect(zoneOf(['2026-10-05', '2026-10-06'], NY)).toBe('UTC');
    expect(zoneOf(['2026-10-05 00:00:00', '2026-10-06 00:00:00'], NY)).toBe('UTC');
    expect(zoneOf(['2026-09-01', '2026-10-01'], NY)).toBe('UTC');
  });
});

describe('an axis tick', () => {
  it("writes a minute or an hour in the viewer's zone", () => {
    expect(fmtX('2026-10-06 00:00:00', 'minutes', NY)).toBe('20:00');
    expect(fmtX('2026-10-06 00:00:00', 'hours', NY)).toBe('10-05 20:00');
    expect(fmtX('2026-10-06 00:00:00', 'minutes', KOLKATA)).toBe('05:30');
  });

  it('writes a day as the UTC day it counts', () => {
    expect(fmtX('2026-10-06', 'days', 'UTC')).toBe('10-06');
    expect(fmtX('2026-10-06 00:00:00', 'days', 'UTC')).toBe('10-06');
  });

  it('writes UTC when no zone is named', () => {
    expect(fmtX('2026-10-06 02:29:00', 'minutes')).toBe('02:29');
  });
});

describe('a tooltip', () => {
  it('names the zone of a time of day, and none for a day', () => {
    expect(tipX('2026-10-06 02:29:00', 'minutes', NY)).toBe('22:29 EDT');
    expect(tipX('2026-10-06', 'days', 'UTC')).toBe('10-06');
  });
});

describe('a selection chip', () => {
  it("names a picked range in the viewer's zone, across the viewer's midnight", () => {
    expect(chipRange({}, 't', '2026-10-06 03:00:00', '2026-10-06 05:00:00', NY)).toBe('Oct 5 23:00 to Oct 6 01:00');
    expect(chipValue({}, 't', '2026-10-06 14:05:00', NY)).toBe('Oct 6 10:05');
  });

  it('names both zones of a range across a clock change', () => {
    // New York falls back at 06:00 UTC on 2026-11-01: 01:00 to 01:59 happens twice
    expect(chipRange({}, 't', '2026-11-01 05:00:00', '2026-11-01 06:30:00', NY)).toBe('Nov 1 01:00 EDT to 01:30 EST');
    expect(chipRange({}, 't', '2026-11-01 01:00:00', '2026-11-01 02:00:00', NY)).toBe('Oct 31 21:00 to 22:00');
  });

  it('names a day as the UTC day', () => {
    expect(chipRange({}, 'd', '2026-10-01', '2026-10-03', 'UTC')).toBe('Oct 1 to Oct 3');
    expect(chipValue({}, 'd', '2026-10-06', 'UTC')).toBe('Oct 6');
  });
});

describe("a time's wall clock in a zone", () => {
  it('follows daylight saving', () => {
    expect(zoneStamp(unix('2026-07-01 12:00:00'), NY)).toBe('2026-07-01 08:00:00');
    expect(zoneName(unix('2026-07-01 12:00:00'), NY)).toBe('EDT');
    // New York falls back at 06:00 UTC on 2026-11-01
    expect(zoneStamp(unix('2026-11-01 06:30:00'), NY)).toBe('2026-11-01 01:30:00');
    expect(zoneName(unix('2026-11-01 06:30:00'), NY)).toBe('EST');
  });

  it('writes midnight as 00, never 24', () => {
    expect(zoneStamp(unix('2026-10-06 04:00:00'), NY)).toBe('2026-10-06 00:00:00');
  });
});
