/**
 * Whether the explorer has anything to show for a chain.
 *
 * `isIndexed` is written into constants/l1-chains.json by the enrichment script
 * so the app can say so plainly instead.
 */

import { resolveDedicatedMetricsChain } from "./dedicated-stats";

/** EVM chain IDs the metrics API reports on, per network. */
export interface IndexedChainIds {
  mainnet: Set<string>;
  fuji: Set<string>;
}

/** The catalog fields the rule reads. */
export interface IndexingSubject {
  chainId: string;
  rpcUrl?: string;
  isTestnet?: boolean;
}

export const PUBLIC_METRICS_API_URL = "https://metrics.avax.network";

export function deriveIsIndexed(chain: IndexingSubject, known: IndexedChainIds): boolean {
  if (chain.rpcUrl) return true;
  const set = chain.isTestnet ? known.fuji : known.mainnet;
  if (set.has(chain.chainId)) return true;
  // The dedicated-metrics chains are absent from the shared metrics list by definition
  return resolveDedicatedMetricsChain(chain.chainId) !== undefined;
}

/** The metrics API's own chain list */
export async function fetchIndexedChainIds(): Promise<IndexedChainIds | null> {
  const base = process.env.METRICS_API_URL || PUBLIC_METRICS_API_URL;
  const load = async (network: "mainnet" | "fuji"): Promise<Set<string>> => {
    const res = await fetch(`${base}/v2/chains?network=${network}`);
    if (!res.ok) throw new Error(`${network}: ${res.status} ${res.statusText}`);
    const body = (await res.json()) as { chains?: Array<{ evmChainId?: number | string }> };
    if (!Array.isArray(body.chains)) throw new Error(`${network}: unexpected response shape`);
    return new Set(body.chains.map((c) => String(c.evmChainId)));
  };

  try {
    const [mainnet, fuji] = await Promise.all([load("mainnet"), load("fuji")]);
    return { mainnet, fuji };
  } catch (err) {
    console.error("Metrics API chain list fetch failed:", err);
    return null;
  }
}
