import { beforeEach, describe, expect, it, vi } from 'vitest';

const answerQuestion = vi.hoisted(() => vi.fn());

vi.mock('@/lib/explorer-query/answer', () => ({ answerQuestion, drillSql: vi.fn(), keptWords: vi.fn() }));
vi.mock('@/lib/explorer-query/visual', () => ({ designVisual: vi.fn() }));
vi.mock('@/lib/explorer-query/reading', () => ({ writeReading: vi.fn() }));
vi.mock('@/lib/explorer-query/clickhouse', () => ({ runQuery: vi.fn(), anchored: vi.fn(), indexState: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/sources', () => ({ sourceNotes: vi.fn(async () => []) }));
vi.mock('@/lib/explorer-query/monitor-feed', () => ({ monitorFor: vi.fn(async () => null) }));
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: vi.fn(async () => null) }));
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: vi.fn() }));

import { POST } from '@/app/api/explorer/query/route';

/* A suggested question runs fixed SQL and asks no model, so it counts as a read (120 an hour for one address) and
   not as a question (10 an hour signed out). Before, a reader who opened ten suggestions could ask nothing more.
   The limiter is the real one. */

const ask = (prompt: string, ip: string, history: unknown[] = []) =>
  POST(new Request('http://localhost/api/explorer/query', { method: 'POST', headers: { 'cf-connecting-ip': ip }, body: JSON.stringify({ chainId: 43114, prompt, history }) }));
const SUGGESTION = 'Most called methods';

beforeEach(() => {
  answerQuestion.mockReset().mockResolvedValue({ title: 't', note: 'n', sql: '', chart: { kind: 'none', series: [] }, result: null });
});

describe('the question limit', () => {
  it('leaves suggestions out: a reader opens many, and still has every question', async () => {
    for (let i = 0; i < 30; i++) expect((await ask(SUGGESTION, '198.51.100.20')).status).toBe(200);
    for (let i = 0; i < 10; i++) expect((await ask(`how many blocks today, take ${i}`, '198.51.100.20')).status).toBe(200);
    const over = await ask('one more typed question', '198.51.100.20');
    expect(over.status).toBe(429);
    expect((await over.json()).signIn).toBe(true);
    // the suggestions still open
    expect((await ask(SUGGESTION, '198.51.100.20')).status).toBe(200);
  });

  it('counts a suggestion as a read, and stops at the reads an address has', async () => {
    for (let i = 0; i < 120; i++) await ask(SUGGESTION, '198.51.100.21');
    const over = await ask(SUGGESTION, '198.51.100.21');
    expect(over.status).toBe(429);
    const out = await over.json();
    expect(out.error).toMatch(/^This address has run 120 queries this hour\. Try again /);
    expect(out.signIn).toBeUndefined();
  });

  it('counts a follow-up on a suggestion as a question: a model answers it', async () => {
    const turn = { prompt: SUGGESTION, sql: 'SELECT 1', title: 't' };
    for (let i = 0; i < 10; i++) expect((await ask(SUGGESTION, '198.51.100.22', [turn])).status).toBe(200);
    expect((await ask(SUGGESTION, '198.51.100.22', [turn])).status).toBe(429);
  });
});
