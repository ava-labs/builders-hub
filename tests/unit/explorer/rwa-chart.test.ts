import { describe, expect, it } from 'vitest';

import { runningRows, tickLabel, tipLabel } from '@/components/explorer-v2/defi/rwa-chart';

describe("the chart's cumulative view", () => {
  it('runs each series on its own and keeps the dates', () => {
    const rows = [
      { date: '2026-09-28', financed: 5, repaid: 1 },
      { date: '2026-10-05', financed: 0, repaid: 4 },
      { date: '2026-10-12', financed: 3, repaid: 0 },
    ];
    expect(runningRows(rows, ['financed', 'repaid'])).toEqual([
      { date: '2026-09-28', financed: 5, repaid: 1 },
      { date: '2026-10-05', financed: 5, repaid: 5 },
      { date: '2026-10-12', financed: 8, repaid: 5 },
    ]);
  });
});

describe("the chart's date labels", () => {
  it('name a day, the week that starts on a Monday, or a month', () => {
    expect(tickLabel('2026-10-01', 'daily')).toBe('Oct 1');
    expect(tickLabel('2026-09-28', 'weekly')).toBe('Sep 28');
    expect(tickLabel('2026-09-01', 'monthly')).toBe('Sep 2026');
    expect(tipLabel('2026-10-01', 'daily')).toBe('Thu, Oct 1, 2026');
    expect(tipLabel('2026-09-28', 'weekly')).toBe('Week of Sep 28, 2026');
    expect(tipLabel('2026-09-01', 'monthly')).toBe('September 2026');
  });
});
