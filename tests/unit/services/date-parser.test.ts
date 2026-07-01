import { describe, it, expect } from 'vitest';
import { getDateWithTimezone } from '@/server/services/date-parser';

/**
 * A naive wall-clock string ("YYYY-MM-DDTHH:MM") entered in the event editor
 * represents a wall-clock time in the event's selected timezone. Persisting it
 * must produce the correct absolute UTC instant, and the result must NOT depend
 * on the timezone of the server process running this code.
 */
describe('getDateWithTimezone — naive wall-clock in a timezone', () => {
  it('interprets a UTC wall-clock verbatim', () => {
    expect(getDateWithTimezone('2026-07-01T11:00', 'UTC').toISOString()).toBe(
      '2026-07-01T11:00:00.000Z'
    );
  });

  it('interprets a fixed-offset (+3) zone', () => {
    // Europe/Moscow is UTC+3 year-round → 11:00 local == 08:00 UTC.
    expect(
      getDateWithTimezone('2026-07-01T11:00', 'Europe/Moscow').toISOString()
    ).toBe('2026-07-01T08:00:00.000Z');
  });

  it('honours daylight saving (summer, New York = UTC-4)', () => {
    expect(
      getDateWithTimezone('2026-07-01T15:00', 'America/New_York').toISOString()
    ).toBe('2026-07-01T19:00:00.000Z');
  });

  it('honours standard time (winter, New York = UTC-5)', () => {
    expect(
      getDateWithTimezone('2026-01-15T15:00', 'America/New_York').toISOString()
    ).toBe('2026-01-15T20:00:00.000Z');
  });

  it('handles half-hour offsets (Kolkata = UTC+5:30)', () => {
    expect(
      getDateWithTimezone('2026-07-01T11:00', 'Asia/Kolkata').toISOString()
    ).toBe('2026-07-01T05:30:00.000Z');
  });

  it('falls back to UTC for an unknown/empty timezone', () => {
    expect(getDateWithTimezone('2026-07-01T11:00', '').toISOString()).toBe(
      '2026-07-01T11:00:00.000Z'
    );
  });

  it('treats an explicit numeric offset as an absolute instant', () => {
    // "+03:00" already pins the instant → timezone arg is irrelevant.
    expect(
      getDateWithTimezone('2026-07-01T11:00:00+03:00', 'America/New_York').toISOString()
    ).toBe('2026-07-01T08:00:00.000Z');
  });
});
