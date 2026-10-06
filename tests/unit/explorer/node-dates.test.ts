import { describe, expect, it } from 'vitest';

import { dayShort, localDayShort, localHourLong } from '@/components/explorer-v2/format';
import { wholeDays } from '@/components/explorer-v2/pchain/node-data';

/* On 2026-10-05 at 20:10 EDT (00:10 UTC on Oct 6) the node page's charts
   ended at "Oct 6": the uptime hour 00:00 UTC and the blocks of a UTC day
   10 minutes old. A viewer in New York still had Oct 5. */

const FIRST_HOUR_OF_OCT_6 = '2026-10-06T00:00';

describe('an hour of the uptime chart', () => {
  it('names the day in the viewer time zone, not in UTC', () => {
    expect(dayShort(FIRST_HOUR_OF_OCT_6)).toBe('Oct 6');
    expect(localDayShort(FIRST_HOUR_OF_OCT_6, 'America/New_York')).toBe('Oct 5');
    expect(localDayShort(FIRST_HOUR_OF_OCT_6, 'UTC')).toBe('Oct 6');
    expect(localDayShort(FIRST_HOUR_OF_OCT_6, 'Asia/Tokyo')).toBe('Oct 6');
  });

  it('names the hour and the zone in the tooltip', () => {
    expect(localHourLong(FIRST_HOUR_OF_OCT_6, 'America/New_York')).toBe('Mon, Oct 5 · 20:00 EDT');
    expect(localHourLong(FIRST_HOUR_OF_OCT_6, 'UTC')).toBe('Tue, Oct 6 · 00:00 UTC');
  });

  it('passes a value that is not a date through', () => {
    expect(localDayShort('snapshot')).toBe('snapshot');
    expect(localHourLong('snapshot')).toBe('snapshot');
  });
});

describe('the days of the blocks chart', () => {
  const days = ['2026-10-04', '2026-10-05', '2026-10-06'].map((d) => ({ hour: `${d}T00:00:00Z`, proposed: 1, missed: 0 }));

  it('leave out the UTC day that is still running', () => {
    const now = Date.parse('2026-10-06T00:10:00Z');
    expect(wholeDays(days, now).map((d) => d.hour.slice(0, 10))).toEqual(['2026-10-04', '2026-10-05']);
  });

  it('keep a day from the moment it ends', () => {
    const now = Date.parse('2026-10-07T00:00:00Z');
    expect(wholeDays(days, now)).toHaveLength(3);
  });
});
