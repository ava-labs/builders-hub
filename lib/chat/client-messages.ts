import type { UIMessage } from 'ai';

/* What a chat client may send as the conversation. The chat page and the bubble send the reader's turns as text,
   and send back the assistant's turns (text, tool calls and their results) as history. Two things never come from
   them, and the route refuses both:
   - a turn of another role. The system prompt is the server's, so a `system` turn in the body is not one of ours.
   - a `file` part. The SDK loads the URL of a file part from this server and gives the model what the URL answers,
     so a file part would make the server read any address for the caller. */
export const MAX_CHAT_MESSAGES = 200;
/** The size of one conversation as JSON. A longer one does not fit the model's context in any case. */
export const MAX_CHAT_CHARS = 1_000_000;

export function isClientMessage(message: unknown): message is UIMessage {
  if (typeof message !== 'object' || message === null) return false;
  const { role, parts } = message as { role?: unknown; parts?: unknown };
  if (role !== 'user' && role !== 'assistant') return false;
  // the older shape has its text in `content` and no parts
  if (parts === undefined) return true;
  return (
    Array.isArray(parts) &&
    parts.every(
      (part) =>
        typeof part === 'object' &&
        part !== null &&
        typeof (part as { type?: unknown }).type === 'string' &&
        (part as { type: string }).type !== 'file',
    )
  );
}

/** True when the conversation is small enough to send to the model. */
export function fitsChat(messages: unknown[]): boolean {
  return JSON.stringify(messages).length <= MAX_CHAT_CHARS;
}

/* The SDK asks this for each URL in a message that the model cannot read by itself. The answer is always "not
   loaded": this server fetches no address that a message names. */
export async function loadNoUrls(requested: readonly unknown[]): Promise<null[]> {
  return requested.map(() => null);
}
