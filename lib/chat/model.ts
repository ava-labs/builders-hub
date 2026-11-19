import type { UIMessage } from 'ai';

/* The model behind every chat surface (/chat, the bubble, Ask AI in the search) and what each request to it
   sets. The chat route (app/api/chat/route.ts) is the one caller. */

/** One model for every surface. */
export const CHAT_MODEL = 'claude-sonnet-5-5';

/** What every request sets.
    maxOutputTokens: the provider sends a model's own cap only for the models it knows and gives every other
    model 4,096 tokens, which the thinking shares with the answer. Studio and Query set their cap for the same
    reason, and this is Query's.
    effort: the API runs Sonnet 5.5 at high, where it thinks before almost every reply. Low is Anthropic's
    starting point for chat and search: the first words come sooner. */
export const CHAT_SETTINGS = {
  maxOutputTokens: 16_000,
  providerOptions: { anthropic: { effort: 'low' as const } },
};

/** The browser's messages without the thinking of the turns they hold. The route writes part of the system prompt
    anew for each question, and Sonnet 5.5 checks that the prompt above a thinking block is the one the block was
    written under: thinking that comes back after a change can fail the request (a 400). The answer and the tool
    calls stay. A message with no parts, the older shape with its text in content, passes as it is. */
export function withoutReasoning(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) =>
    Array.isArray(message.parts)
      ? { ...message, parts: message.parts.filter((part) => part.type !== 'reasoning') }
      : message,
  );
}
