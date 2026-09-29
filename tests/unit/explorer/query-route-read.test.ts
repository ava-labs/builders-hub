import { beforeEach, describe, expect, it, vi } from 'vitest';

const answerQuestion = vi.hoisted(() => vi.fn());
const runQuery = vi.hoisted(() => vi.fn());
const designVisual = vi.hoisted(() => vi.fn());
const writeReading = vi.hoisted(() => vi.fn());
const recipes = vi.hoisted(() => new Map<string, unknown>());
// the words the page shows for a kept recipe: the route lays out and reads from these, not the recipe's own
const keptWords = vi.hoisted(() => vi.fn((r: { title: string; note: string }) => ({ title: `${r.title} as shown`, note: r.note })));

vi.mock('@/lib/explorer-query/answer', () => ({ answerQuestion, drillSql: vi.fn(), keptWords }));
vi.mock('@/lib/explorer-query/visual', () => ({ designVisual, writeReading }));
vi.mock('@/lib/explorer-query/clickhouse', () => ({ runQuery, anchored: vi.fn(async (sql: string) => ({ sql, anchor: null, sources: [] })), indexState: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/enrich', () => ({ nameRows: vi.fn(async () => ({})) }));
vi.mock('@/lib/explorer-query/cut', () => ({ totalsOf: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/guard', () => ({ guardSql: vi.fn((sql: string) => ({ ok: true, sql })) }));
vi.mock('@/lib/explorer-query/cache', () => ({ getRecipe: vi.fn(async (k: string) => recipes.get(k) ?? null), putVisual: vi.fn(async () => {}) }));
vi.mock('@/lib/explorer-query/sources', () => ({ sourceNotes: vi.fn(async () => []) }));
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: vi.fn(async () => null) }));
vi.mock('@/lib/chat/rateLimit', () => ({ checkChatRateLimit: vi.fn(() => ({ allowed: true, limit: 10, resetTime: 0 })), formatResetTime: vi.fn(() => 'soon'), getClientIP: vi.fn(() => '192.0.2.1') }));

import { POST } from '@/app/api/explorer/query/route';

const post = (body: unknown) => POST(new Request('http://localhost/api/explorer/query', { method: 'POST', body: JSON.stringify(body) }));
const key = 'a'.repeat(32);
const rows = [{ from_address: '0x1', to_address: '0x2', usdc: 5 }];
const result = { columns: [], rows, rowCount: 1, truncated: false };
const recipe = { question: 'Where did USDC go?', title: 't', note: 'n', sql: 'SELECT 1', chart: { kind: 'table', series: [] }, drill: null, visual: null, writer: 'w', at: 0 };

beforeEach(() => {
  for (const f of [answerQuestion, runQuery, designVisual, writeReading]) f.mockReset();
  recipes.clear();
  designVisual.mockResolvedValue({ visual: { stats: [], panels: [], callouts: [] }, ms: 1, fromDesigner: true });
});

describe('the layout of an answer', () => {
  it('is designed from the rows the answer just read, with no second read', async () => {
    answerQuestion.mockResolvedValue({ title: 't', note: 'n', sql: 'SELECT 1', chart: recipe.chart, result, names: { from_address: {} }, totals: null, anchor: null, key });
    recipes.set(key, recipe);
    await (await post({ chainId: 43114, prompt: 'Where did USDC go?' })).text();
    const res = await post({ chainId: 43114, key });
    expect(res.status).toBe(200);
    expect(runQuery).not.toHaveBeenCalled();
    expect(designVisual).toHaveBeenCalledWith(expect.objectContaining({ rows, names: { from_address: {} }, question: 'Where did USDC go?', title: 't as shown' }));
  });

  it("writes a kept layout's reading from the words the page shows", async () => {
    const kept = 'd'.repeat(32);
    recipes.set(kept, { ...recipe, visual: { stats: [], panels: [], callouts: [] } });
    runQuery.mockResolvedValue(result);
    writeReading.mockResolvedValue(['One callout.']);
    const res = await post({ chainId: 43114, key: kept, reading: true });
    expect(res.status).toBe(200);
    expect(writeReading).toHaveBeenCalledWith(expect.objectContaining({ title: 't as shown', note: 'n' }));
  });

  it('forgets the read after a minute and reads the kept SQL again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
      const late = 'c'.repeat(32);
      answerQuestion.mockResolvedValue({ title: 't', note: 'n', sql: 'SELECT 1', chart: recipe.chart, result, names: {}, totals: null, anchor: null, key: late });
      recipes.set(late, recipe);
      await (await post({ chainId: 43114, prompt: 'Where did USDC go?' })).text();
      vi.setSystemTime(new Date('2026-09-27T12:01:00.001Z'));
      runQuery.mockResolvedValue(result);
      expect((await post({ chainId: 43114, key: late })).status).toBe(200);
      expect(runQuery).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads the kept SQL again when this instance did not answer it', async () => {
    const other = 'b'.repeat(32);
    recipes.set(other, recipe);
    runQuery.mockResolvedValue(result);
    const res = await post({ chainId: 43114, key: other });
    expect(res.status).toBe(200);
    expect(runQuery).toHaveBeenCalledOnce();
    expect(designVisual).toHaveBeenCalledWith(expect.objectContaining({ rows }));
  });
});
