import { beforeEach, describe, expect, it, vi } from 'vitest';

const runKept = vi.hoisted(() => vi.fn());
const isKept = vi.hoisted(() => vi.fn(() => false));

vi.mock('@/lib/explorer-query/answer', () => ({ answerQuestion: vi.fn(), drillSql: vi.fn((sql: string) => ({ ok: true, sql })), keptWords: vi.fn() }));
vi.mock('@/lib/explorer-query/run-cache', () => ({ runKept, isKept }));
vi.mock('@/lib/explorer-query/visual', () => ({ designVisual: vi.fn(), writeReading: vi.fn() }));
vi.mock('@/lib/explorer-query/clickhouse', () => ({ runQuery: vi.fn(), anchored: vi.fn(), indexState: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/enrich', () => ({ nameRows: vi.fn(async () => ({})) }));
vi.mock('@/lib/explorer-query/cut', () => ({ totalsOf: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/guard', () => ({ guardSql: vi.fn((sql: string) => ({ ok: true, sql })) }));
vi.mock('@/lib/explorer-query/cache', () => ({ getRecipe: vi.fn(async () => null), putVisual: vi.fn(async () => {}) }));
vi.mock('@/lib/explorer-query/sources', () => ({ sourceNotes: vi.fn(async () => []) }));
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: vi.fn(async () => null) }));
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: vi.fn() }));

import { POST } from '@/app/api/explorer/query/route';
import { checkChatRateLimit } from '@/lib/chat/rateLimit';

/* Reads with no model in front of them (an edited query, a board's tile, a drill) ran with no limit before
   2026-10-07, on the stats-api key every reader shares. Each address now has 120 an hour that the run cache did not
   answer, apart from its questions. The limiter is the real one: only the database is mocked. */

const SQL = 'SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 HOUR';
const run = { result: { columns: [], rows: [{ n: 1 }], rowCount: 1, truncated: false }, anchor: null, sources: [] };
const post = (body: object, ip: string) =>
  POST(new Request('http://localhost/api/explorer/query', { method: 'POST', headers: { 'cf-connecting-ip': ip }, body: JSON.stringify({ chainId: 43114, ...body }) }));

beforeEach(() => {
  runKept.mockReset().mockResolvedValue(run);
  isKept.mockReset().mockReturnValue(false);
});

describe('reads with no model', () => {
  it('stop at 120 an hour per address, and run none past it', async () => {
    for (let i = 0; i < 120; i++) expect((await post({ sql: SQL }, '198.51.100.1')).status).toBe(200);
    const over = await post({ sql: SQL }, '198.51.100.1');
    expect(over.status).toBe(429);
    expect((await over.json()).error).toMatch(/^This address has run 120 queries this hour\. Try again /);
    expect(runKept).toHaveBeenCalledTimes(120);
    // a drill counts too, and another address keeps its own
    expect((await post({ drill: { sql: SQL, row: {} } }, '198.51.100.1')).status).toBe(429);
    expect((await post({ drill: { sql: SQL, row: {} } }, '198.51.100.2')).status).toBe(200);
  });

  it('count none that the run cache answers, since those read nothing', async () => {
    isKept.mockReturnValue(true);
    for (let i = 0; i < 130; i++) expect((await post({ sql: SQL }, '198.51.100.3')).status).toBe(200);
  });

  it("leave the address's questions their own budget", async () => {
    for (let i = 0; i < 121; i++) await post({ sql: SQL }, '198.51.100.4');
    expect(checkChatRateLimit('198.51.100.4', false).allowed).toBe(true);
  });
});
