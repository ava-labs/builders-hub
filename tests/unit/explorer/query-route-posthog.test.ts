import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// the PostHog helper reads its key as it loads
vi.hoisted(() => {
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://posthog.example');
});
const answerQuestion = vi.hoisted(() => vi.fn());
const designVisual = vi.hoisted(() => vi.fn());
const monitorFor = vi.hoisted(() => vi.fn(async (): Promise<unknown> => null));
const checkChatRateLimit = vi.hoisted(() => vi.fn(() => ({ allowed: true, limit: 10, resetTime: 0 })));
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
const recipes = vi.hoisted(() => new Map<string, unknown>());
// the work the route leaves for after its response, run when a test says the response is out
const later = vi.hoisted(() => [] as (() => unknown)[]);

vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: (fn: () => unknown) => void later.push(fn) }));
vi.mock('@/lib/explorer-query/answer', () => ({ answerQuestion, drillSql: vi.fn(), keptWords: vi.fn((r: { title: string; note: string }) => ({ title: r.title, note: r.note })) }));
vi.mock('@/lib/explorer-query/visual', () => ({ designVisual, writeReading: vi.fn() }));
vi.mock('@/lib/explorer-query/monitor-feed', () => ({ monitorFor }));
vi.mock('@/lib/explorer-query/monitor', () => ({ monitorNote: vi.fn(() => 'Live from the chain.') }));
vi.mock('@/lib/explorer-query/clickhouse', () => ({ runQuery: vi.fn(async () => ({ columns: [], rows: [{ n: 1 }], rowCount: 1, truncated: false })), anchored: vi.fn(async (sql: string) => ({ sql, anchor: null, sources: [] })), indexState: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/enrich', () => ({ nameRows: vi.fn(async () => ({})) }));
vi.mock('@/lib/explorer-query/cut', () => ({ totalsOf: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/guard', () => ({ guardSql: vi.fn((sql: string) => ({ ok: true, sql })) }));
vi.mock('@/lib/explorer-query/cache', () => ({ getRecipe: vi.fn(async (k: string) => recipes.get(k) ?? null), putVisual: vi.fn(async () => {}) }));
vi.mock('@/lib/explorer-query/sources', () => ({ sourceNotes: vi.fn(async () => []) }));
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: vi.fn(async () => session.current) }));
vi.mock('@/lib/chat/rateLimit', () => ({ checkChatRateLimit, formatResetTime: vi.fn(() => 'soon'), getClientIP: vi.fn(() => '192.0.2.1') }));

import { POST } from '@/app/api/explorer/query/route';
import type { ModelCall } from '@/lib/explorer-query/meter';

type Sent = { event: string; distinct_id: string; properties: Record<string, unknown> };
const sent: Sent[] = [];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const key = 'e'.repeat(32);
const step: ModelCall = { model: 'claude-sonnet-5-5', ms: 1500, input: 1200, cacheRead: 31_800, cacheWrite: 900, output: 450 };
const page = { 'x-posthog-distinct-id': 'anon-1', 'x-posthog-session-id': 's-1' };

const post = (body: unknown, headers: Record<string, string> = page) => POST(new Request('http://localhost/api/explorer/query', { method: 'POST', headers, body: JSON.stringify(body) }));
const lines = async (res: Response) => (await res.text()).trim().split('\n').map((l) => JSON.parse(l) as { type: string; answer?: { trace?: string } });
const responseOut = async () => {
  for (const fn of later.splice(0)) await fn();
};

beforeEach(() => {
  sent.length = 0;
  later.length = 0;
  session.current = null;
  recipes.clear();
  for (const f of [answerQuestion, designVisual]) f.mockReset();
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)) as Sent);
    return new Response('{}');
  }));
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('what the query route tells PostHog', () => {
  it('sends a question with what its writer cost before the stream ends, and hands the page its trace', async () => {
    answerQuestion.mockImplementation(async (a: { spent: (c: ModelCall) => void; emit: (e: unknown) => void }) => {
      a.spent(step);
      a.emit({ type: 'stage', stage: 'escalated', writer: 'Sonnet 5.5 medium' });
      a.spent(step);
      return { title: 'GMX activity', note: '', sql: 'SELECT 1', chart: { kind: 'table', series: [] }, drill: null, result: null, names: {}, visual: null, coverage: null, key, model: { steps: 5, ms: 3000, tries: 2, writer: 'Sonnet 5.5 medium', cached: false } };
    });
    const events = await lines(await post({ chainId: 43114, prompt: 'GMX activity last 7 days' }));
    const trace = events.at(-1)?.answer?.trace;
    expect(trace).toMatch(UUID);
    expect(sent.map((e) => e.event).sort()).toEqual(['$ai_generation', 'explorer_query_asked']);
    expect(sent.find((e) => e.event === 'explorer_query_asked')).toMatchObject({
      distinct_id: 'anon-1',
      properties: { question: 'GMX activity last 7 days', chain_id: 43114, source: 'writer', answered: true, escalated: true, model_calls: 2, trace_id: trace, $session_id: 's-1', $process_person_profile: false },
    });
    expect(sent.find((e) => e.event === '$ai_generation')?.properties).toMatchObject({ $ai_trace_id: trace, $ai_span_name: 'writer', steps: 2, answer_key: key });
  });

  it("counts a layout's designer calls, once the response is out, under the trace of the question it serves", async () => {
    const trace = '0192f4c1-1b2c-4d3e-8f40-123456789abc';
    recipes.set(key, { question: 'GMX activity last 7 days', title: 'GMX activity', note: '', sql: 'SELECT 1', chart: { kind: 'table', series: [] }, drill: null, visual: null, writer: 'w', at: 0 });
    designVisual.mockImplementation(async (input: { spent: (c: ModelCall) => void }) => {
      input.spent({ model: 'claude-opus-5-5', ms: 4000, input: 3000, cacheRead: 0, cacheWrite: 2500, output: 800 });
      return { visual: { stats: [], panels: [], callouts: [] }, ms: 4000, fromDesigner: true, steps: 1, refused: [] };
    });
    expect((await post({ chainId: 43114, key, trace })).status).toBe(200);
    expect(sent).toEqual([]);
    await responseOut();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ event: '$ai_generation', distinct_id: 'anon-1', properties: { $ai_trace_id: trace, $ai_span_name: 'designer', $ai_model: 'claude-opus-5-5', $ai_input: [{ role: 'user', content: 'GMX activity last 7 days' }], answer_key: key } });
  });

  it('counts a signed-in asker by their user id, with a person profile', async () => {
    session.current = { user: { id: 'user-7' } };
    answerQuestion.mockResolvedValue({ title: 'Blocks per hour', note: '', sql: 'SELECT 1', chart: { kind: 'table', series: [] }, drill: null, result: null, names: {}, visual: null, coverage: null, model: { steps: 0, ms: 80, tries: 0, writer: 'fixed SQL', cached: true } });
    await lines(await post({ chainId: 43114, prompt: 'Blocks per hour today' }));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ event: 'explorer_query_asked', distinct_id: 'user-7', properties: { source: 'suggestion', signed_in: true, model_calls: 0, cost_usd: 0 } });
    expect(sent[0].properties).not.toHaveProperty('$process_person_profile');
  });

  it('counts a live monitor once the response is out, and a question over the limit as limited', async () => {
    monitorFor.mockResolvedValueOnce({ chainId: 43114, kind: 'transfers', title: 'USDC transfers' });
    await lines(await post({ chainId: 43114, prompt: 'monitor USDC transfers' }));
    expect(sent).toEqual([]);
    await responseOut();
    expect(sent[0]).toMatchObject({ event: 'explorer_query_asked', properties: { question: 'monitor USDC transfers', source: 'monitor', answered: true, title: 'USDC transfers', model_calls: 0 } });

    sent.length = 0;
    checkChatRateLimit.mockReturnValueOnce({ allowed: false, limit: 10, resetTime: 0 });
    expect((await post({ chainId: 43114, prompt: 'GMX activity last 7 days' })).status).toBe(429);
    await responseOut();
    expect(answerQuestion).not.toHaveBeenCalled();
    expect(sent[0]).toMatchObject({ event: 'explorer_query_asked', properties: { answered: false, status: 429, source: null } });
  });

  it('sends nothing for a prompt with no words', async () => {
    expect((await post({ chainId: 43114, prompt: '??' })).status).toBe(400);
    await responseOut();
    expect(sent).toEqual([]);
  });
});
