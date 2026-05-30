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

// ---------------------------------------------------------------------------
// RPC call helper
// ---------------------------------------------------------------------------

/**
 * Make a JSON-RPC call to an AvalancheGo public node.
 *
 * @param network  'mainnet' | 'fuji'
 * @param endpoint One of the ENDPOINTS keys
 * @param method   JSON-RPC method name
 * @param params   Params object (P-Chain / Info) or array (EVM / X-Chain)
 * @returns        The `result` field of the JSON-RPC response
 * @throws         On network error, timeout, or JSON-RPC error response
 */
export async function avalancheRPC(
  network: Network,
  endpoint: Endpoint,
  method: string,
  params: Record<string, unknown> | unknown[] = {}
): Promise<unknown> {
  const url = `${BASE_URLS[network]}${ENDPOINTS[endpoint]}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json() as {
      result?: unknown;
      error?: { code: number; message: string };
    };

    if (json.error) {
      throw new Error(`RPC error ${json.error.code}: ${json.error.message}`);
    }

    return json.result;
  } finally {
    clearTimeout(timer);
  }
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
