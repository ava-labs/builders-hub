import { describe, expect, it } from 'vitest';
import { windowSpan, withWindow } from '@/lib/explorer-query/scope';

/* A table of a set as it stands now (p_subnets) has dates in its rows: the day each subnet was created. A query
   over it has no time bound, so the window came from those dates, and "Subnets created per year and active today"
   was titled "... active since the chain began": false, the count is of today's sets. */

const NOW = Date.parse('2026-11-11T03:40:00Z');
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => ({ t: `${y}-01-01`, created: 1, active_now: 1 }));
const SUBNETS = 'SELECT toStartOfYear(created_at) AS t, count() AS created, countIf(validators > 0) AS active_now FROM p_subnets WHERE chain_id = 1 GROUP BY t ORDER BY t';
const NOTE = 'Active means the subnet has validators in its set now.';
const title = (said: string, sql: string) => withWindow({ title: said, note: NOTE }, sql, YEARS, 't', NOW).title;

describe('the title of a query over a set as it stands now', () => {
  it('keeps today, and takes no window from the dates in its rows', () => {
    expect(title('Subnets created per year and active today', SUBNETS)).toBe('Subnets created per year and active today');
    expect(title('L1s with validators today', SUBNETS)).toBe('L1s with validators today');
    // a figure over the whole answer names no window either
    expect(windowSpan(SUBNETS, YEARS, 't', NOW)).toBeNull();
  });

  it('holds through a WITH of the query\'s own and a filled series', () => {
    const own = `WITH live AS (SELECT toStartOfYear(created_at) AS t, count() AS created FROM p_subnets WHERE chain_id = 1 AND validators > 0 GROUP BY t) SELECT t, created FROM live ORDER BY t WITH FILL FROM toDate('2020-01-01') TO toDate(now()) STEP INTERVAL 1 YEAR`;
    expect(title('Subnets with validators today, by the year they were created', own)).toBe('Subnets with validators today, by the year they were created');
  });

  it('leaves every other query as it was: its rows\' dates are its window', () => {
    // a table with a history, read with no bound of its own
    const daily = 'SELECT t, total_supply_avax FROM p_avax_supply_daily WHERE chain_id = 1 ORDER BY t';
    expect(title('AVAX supply per year', daily)).toBe('AVAX supply per year since the chain began');
    // and a join of a standing table with one that has a history
    const joined = `${SUBNETS.replace('FROM p_subnets', 'FROM p_subnets INNER JOIN p_avax_supply_daily AS d ON d.t = toDate(created_at)')}`;
    expect(title('Subnets created per year', joined)).toBe('Subnets created per year since the chain began');
  });
});
