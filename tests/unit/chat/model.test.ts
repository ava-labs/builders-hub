import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import { withoutReasoning } from '@/lib/chat/model';

/* withoutReasoning by itself. What the route sends to Anthropic with it is in route.test.ts. */

const asks = (id: string, text: string): UIMessage => ({ id, role: 'user', parts: [{ type: 'text', text }] });

// An answered turn as the browser holds it: the model's thinking, then the answer.
const answered = (): UIMessage => ({
  id: 'a1',
  role: 'assistant',
  parts: [
    {
      type: 'reasoning',
      text: '',
      state: 'done',
      providerMetadata: { anthropic: { signature: 'signature-of-turn-1' } },
    },
    { type: 'text', text: 'An L1 is a chain with its own validators.', state: 'done' },
  ],
});

describe('withoutReasoning', () => {
  it('returns the turn without its thinking, and leaves the messages it was given as they were', () => {
    const given = [asks('u1', 'What is an L1?'), answered()];
    const before = structuredClone(given);
    const out = withoutReasoning(given);
    expect(out.map((message) => message.parts.map((part) => part.type))).toEqual([['text'], ['text']]);
    expect(given).toEqual(before);
  });

  it('passes a message with no parts through: the older shape holds its text in content', () => {
    const older = [
      { id: 'u1', role: 'user', content: 'What is an L1?' },
      { id: 'a1', role: 'assistant', content: 'An L1 is a chain with its own validators.' },
    ] as unknown as UIMessage[];
    expect(withoutReasoning(older)).toEqual(older);
  });
});
