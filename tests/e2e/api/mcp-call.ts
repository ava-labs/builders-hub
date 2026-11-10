import { expect, type App } from 'e2e';
import { z } from 'zod';
import { appFetch } from './app-fetch';

// The JSON-RPC envelope of a tools/call answer. The tool's own answer is the text of the first content part.
const ToolCallResponse = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.literal(1),
  result: z.object({
    content: z.array(z.object({ type: z.literal('text'), text: z.string() })).min(1),
    isError: z.boolean().optional(),
  }),
});

export interface ToolResult {
  // result.isError: a tool error, not a transport error.
  isError: boolean;
  // The tool text: JSON for a normal answer, a plain message for most errors.
  text: string;
  // The tool text parsed as JSON, or undefined when it is not JSON.
  json: unknown;
}

// Calls one MCP tool on /api/mcp and unwraps the answer.
// The request accepts SSE like a real MCP client does, so the endpoint answers with one event: "data: {json}".
export async function callTool(app: App, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const res = await appFetch(app, '/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  const raw = await res.text();
  expect(res.status, `${name}: HTTP ${res.status}: ${raw.slice(0, 300)}`).toBe(200);

  const data = raw.split('\n').find((line) => line.startsWith('data:'));
  const envelope = expect(parseJson(data === undefined ? raw : data.slice('data:'.length))).toMatchSchema(ToolCallResponse);
  const text = envelope.result.content[0].text;
  return { isError: envelope.result.isError === true, text, json: parseJson(text) };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
