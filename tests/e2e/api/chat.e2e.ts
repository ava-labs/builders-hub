import { describe, expect, test, type App } from 'e2e';
import { appFetch } from './app-fetch';

// The chat route serves the chat page, the bubble, and Ask AI in the search. It answers with a stream of events:
// the text of the answer in pieces, the model's tool calls, and an error event when a step fails. A model writes
// the answer, so the tests check that an answer arrives and how much of it there is, never its words.
// Each test asks one question. An anonymous caller has 10 an hour on a server instance, and the questions of the
// Explorer query tests count against the same 10 there.

// One answer can take several model steps. The route stops at 120 s.
const ANSWER_MS = 150_000;

interface Part {
  type: string;
  [key: string]: unknown;
}
interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: Part[];
}
interface Reply {
  status: number;
  /** the answer as the page shows it: every piece of text, joined */
  text: string;
  /** what the stream said went wrong */
  errors: string[];
  body: string;
}

const asks = (id: string, text: string): Message => ({ id, role: 'user', parts: [{ type: 'text', text }] });

// Sends the messages as the browser does: `source` is set by the bubble, and the chat page leaves it out.
async function ask(app: App, messages: Message[], source?: 'bubble'): Promise<Reply> {
  const res = await appFetch(app, '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'e2e-chat', messages, ...(source ? { source } : {}) }),
    signal: AbortSignal.timeout(ANSWER_MS - 5_000),
  });
  const body = await res.text();
  // a limit is no answer, and the test says so
  test.skip(res.status === 429, `the chat route rate-limited this caller (429: ${body.slice(0, 160)}), so nothing ran`);
  // server-sent events: one JSON event per data line, then [DONE]
  const events = body
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) => JSON.parse(line.slice('data: '.length)) as { type: string; delta?: string; errorText?: string });
  return {
    status: res.status,
    text: events
      .filter((event) => event.type === 'text-delta')
      .map((event) => event.delta ?? '')
      .join(''),
    errors: events.filter((event) => event.type === 'error').map((event) => event.errorText ?? ''),
    body,
  };
}

// API tests run once, on the target without a browser engine (platform "api").
describe('Chat API', { platforms: ['api'], tags: ['api', 'chat'] }, () => {
  // On the chat page the model writes its answer and then calls tools (a Console tool to show, the follow-up
  // questions). What it writes before a tool call must still reach the page as text: a model can send that part
  // back as a note the page does not show, and then only a closing line is left.
  test('answers a question on the chat page in text the reader can see', { timeout: ANSWER_MS }, async ({ app }) => {
    const reply = await ask(app, [asks('u1', 'How do I create an Avalanche L1? List the main steps.')]);
    expect(reply.status, reply.body.slice(0, 300)).toBe(200);
    expect(reply.errors).toEqual([]);
    expect(reply.text.length, `the answer: ${reply.text}`).toBeGreaterThan(200);
  });

  // The browser sends each earlier turn back with the model's thinking in it. The route writes a new system prompt
  // for each question, and the API can refuse thinking that comes back after such a change, so the route leaves it
  // out. Here the thinking is one the API refuses outright: an answer shows that it never got there. The question
  // comes from the bubble, so the same request shows that the bubble answers.
  test(
    'answers a follow-up in the bubble whose history carries thinking the API would refuse',
    { timeout: ANSWER_MS },
    async ({ app }) => {
      const history: Message[] = [
        asks('u1', 'What is an Avalanche L1?'),
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            {
              type: 'reasoning',
              text: '',
              state: 'done',
              providerMetadata: { anthropic: { signature: 'not-a-signature-the-api-takes' } },
            },
            { type: 'text', text: 'An Avalanche L1 is a blockchain with its own set of validators.', state: 'done' },
          ],
        },
        asks('u2', 'Say that again in other words.'),
      ];
      const reply = await ask(app, history, 'bubble');
      expect(reply.status, reply.body.slice(0, 300)).toBe(200);
      expect(reply.errors).toEqual([]);
      expect(reply.text.length, `the answer: ${reply.text}`).toBeGreaterThan(20);
    },
  );
});
