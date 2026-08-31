import l1ChainsData from '@/constants/l1-chains.json';

/**
 * Chain resolution and JSON-RPC helpers for the live-data og cards.
 * Server-side only (the og data routes run on the Node runtime).
 */

export interface OgChain {
  name: string;
  symbol: string;
  decimals: number;
  rpcUrl: string;
}

type RegistryChain = {
  slug?: string;
  chainName?: string;
  isTestnet?: boolean;
  rpcUrl?: string;
  tokenSymbol?: string;
  networkToken?: { symbol?: string; decimals?: number };
};

/** Mirrors the explorer pages' network-aware chain resolution. */
export function resolveOgChain(network: string, chainSlug: string): OgChain | null {
  const wantTestnet = network === 'fuji' || network === 'testnet';
  const candidates = (l1ChainsData as RegistryChain[]).filter((c) => c.slug === chainSlug);
  const chain = candidates.find((c) => (c.isTestnet === true) === wantTestnet) ?? candidates[0];
  if (!chain?.rpcUrl) return null;
  return {
    name: chain.chainName ?? chainSlug,
    symbol: chain.networkToken?.symbol ?? chain.tokenSymbol ?? '',
    decimals: chain.networkToken?.decimals ?? 18,
    rpcUrl: chain.rpcUrl,
  };
}

export async function evmRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  timeoutMs: number,
): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`RPC ${method} failed with status ${res.status}`);
  }
  const json = await res.json();
  if (json.error) {
    throw new Error(`RPC ${method} error: ${json.error.message ?? 'unknown'}`);
  }
  return json.result as T;
}

/** Format a hex-encoded wei quantity as a token amount string. */
export function formatUnitsHex(hex: string, decimals: number, maxFraction: number): string {
  const wei = BigInt(hex);
  const base = 10n ** BigInt(decimals);
  const whole = wei / base;
  const fracScale = 10n ** BigInt(maxFraction);
  const frac = ((wei % base) * fracScale) / base;
  const wholeStr = whole.toLocaleString('en-US');
  if (frac === 0n) return wholeStr;
  const fracStr = frac.toString().padStart(maxFraction, '0').replace(/0+$/, '');
  return fracStr.length > 0 ? `${wholeStr}.${fracStr}` : wholeStr;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "AUG 24 · 20:53 UTC" from a hex unix timestamp, as on the approved mocks. */
export function formatTimestampHex(hex: string): string {
  const d = new Date(Number(BigInt(hex)) * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} · ${hh}:${mm} UTC`;
}

export function truncateMiddle(id: string, keep = 14): string {
  return id.length <= keep * 2 + 1 ? id : `${id.slice(0, keep)}…${id.slice(-keep)}`;
}
