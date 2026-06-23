/**
 * Client for the hardened on-chain query gateway (Railway). The MCP no longer
 * talks to ClickHouse directly — it sends a typed DSL request to the gateway,
 * which validates + compiles + runs it as the locked-down read-only DB user.
 *
 * Requests are HMAC-signed exactly as the gateway expects:
 *   sig = hex( hmac_sha256( MCP_GATEWAY_SECRET, `${ts}.${nonce}.${body}` ) )
 * sent as x-mcp-timestamp / x-mcp-nonce / x-mcp-signature.
 *
 * Credentials (ClickHouse) live only in the gateway; the MCP holds just the
 * gateway URL + shared secret.
 */
import { createHmac, randomUUID } from 'node:crypto';

const GATEWAY_TIMEOUT_MS = 20000;

export interface GatewayResult {
  op: string;
  source: string;
  results: Record<string, Array<Record<string, unknown>>>;
  truncated: boolean;
}

/** True when both the gateway URL and shared secret are configured. */
export function gatewayConfigured(): boolean {
  return !!(process.env.MCP_GATEWAY_URL && process.env.MCP_GATEWAY_SECRET);
}

/** Send a typed DSL request to the gateway. Throws on misconfig, non-2xx, or timeout. */
export async function gatewayQuery(op: string, params: Record<string, unknown>): Promise<GatewayResult> {
  const url = process.env.MCP_GATEWAY_URL;
  const secret = process.env.MCP_GATEWAY_SECRET;
  if (!url || !secret) throw new Error('on-chain query gateway is not configured');

  const body = JSON.stringify({ op, params });
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID();
  const sig = createHmac('sha256', secret).update(`${ts}.${nonce}.${body}`).digest('hex');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/query`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-mcp-timestamp': ts,
        'x-mcp-nonce': nonce,
        'x-mcp-signature': sig,
      },
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`gateway ${res.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text) as GatewayResult;
  } finally {
    clearTimeout(timer);
  }
}
