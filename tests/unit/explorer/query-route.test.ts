import { beforeEach, describe, expect, it, vi } from 'vitest';

const answerQuestion = vi.hoisted(() => vi.fn());
const checkChatRateLimit = vi.hoisted(() => vi.fn(() => ({ allowed: true, limit: 10, resetTime: 0 })));
const sourceNotes = vi.hoisted(() => vi.fn());

vi.mock('@/lib/explorer-query/answer', () => ({ answerQuestion, drillSql: vi.fn() }));
vi.mock('@/lib/explorer-query/visual', () => ({ designVisual: vi.fn(), writeReading: vi.fn() }));
vi.mock('@/lib/explorer-query/clickhouse', () => ({ runQuery: vi.fn(), anchored: vi.fn(), indexState: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/sources', () => ({ sourceNotes }));
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: vi.fn(async () => null) }));
vi.mock('@/lib/chat/rateLimit', () => ({ checkChatRateLimit, formatResetTime: vi.fn(() => 'soon'), getClientIP: vi.fn(() => '192.0.2.1') }));

import { POST } from '@/app/api/explorer/query/route';

const ask = (prompt: string) => POST(new Request('http://localhost/api/explorer/query', { method: 'POST', body: JSON.stringify({ chainId: 1, prompt }) }));

beforeEach(() => {
  answerQuestion.mockReset();
  checkChatRateLimit.mockClear();
  sourceNotes.mockReset();
});

describe('POST /api/explorer/query', () => {
  it('refuses a prompt with no letters before any model call, and does not count it', async () => {
    for (const prompt of ['??', '123 456', '!!! ...']) {
      const res = await ask(prompt);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Ask a question in words, for example "AVAX staked per day".');
    }
    expect(answerQuestion).not.toHaveBeenCalled();
    expect(checkChatRateLimit).not.toHaveBeenCalled();
  });

  it('asks the model for a question in any script, and adds what the server tables cover', async () => {
    const note = { table: 'p_validator_versions', label: 'validator versions', at: 1, total: 10, known: 8, text: 'Versions are known for 8 of 10 validator seats.' };
    sourceNotes.mockResolvedValue([note]);
    answerQuestion.mockResolvedValue({ title: 't', note: 'n', sql: 'SELECT subnet_id FROM p_validator_versions WHERE chain_id = 1', chart: { kind: 'table', series: [] } });
    const res = await ask('¿Qué versiones usan los validadores?');
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    const events = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
    expect(answerQuestion).toHaveBeenCalledOnce();
    expect(events.at(-1)).toMatchObject({ type: 'answer', answer: { sources: [note] } });
  });
});
