import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/* Teleporter's fees are read a calendar month at a time (lib/icm-clickhouse.ts): the stats API's one-window read
   times out past about a month. Each fake month holds two days, the 1st and the 15th. */
const reads: string[] = [];
const live = { now: 0, max: 0 };
const failing = new Set<string>();
const store = new Map<string, { value: string; ex: number }>();
const redisUp = { on: true };

vi.mock('@/lib/stats-api', () => ({ statsApi: vi.fn(async () => null) }));
vi.mock('@/lib/redis', () => ({
  redis: vi.fn(async () =>
    redisUp.on
      ? {
          get: async (k: string) => store.get(k)?.value ?? null,
          set: async (k: string, value: string, o: { EX: number }) => void store.set(k, { value, ex: o.EX }),
        }
      : null,
  ),
}));
vi.mock('@/lib/explorer-query/clickhouse', () => ({
  runQuery: vi.fn(async (sql: string) => {
    const month = /block_time >= toDateTime\('(\d{4}-\d{2})-01/.exec(sql)![1];
    reads.push(month);
    live.now += 1;
    live.max = Math.max(live.max, live.now);
    await new Promise((r) => setTimeout(r, 5));
    live.now -= 1;
    if (failing.has(month)) throw new Error('Timeout exceeded');
    return { rows: [`${month}-01`, `${month}-15`].map((day) => ({ day, fees_paid: '1000000000000000000', tx_count: 10 })) };
  }),
}));

const load = async () => {
  vi.resetModules();
  return import('@/lib/icm-clickhouse');
};

// The first import of lib/icm-clickhouse loads viem, viem/chains and @x402 (0.6 s alone, 3 s and more under load).
// vi.resetModules() keeps those packages, so this hook pays for them once, outside the 5 s limit of a test.
beforeAll(async () => {
  await load();
}, 30_000);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
  reads.length = 0;
  live.now = live.max = 0;
  failing.clear();
  store.clear();
  redisUp.on = true;
});
afterEach(() => vi.useRealTimers());

describe('feeMonths', () => {
  it('lists each UTC month from the start to now, across a year end; a month is closed a day after it ends', async () => {
    const { feeMonths } = await load();
    const now = Date.now();
    const months = feeMonths(Date.UTC(2025, 8, 30), now);
    expect(months.map((m) => m.key)).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(months[3]).toEqual({ key: '2025-12', from: '2025-12-01', to: '2026-01-01', closed: true });
    expect(months.at(-1)).toEqual({ key: '2026-09', from: '2026-09-01', to: '2026-10-01', closed: false });
    // six hours into October, September has ended but may still be filling in
    const early = feeMonths(Date.UTC(2026, 8, 1), Date.parse('2026-10-01T06:00:00Z'));
    expect(early.map((m) => [m.key, m.closed])).toEqual([['2026-09', false], ['2026-10', false]]);
  });
});

describe('getICMContractFeesData', () => {
  it("reads a year as its 13 months, two at a time, and keeps only the window's days", async () => {
    const { getICMContractFeesData } = await load();
    const r = await getICMContractFeesData('1y');
    expect(r.dataSource).toBe('fresh');
    expect([...reads].sort()).toHaveLength(13);
    expect(new Set(reads).size).toBe(13);
    expect(live.max).toBe(2);
    // the window starts 2025-09-30: September 2025's two days are before it
    expect(r.data[0].date).toBe('2025-10-01');
    expect(r.data).toHaveLength(24);
    expect(r.totalFees).toBe(24e18);
  });

  it('reads each month once: a shorter window takes the months already read', async () => {
    const { getICMContractFeesData } = await load();
    await getICMContractFeesData('1y');
    reads.length = 0;
    const r = await getICMContractFeesData('30d');
    expect(reads).toEqual([]);
    expect(r.data.map((d) => d.date)).toEqual(['2026-09-01', '2026-09-15']);
  });

  it('keeps closed months in Redis 30 days and the current month 4 hours, and a new instance reads them from there', async () => {
    const first = await load();
    await first.getICMContractFeesData('1y');
    expect(store.get('icm:contract-fees:month:v1:2026-08')?.ex).toBe(30 * 86_400);
    expect(store.get('icm:contract-fees:month:v1:2026-09')?.ex).toBe(4 * 3_600);
    reads.length = 0;
    const second = await load();
    const r = await second.getICMContractFeesData('1y');
    expect(reads).toEqual([]);
    expect(r.data).toHaveLength(24);
  });

  it('answers empty when a month fails, starts no month after it, and the next read reads only what is missing', async () => {
    redisUp.on = false;
    failing.add('2026-03');
    const { getICMContractFeesData } = await load();
    const failed = await getICMContractFeesData('1y');
    expect(failed).toMatchObject({ data: [], totalFees: 0, dataSource: 'empty-fallback' });
    // 2026-03 is the 7th month: past it, at most the month already running on the other reader was started
    expect(reads.length).toBeLessThanOrEqual(8);
    failing.clear();
    const r = await getICMContractFeesData('1y');
    expect(r.dataSource).toBe('fresh');
    expect(r.data).toHaveLength(24);
    // each month was read once, and the failed one once more
    const times = (m: string) => reads.filter((x) => x === m).length;
    expect(times('2026-03')).toBe(2);
    expect(reads.filter((m) => m !== '2026-03').length).toBe(12);
    expect(new Set(reads).size).toBe(13);
  });

  it('reads a month once when two windows ask for it at the same time', async () => {
    const { getICMContractFeesData } = await load();
    await Promise.all([getICMContractFeesData('1y'), getICMContractFeesData('30d'), getICMContractFeesData('90d')]);
    expect(reads.length).toBe(13);
    expect(new Set(reads).size).toBe(13);
  });
});

describe('GET /api/icm-contract-fees', () => {
  it('lets no cache keep an empty answer after a failed read', async () => {
    vi.resetModules();
    vi.doMock('@/lib/icm-clickhouse', () => ({
      getICMContractFeesData: vi.fn(async (range: string) => ({ data: [], totalFees: 0, lastUpdated: new Date().toISOString(), dataSource: range === 'x' ? 'empty-fallback' : 'fresh' })),
    }));
    const { GET } = await import('@/app/api/icm-contract-fees/route');
    expect((await GET(new Request('http://localhost/api/icm-contract-fees?timeRange=x'))).headers.get('cache-control')).toBe('no-store');
    expect((await GET(new Request('http://localhost/api/icm-contract-fees?timeRange=1y'))).headers.get('cache-control')).toContain('s-maxage=14400');
    vi.doUnmock('@/lib/icm-clickhouse');
  });
});
