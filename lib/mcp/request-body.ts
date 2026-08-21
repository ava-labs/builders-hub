export const MAX_MCP_BODY_BYTES = 256 * 1024;

export class MCPBodyTooLargeError extends Error {
  constructor() {
    super('Request body too large');
    this.name = 'MCPBodyTooLargeError';
  }
}

/** Read a JSON body with an enforced byte limit, including chunked requests. */
export async function readMCPJson(request: Request, maxBytes = MAX_MCP_BODY_BYTES): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(declared) && declared > maxBytes) throw new MCPBodyTooLargeError();

  const reader = request.body?.getReader();
  if (!reader) return JSON.parse('');
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new MCPBodyTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}
