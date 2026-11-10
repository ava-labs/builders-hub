import { describe, it, expect } from 'vitest';
import {
  formatDay,
  formatMonth,
  maskEmailFallback,
  periodRange,
} from '@/server/services/builderInsights';

/**
 * Chart buckets are UTC (they are cached and shared across viewers), while the
 * referral drill-down resolves a period in the zone the viewer means — "the
 * referrals from our event on the 15th" is the 15th where the event happened.
 * Neither may depend on the timezone of the server process.
 */
describe('builder insights — bucket formatting', () => {
  it('formats Postgres date/timestamp values as UTC buckets', () => {
    const ts = new Date('2026-11-15T23:30:00.000Z');
    expect(formatDay(ts)).toBe('2026-11-15');
    expect(formatMonth(ts)).toBe('2026-11');
  });

  it('formats HogQL date strings as UTC buckets', () => {
    expect(formatDay('2026-11-15')).toBe('2026-11-15');
    expect(formatMonth('2026-11-01')).toBe('2026-11');
  });
});

describe('builder insights — periodRange', () => {
  it('spans exactly 24h in UTC, half-open, so midnight belongs to one day only', () => {
    const { start, end } = periodRange('2026-11-15', 'UTC');
    expect(start.toISOString()).toBe('2026-11-15T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-16T00:00:00.000Z');
    expect(periodRange('2026-11-16', 'UTC').start.getTime()).toBe(end.getTime());
  });

  it('rolls a day over a month and year boundary', () => {
    expect(periodRange('2026-12-31', 'UTC').end.toISOString()).toBe(
      '2027-01-01T00:00:00.000Z'
    );
    expect(periodRange('2026-02-28', 'UTC').end.toISOString()).toBe(
      '2026-03-01T00:00:00.000Z'
    );
  });

  it('treats a YYYY-MM period as a whole calendar month', () => {
    const { start, end } = periodRange('2026-11', 'UTC');
    expect(start.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(periodRange('2026-12', 'UTC').end.toISOString()).toBe(
      '2027-01-01T00:00:00.000Z'
    );
  });

  it('shifts the window to the requested zone, not the host process', () => {
    // Istanbul is UTC+3 year-round: the local 15th starts at 21:00Z on the 14th,
    // so an evening sign-up there belongs to the 15th, not the 16th.
    const { start, end } = periodRange('2026-11-15', 'Europe/Istanbul');
    expect(start.toISOString()).toBe('2026-11-14T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-15T21:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('gives a DST-shortened day its real 23 hours', () => {
    // 2026-03-29 is the EU spring-forward: Europe/Vienna loses an hour.
    const { start, end } = periodRange('2026-03-29', 'Europe/Vienna');
    expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
    // A UTC day over the same date is unaffected.
    const utc = periodRange('2026-03-29', 'UTC');
    expect(utc.end.getTime() - utc.start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('falls back to UTC for an unknown zone rather than throwing', () => {
    expect(periodRange('2026-11-15', 'Mars/Olympus_Mons').start.toISOString()).toBe(
      '2026-11-15T00:00:00.000Z'
    );
  });
});

/**
 * Referrers without a profile name fall back to their email address, and this
 * dashboard gets screenshotted — show enough to recognise a colleague, not a
 * reachable address.
 */
describe('builder insights — maskEmailFallback', () => {
  it('truncates an email at the domain', () => {
    expect(maskEmailFallback('alice@example.com')).toBe('alice@…');
    expect(maskEmailFallback('a.b+tag@sub.example.co.uk')).toBe('a.b+tag@…');
  });

  it('leaves real names and the Unknown sentinel alone', () => {
    expect(maskEmailFallback('Alice Smith')).toBe('Alice Smith');
    expect(maskEmailFallback('Unknown')).toBe('Unknown');
    // A handle-ish name with an @ but no domain is not an address.
    expect(maskEmailFallback('@alice')).toBe('@alice');
    expect(maskEmailFallback('alice@handle')).toBe('alice@handle');
  });
});

/**
 * The route's period regex is the only thing standing between a typo'd URL and
 * a silently wrong window: getDateWithTimezone rolls "2026-13-45" over into a
 * real instant rather than rejecting it.
 */
describe('builder insights — period param shape', () => {
  const PERIOD = /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/;

  it('accepts a day and a month', () => {
    expect(PERIOD.test('2026-09-15')).toBe(true);
    expect(PERIOD.test('2026-09')).toBe(true);
    expect(PERIOD.test('2026-12-31')).toBe(true);
  });

  it('rejects out-of-range months and days that would roll over silently', () => {
    expect(PERIOD.test('2026-13-45')).toBe(false);
    expect(PERIOD.test('2026-00')).toBe(false);
    expect(PERIOD.test('2026-09-00')).toBe(false);
    expect(PERIOD.test('2026-09-32')).toBe(false);
    expect(PERIOD.test('2026-9-1')).toBe(false);
    expect(PERIOD.test('')).toBe(false);
  });
});
