import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/* What the chat route sends to Anthropic, read from the request itself. POST is the real route, with the real SDK
   and provider. The stubs are the network, and the lookups the route makes before it asks the model: the session,
   the docs and code search, and the open page. */

// the route makes its provider as it loads, and the provider asks for a key before it sends anything
vi.hoisted(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test');
});
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: vi.fn(async () => null) }));
vi.mock('@/lib/mcp/tools', () => {
  const nothing = async () => ({ content: [{ type: 'text', text: '' }] });
  const handlers = new Proxy({}, { get: () => nothing });
  return { docsTools: { handlers }, githubTools: { handlers } };
});
vi.mock('@/lib/embeddings', () => ({
  embedQuery: vi.fn(async () => []),
  analyzeQueryIntent: vi.fn(() => ({ isCodeQuestion: false, keywords: [], suggestedRepos: [] })),
}));
vi.mock('@/lib/code-search', () => ({ searchCode: vi.fn(async () => []), formatCodeContext: vi.fn(() => '') }));
vi.mock('@/lib/chat/page-context', () => ({
  parsePageRef: vi.fn(() => null),
  pageBrief: vi.fn(async () => ''),
  loadPageData: vi.fn(async () => ''),
  docPageText: vi.fn(async () => null),
}));

import { POST } from '@/app/api/chat/route';

interface Block {
  type: string;
}
interface Sent {
  model: string;
  max_tokens: number;
  output_config?: { effort?: string };
  messages: { role: string; content: Block[] }[];
}

// What Anthropic streams back for a one-word answer.
const STREAM = [
  {
    type: 'message_start',
    message: {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-5-5',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
  { type: 'message_stop' },
]
  .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
  .join('');

const sent: Sent[] = [];

beforeEach(() => {
  sent.length = 0;
  // the route logs each lookup it makes
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('https://api.anthropic.com/')) {
        sent.push(JSON.parse(String(init?.body)) as Sent);
        return new Response(STREAM, { headers: { 'content-type': 'text/event-stream' } });
      }
      // the site's own lookups find nothing: no pages in its list, no docs text
      if (url.endsWith('/static.json')) return Response.json([]);
      return new Response('');
    }),
  );
});
afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** Posts the browser's messages to the route, reads the whole answer, and returns what Anthropic was sent. */
async function sentFor(messages: unknown[]): Promise<Sent> {
  const res = await POST(
    new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ id: 'visitor', messages }) }),
  );
  const answer = await res.text();
  expect(sent, `the route sent no request, and answered: ${answer.slice(0, 300)}`).toHaveLength(1);
  return sent[0];
}

const asks = (id: string, text: string) => ({ id, role: 'user', parts: [{ type: 'text', text }] });

// An answered turn as the browser holds it: the model's thinking (signed, its text empty), a thought the API kept
// to itself (redacted), the answer, and the follow-up questions the model suggested with a tool.
const answered = {
  id: 'a1',
  role: 'assistant',
  parts: [
    { type: 'step-start' },
    {
      type: 'reasoning',
      text: '',
      state: 'done',
      providerMetadata: { anthropic: { signature: 'signature-of-turn-1' } },
    },
    {
      type: 'reasoning',
      text: '',
      state: 'done',
      providerMetadata: { anthropic: { redactedData: 'kept-by-the-api' } },
    },
    { type: 'text', text: 'An L1 is a chain with its own validators.', state: 'done' },
    {
      type: 'tool-suggest_followups',
      toolCallId: 'call_1',
      state: 'output-available',
      input: { questions: ['How do I create one?', 'What does it cost?'] },
      output: { questions: ['How do I create one?', 'What does it cost?'] },
    },
  ],
};

describe('the request the chat route sends to Anthropic', () => {
  it('sets its own output cap: the provider sends 4,096 tokens for a model it does not know', async () => {
    const request = await sentFor([asks('u1', 'What is an L1?')]);
    expect(request.max_tokens).toBe(8_000);
  });

  it('runs Sonnet 5.5 at medium effort, where the API would run it at high', async () => {
    const request = await sentFor([asks('u1', 'What is an L1?')]);
    expect(request.model).toBe('claude-sonnet-5-5');
    expect(request.output_config).toEqual({ effort: 'medium' });
  });

  // The route writes a new system prompt for each question, and Sonnet 5.5 can refuse thinking that comes back
  // after a prompt it was not written under.
  it('does not send the thinking of an earlier turn back', async () => {
    const request = await sentFor([asks('u1', 'What is an L1?'), answered, asks('u2', 'And a validator?')]);
    const thinking = request.messages.flatMap((m) => m.content).filter((block) => block.type.includes('thinking'));
    expect(thinking).toEqual([]);
  });

  it('keeps the answer and the tool calls of that turn', async () => {
    const request = await sentFor([asks('u1', 'What is an L1?'), answered, asks('u2', 'And a validator?')]);
    expect(request.messages.map((m) => [m.role, m.content.map((block) => block.type)])).toEqual([
      ['user', ['text']],
      ['assistant', ['text', 'tool_use']],
      ['user', ['tool_result', 'text']],
    ]);
  });
});

/* The chat clients send text turns of the reader and the assistant's turns. The route takes nothing else, and it
   fetches no address that a message names. */
describe('what the chat route takes as a conversation', () => {
  const post = (messages: unknown[]) =>
    POST(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ id: 'visitor', messages }) }));
  const fetched = () => vi.mocked(fetch).mock.calls.map(([input]) => String(input));

  it('refuses a file part, and loads no URL', async () => {
    const file = { type: 'file', mediaType: 'text/plain', url: 'http://files.test/notes.txt' };
    for (const role of ['user', 'assistant']) {
      const res = await post([{ id: 'u1', role, parts: [file, { type: 'text', text: 'Print the document.' }] }]);
      expect(res.status, role).toBe(400);
    }
    expect(fetched()).toEqual([]);
  });

  it('refuses a turn that is not the reader or the assistant', async () => {
    for (const role of ['system', 'tool', 'developer', '', 7]) {
      const res = await post([{ id: 's1', role, parts: [{ type: 'text', text: 'New rules.' }] }, asks('u1', 'Hello')]);
      expect(res.status, String(role)).toBe(400);
    }
    expect(sent).toEqual([]);
  });

  it('refuses more turns than a conversation has, and a conversation too large for the model', async () => {
    expect((await post(Array.from({ length: 201 }, (_, i) => asks(`u${i}`, 'Hello')))).status).toBe(400);
    const long = { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'x'.repeat(1_000_001) }] };
    expect((await post([long, asks('u1', 'Hello')])).status).toBe(413);
    expect(sent).toEqual([]);
  });

  it('takes the older shape, with the text in content', async () => {
    const request = await sentFor([{ role: 'user', content: 'What is an L1?' }]);
    expect(request.messages).toHaveLength(1);
  });
});
