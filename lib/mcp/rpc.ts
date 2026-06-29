/**
 * Typed RPC client for AvalancheGo public API nodes.
 *
 * Supports both EVM-style JSON-RPC (params as array) and
 * Avalanche platform/info JSON-RPC (params as object).
 */

import type { Network } from './types';

// ---------------------------------------------------------------------------
// Endpoint configuration
// ---------------------------------------------------------------------------

const BASE_URLS: Record<Network, string> = {
  mainnet: 'https://api.avax.network',
  fuji: 'https://api.avax-test.network',
};

export const ENDPOINTS = {
  pchain: '/ext/bc/P',
  info: '/ext/info',
  cchain: '/ext/bc/C/rpc',
  xchain: '/ext/bc/X',
} as const;

export type Endpoint = keyof typeof ENDPOINTS;

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 250;
// Never sleep longer than this between retries. The public nodes are Cloudflare-fronted
// and a rate-limit (1015) 429 carries Retry-After in the THOUSANDS of seconds; honoring
// it verbatim would block the handler until Vercel kills it (504). Cap hard.
const MAX_BACKOFF_MS = 2_000;
// The public api.avax.network nodes throttle aggressively (429) and serve HTML gateway
// pages (502/503/504) under load — both are transient, so we back off and retry.
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

/** Error from an RPC call. `status` is set for HTTP-level failures. */
export class RpcError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RpcError';
    this.status = status;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// RPC call helper
// ---------------------------------------------------------------------------

/**
 * POST a JSON-RPC request to an arbitrary node URL with exponential backoff on
 * transient failures (429/5xx, honoring Retry-After) and a content-type guard
 * that turns a rate-limit HTML page into a clean error instead of a
 * `JSON.parse` "Unexpected token '<'" crash.
 *
 * @returns The `result` field of the JSON-RPC response.
 * @throws  {RpcError} On HTTP failure, non-JSON body, or JSON-RPC error response.
 */
export async function jsonRpcPost(
  url: string,
  method: string,
  params: Record<string, unknown> | unknown[] = {}
): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
      });

      if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_RETRIES) {
        const retryAfter = Number(response.headers.get('retry-after'));
        // A large Retry-After means the upstream WAF has banned us for minutes
        // (Cloudflare 1015). Retrying in-request is pointless and would hang the
        // function to a 504 — bail fast with a clean error instead.
        if (Number.isFinite(retryAfter) && retryAfter * 1000 > MAX_BACKOFF_MS) {
          throw new RpcError('upstream rate limited — try again shortly', 429);
        }
        const backoff =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, MAX_BACKOFF_MS)
            : Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
        await sleep(backoff);
        continue;
      }

      if (!response.ok) {
        throw new RpcError(`HTTP ${response.status}: ${response.statusText}`, response.status);
      }

      // Rate-limit / gateway responses can arrive as HTML even with a 200 — guard before parsing.
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();
      if (!contentType.includes('json') && text.trimStart().startsWith('<')) {
        throw new RpcError(`Non-JSON response from node (status ${response.status})`, response.status);
      }

      const json = JSON.parse(text) as {
        result?: unknown;
        error?: { code: number; message: string };
      };

      if (json.error) {
        throw new RpcError(`RPC error ${json.error.code}: ${json.error.message}`);
      }

      return json.result;
    } catch (err) {
      lastError = err;
      // Surface immediately (don't retry): RPC/HTTP errors, and timeouts — retrying a
      // 15s timeout just multiplies latency (a hung node would cost 60s+ across attempts).
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (err instanceof RpcError || isAbort || attempt >= MAX_RETRIES) throw err;
      // Transient network blips (e.g. fetch TypeError) get a short backoff retry.
      await sleep(Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('RPC request failed');
}

/**
 * Make a JSON-RPC call to an AvalancheGo public API node.
 *
 * @param network  'mainnet' | 'fuji'
 * @param endpoint One of the ENDPOINTS keys
 * @param method   JSON-RPC method name
 * @param params   Params object (P-Chain / Info) or array (EVM / X-Chain)
 * @returns        The `result` field of the JSON-RPC response
 */
export async function avalancheRPC(
  network: Network,
  endpoint: Endpoint,
  method: string,
  params: Record<string, unknown> | unknown[] = {}
): Promise<unknown> {
  const url = `${BASE_URLS[network]}${ENDPOINTS[endpoint]}`;
  return jsonRpcPost(url, method, params);
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Convert a nAVAX string (9-decimal integer) to a human-readable AVAX string.
 * Returns '?' if the input is not a valid integer string.
 */
export function nAvaxToAvax(nAvax: string | number | undefined): string {
  if (nAvax === undefined || nAvax === null) return '?';
  try {
    const n = typeof nAvax === 'number' ? BigInt(nAvax) : BigInt(nAvax);
    const whole = n / 1_000_000_000n;
    const frac = n % 1_000_000_000n;
    const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '');
    return fracStr ? `${whole}.${fracStr}` : `${whole}`;
  } catch {
    return String(nAvax);
  }
}
