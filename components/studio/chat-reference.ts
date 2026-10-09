/*
 * Hands a piece of the project to the chat composer from anywhere in Studio,
 * such as a selection in the code editor, without threading callbacks through
 * the workspace. The composer inserts it and focuses, and the builder types
 * what to do with it.
 */

export const CHAT_REFERENCE_EVENT = 'studio:chat-reference';
const MAX_SNIPPET_CHARS = 4_000;

const FENCE_LANG: Record<string, string> = {
  sol: 'solidity',
  js: 'javascript',
  jsx: 'jsx',
  html: 'html',
  css: 'css',
  json: 'json',
  md: 'markdown',
  svg: 'xml',
};

/** A reference the agent can act on: the path and lines (it can read_file for more), plus the selected code. */
export function codeReference(path: string, startLine: number, endLine: number, code: string): string {
  const lines = startLine === endLine ? `line ${startLine}` : `lines ${startLine}-${endLine}`;
  const lang = FENCE_LANG[path.split('.').pop() ?? ''] ?? '';
  const snippet =
    code.length > MAX_SNIPPET_CHARS ? `${code.slice(0, MAX_SNIPPET_CHARS)}\n… (selection truncated)` : code;
  return `In \`${path}\` ${lines}:\n\`\`\`${lang}\n${snippet.replace(/```/g, '`\u200b``')}\n\`\`\`\n`;
}

export function referenceInChat(text: string) {
  window.dispatchEvent(new CustomEvent(CHAT_REFERENCE_EVENT, { detail: { text } }));
}
