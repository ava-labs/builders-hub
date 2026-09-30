import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateText } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';

// the PostHog helper reads its key as it loads
vi.hoisted(() => {
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://posthog.example');
});
// the metered model wraps what the provider makes: here a mock, whose reply each test sets
const reply = vi.hoisted(() => ({ next: (): unknown => null }));
vi.mock('@ai-sdk/anthropic', async () => {
  const { MockLanguageModelV3: Mock } = await import('ai/test');
  return { createAnthropic: () => (id: string) => new Mock({ modelId: id, doGenerate: async () => reply.next() as never }) };
});

import { claudeCost } from '@/lib/posthog-server';
import { anthropic, type ModelCall } from '@/lib/explorer-query/meter';
import { askerOf, sendQuestion, sendStage, sourceOf } from '@/lib/explorer-query/analytics';
import type { QueryAnswer } from '@/lib/explorer-query/types';

type Sent = { api_key: string; event: string; distinct_id: string; properties: Record<string, unknown> };
const sent: { url: string; body: Sent }[] = [];

beforeEach(() => {
  sent.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)) as Sent });
    return new Response('{}');
  }));
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// one writer step as the traces see it: the prompt read from the cache, the new turn written to it
const step: ModelCall = { model: 'claude-sonnet-5-5', ms: 2000, input: 1200, cacheRead: 31_800, cacheWrite: 900, output: 450 };
// (1,200 x $2 + 900 x $2.50 + 31,800 x $0.20 + 450 x $10) per million tokens
const STEP_USD = 0.01551;
const TRACE = '0192f4c1-1b2c-4d3e-8f40-123456789abc';

const answer = (over: Partial<QueryAnswer> = {}): QueryAnswer => ({ title: 'GMX activity', note: '', sql: 'SELECT 1', chart: { kind: 'table', series: [] }, drill: null, result: null, names: {}, visual: null, coverage: null, ...over });
const byEvent = (event: string) => sent.filter((s) => s.body.event === event).map((s) => s.body);

describe('claudeCost', () => {
  it('prices the uncached input, the cache writes, the cache reads and the output apart, at list prices', () => {
    const sonnet = claudeCost('claude-sonnet-5-5', { input: 1_000_000, cacheWrite: 1_000_000, cacheRead: 1_000_000, output: 1_000_000 })!;
    expect(sonnet.input).toBeCloseTo(2 + 2.5 + 0.2, 9);
    expect(sonnet.output).toBeCloseTo(10, 9);
    const opus = claudeCost('claude-opus-5-5', { input: 1_000_000, cacheWrite: 1_000_000, cacheRead: 1_000_000, output: 1_000_000 })!;
    expect(opus.total).toBeCloseTo(4 + 5 + 0.2 + 20, 9);
    expect(claudeCost('claude-sonnet-5-5', step)!.total).toBeCloseTo(STEP_USD, 9);
    expect(claudeCost('claude-unknown-1', step)).toBeNull();
  });
});

describe('the metered model', () => {
  it("reports each call's time and its tokens, the uncached input apart from the cache", async () => {
    reply.next = () => ({
      content: [{ type: 'text', text: 'ok' }],
      finishReason: { unified: 'stop', raw: 'end_turn' },
      usage: { inputTokens: { total: 33_900, noCache: 1200, cacheRead: 31_800, cacheWrite: 900 }, outputTokens: { total: 450, text: 450, reasoning: undefined } },
      warnings: [],
    });
    const calls: ModelCall[] = [];
    await generateText({ model: anthropic('claude-sonnet-5-5', (c) => calls.push(c)), prompt: 'q' });
    expect(calls).toEqual([{ model: 'claude-sonnet-5-5', ms: expect.any(Number), input: 1200, cacheRead: 31_800, cacheWrite: 900, output: 450 }]);
  });

  it('reports a failed call with its error and no tokens, and still fails', async () => {
    reply.next = () => {
      throw new Error('Overloaded');
    };
    const calls: ModelCall[] = [];
    await expect(generateText({ model: anthropic('claude-opus-5-5', (c) => calls.push(c)), prompt: 'q', maxRetries: 0 })).rejects.toThrow('Overloaded');
    expect(calls).toEqual([{ model: 'claude-opus-5-5', ms: expect.any(Number), input: 0, cacheRead: 0, cacheWrite: 0, output: 0, error: 'Overloaded' }]);
  });

  it("is the provider's own model when nothing is metered", () => {
    expect(anthropic('claude-sonnet-5-5')).toBeInstanceOf(MockLanguageModelV3);
  });
});

describe('askerOf', () => {
  const req = (headers: Record<string, string>) => new Request('http://localhost/api/explorer/query', { method: 'POST', headers });

  it("counts a signed-in asker by their user id, and anyone else by the page's PostHog id", () => {
    expect(askerOf(req({ 'x-posthog-distinct-id': 'anon-1', 'x-posthog-session-id': 's-1' }), 'user-7')).toEqual({ id: 'user-7', signedIn: true, session: 's-1' });
    expect(askerOf(req({ 'x-posthog-distinct-id': TRACE }))).toEqual({ id: TRACE, signedIn: false, session: undefined });
  });

  it('gives an asker with no usable id a fresh one', () => {
    for (const id of ['', 'two words', 'x'.repeat(201)]) {
      const who = askerOf(req(id ? { 'x-posthog-distinct-id': id } : {}));
      expect(who.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(who.signedIn).toBe(false);
    }
  });
});

describe('sourceOf', () => {
  it('names what answered: a monitor, the other chain, a kept or a fixed recipe, or the writer', () => {
    const model = { steps: 0, ms: 1, tries: 0 };
    expect(sourceOf(answer({ monitor: {} as QueryAnswer['monitor'] }), [])).toBe('monitor');
    expect(sourceOf(answer({ route: 'p-chain' }), [])).toBe('route');
    expect(sourceOf(answer({ key: 'k', model: { ...model, cached: true } }), [])).toBe('kept');
    expect(sourceOf(answer({ model: { ...model, cached: true } }), [])).toBe('suggestion');
    expect(sourceOf(answer({ key: 'k', model: { ...model, cached: false } }), [step])).toBe('writer');
    expect(sourceOf(null, [step])).toBe('writer');
    expect(sourceOf(null, [])).toBeNull();
  });
});

describe('sendQuestion', () => {
  const asked = { trace: TRACE, chainId: 43114, chain: 'Avalanche C-Chain', question: 'GMX activity last 7 days', followUp: false, ms: 5400 };

  it('sends the question with what answered it and its cost, and the writer as one generation', async () => {
    const result = { columns: [], rows: [], rowCount: 7, truncated: false };
    await sendQuestion({ ...asked, who: { id: 'anon-1', signedIn: false, session: 's-1' }, source: 'writer', answer: answer({ key: 'k1', result, model: { steps: 4, ms: 5400, tries: 3, writer: 'Sonnet 5.5 low', cached: false } }), calls: [step, step] });
    expect(sent.map((s) => s.url)).toEqual(['https://posthog.example/capture/', 'https://posthog.example/capture/']);
    const [q] = byEvent('explorer_query_asked');
    expect(q).toMatchObject({
      api_key: 'phc_test',
      distinct_id: 'anon-1',
      properties: {
        question: 'GMX activity last 7 days',
        chain_id: 43114,
        source: 'writer',
        answered: true,
        title: 'GMX activity',
        rows: 7,
        writer: 'Sonnet 5.5 low',
        steps: 4,
        tries: 3,
        signed_in: false,
        model_calls: 2,
        input_tokens: 2400,
        cache_read_tokens: 63_600,
        cache_write_tokens: 1800,
        output_tokens: 900,
        trace_id: TRACE,
        $session_id: 's-1',
        $process_person_profile: false,
        $geoip_disable: true,
      },
    });
    expect(q.properties.cost_usd as number).toBeCloseTo(2 * STEP_USD, 9);
    const [g] = byEvent('$ai_generation');
    expect(g).toMatchObject({
      distinct_id: 'anon-1',
      properties: {
        $ai_trace_id: TRACE,
        $ai_span_name: 'writer',
        $ai_model: 'claude-sonnet-5-5',
        $ai_provider: 'anthropic',
        $ai_input: [{ role: 'user', content: 'GMX activity last 7 days' }],
        $ai_output_choices: [{ role: 'assistant', content: 'GMX activity' }],
        $ai_input_tokens: 2400,
        $ai_cache_read_input_tokens: 63_600,
        $ai_cache_creation_input_tokens: 1800,
        $ai_output_tokens: 900,
        $ai_latency: 4,
        $ai_is_error: false,
        steps: 2,
        answer_key: 'k1',
      },
    });
    expect(g.properties.$ai_total_cost_usd as number).toBeCloseTo(2 * STEP_USD, 9);
  });

  it('gives a signed-in asker a person profile, and sends no generation for an answer no model made', async () => {
    await sendQuestion({ ...asked, who: { id: 'user-7', signedIn: true }, source: 'kept', answer: answer({ key: 'k2', model: { steps: 0, ms: 90, tries: 0, cached: true } }), calls: [] });
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toMatchObject({ distinct_id: 'user-7', properties: { source: 'kept', signed_in: true, model_calls: 0, cost_usd: 0 } });
    expect(sent[0].body.properties).not.toHaveProperty('$process_person_profile');
  });

  it('sends a question with no answer, with its error and what its writer spent', async () => {
    const error = 'Query ran out of steps before it could write an answer.';
    await sendQuestion({ ...asked, who: { id: 'anon-2', signedIn: false }, source: 'writer', failed: { error, status: 422 }, calls: [step] });
    expect(byEvent('explorer_query_asked')[0].properties).toMatchObject({ answered: false, error, status: 422, model_calls: 1 });
    expect(byEvent('$ai_generation')[0].properties).toMatchObject({ $ai_output_choices: [{ role: 'assistant', content: error }] });
  });
});

describe('sendStage', () => {
  it("sends a stage's calls on each model as one generation, a failed call's error with it", async () => {
    const designer: ModelCall = { model: 'claude-opus-5-5', ms: 3000, input: 3000, cacheRead: 0, cacheWrite: 2500, output: 800 };
    const failed: ModelCall = { model: 'claude-opus-5-5', ms: 500, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, error: 'Overloaded' };
    await sendStage([designer, failed], { who: { id: 'anon-1', signedIn: false }, trace: TRACE, stage: 'designer', chainId: 43114, question: 'GMX activity last 7 days', key: 'k1' });
    expect(sent).toHaveLength(1);
    const g = sent[0].body.properties;
    expect(g).toMatchObject({ $ai_trace_id: TRACE, $ai_span_name: 'designer', $ai_model: 'claude-opus-5-5', $ai_latency: 3.5, $ai_is_error: true, $ai_error: 'Overloaded', steps: 2 });
    // (3,000 x $4 + 2,500 x $5 + 800 x $20) per million tokens
    expect(g.$ai_total_cost_usd as number).toBeCloseTo(0.0405, 9);
    expect(g).not.toHaveProperty('$ai_output_choices');
  });

  it('leaves a model with no list price for PostHog to price', async () => {
    await sendStage([{ ...step, model: 'claude-unknown-1' }], { who: { id: 'anon-1', signedIn: false }, trace: TRACE, stage: 'reader', chainId: 43114, question: 'q' });
    expect(sent[0].body.properties).toMatchObject({ $ai_model: 'claude-unknown-1', $ai_input_tokens: 1200 });
    expect(sent[0].body.properties).not.toHaveProperty('$ai_total_cost_usd');
  });
});
