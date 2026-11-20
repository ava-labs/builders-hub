import { beforeEach, describe, expect, it, vi } from 'vitest';

const runKept = vi.hoisted(() => vi.fn());
const answerQuestion = vi.hoisted(() => vi.fn());
const totalsOf = vi.hoisted(() => vi.fn());

vi.mock('@/lib/explorer-query/answer', () => ({ answerQuestion, drillSql: vi.fn(), keptWords: vi.fn() }));
vi.mock('@/lib/explorer-query/run-cache', () => ({ runKept, isKept: vi.fn(() => false) }));
vi.mock('@/lib/explorer-query/visual', () => ({ designVisual: vi.fn() }));
vi.mock('@/lib/explorer-query/reading', () => ({ writeReading: vi.fn() }));
vi.mock('@/lib/explorer-query/clickhouse', () => ({ runQuery: vi.fn(), anchored: vi.fn(), indexState: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/enrich', () => ({ nameRows: vi.fn(async () => ({})) }));
vi.mock('@/lib/explorer-query/cut', () => ({ totalsOf, cutOf: vi.fn(() => null) }));
vi.mock('@/lib/explorer-query/cache', () => ({ getRecipe: vi.fn(async () => null), putVisual: vi.fn(async () => {}) }));
vi.mock('@/lib/explorer-query/sources', () => ({ sourceNotes: vi.fn(async () => []) }));
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: vi.fn(async () => null) }));
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: vi.fn() }));

import { POST } from '@/app/api/explorer/query/route';
import { fixedRecipe } from '@/lib/explorer-query/fixed';

/* The window buttons and the period before, through the route: the guard and the rewrite are the real ones, and
   only the database is mocked. No model is asked on either path. */

const C = 43114;
const fixed = fixedRecipe(C, 'Transactions per 5 minutes, with reverts')!;
const run = { result: { columns: [], rows: [{ t: '2026-11-10 12:00:00', txs: 9 }], rowCount: 1, truncated: false }, anchor: null, sources: [] };
const post = (body: object, chainId = C) =>
  POST(new Request('http://localhost/api/explorer/query', { method: 'POST', headers: { 'cf-connecting-ip': '198.51.100.9' }, body: JSON.stringify({ chainId, ...body }) }));

beforeEach(() => {
  runKept.mockReset().mockResolvedValue(run);
  answerQuestion.mockReset();
  totalsOf.mockReset().mockResolvedValue(null);
});

describe('POST { move }', () => {
  const move = (span: string, sql = fixed.sql) => post({ move: { sql, drill: fixed.drill?.sql, x: fixed.chart.x, span, title: fixed.title, note: fixed.note } });

  it('reads the answer again over the span, in the span\'s bucket and words', async () => {
    const res = await move('7d');
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(runKept).toHaveBeenCalledOnce();
    expect(runKept.mock.calls[0][0]).toContain('block_time >= toStartOfHour(now()) - INTERVAL 7 DAY');
    expect(out.sql).toBe(runKept.mock.calls[0][0]);
    expect(out.drill).toContain('toStartOfHour(block_time) = {{t}}');
    expect(out.title).toBe('Transactions per hour in the last 7 days, with reverts');
    expect(out.span).toBe('last 7 days');
    expect(out.moves).toEqual({ span: '7d', own: null, prior: true });
    expect(out.result.rows).toEqual(run.result.rows);
    expect(answerQuestion).not.toHaveBeenCalled();
  });

  it('refuses a query whose window it cannot move, and reads nothing', async () => {
    const res = await move('7d', "SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND block_time >= '2026-01-01'");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cannot move/);
    expect(runKept).not.toHaveBeenCalled();
  });

  it('refuses SQL that names another chain', async () => {
    const res = await move('7d', fixed.sql.replace('chain_id = 43114', 'chain_id = 1'));
    expect(res.status).toBe(400);
    expect(runKept).not.toHaveBeenCalled();
  });

  it('takes a span it does not know as no move', async () => {
    const res = await move('5y');
    // no button asks for it: the request holds nothing the route reads
    expect(res.status).toBe(400);
    expect(runKept).not.toHaveBeenCalled();
  });
});

describe('POST { prior }', () => {
  it('reads the same query over the period before, of the same length', async () => {
    const res = await post({ prior: { sql: fixed.sql, x: fixed.chart.x } });
    expect(res.status).toBe(200);
    expect(runKept.mock.calls[0][0]).toContain('block_time >= toStartOfFiveMinutes(now()) - INTERVAL 12 HOUR AND block_time < now() - INTERVAL 6 HOUR');
    expect(await res.json()).toEqual({ result: run.result, totals: null });
    expect(answerQuestion).not.toHaveBeenCalled();
  });

  it('refuses a query with no period before its window', async () => {
    const res = await post({ prior: { sql: 'SELECT count() AS n FROM raw_txs WHERE chain_id = 43114' } });
    expect(res.status).toBe(400);
    expect(runKept).not.toHaveBeenCalled();
  });
});

describe('POST { sql }', () => {
  it('returns the whole result\'s figures with rows a LIMIT cut, so a tile\'s figures stay whole after a refresh', async () => {
    const totals = { rows: 1689, newest: false, sum: { transfers: 1689 }, count: {}, min: {}, max: {}, distinct: {} };
    totalsOf.mockResolvedValue(totals);
    const res = await post({ sql: fixed.sql });
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.totals).toEqual(totals);
    // the totals are read for the SQL the guard passed, on the same chain
    expect(totalsOf).toHaveBeenCalledWith(out.sql, run.result, C);
    expect(answerQuestion).not.toHaveBeenCalled();
  });
});
