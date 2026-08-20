/**
 * Resolve an explorer URL's chain segment against the catalog.
 */

import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { isBareAliasOf } from "@/lib/chain-alias";

const CATALOG = l1ChainsData as L1Chain[];

export function wantsTestnet(network: string): boolean {
  return network === "fuji" || network === "testnet";
}

/** The catalog entry a URL addresses, if any. */
export function resolveCatalogChain(network: string, slug: string | undefined): L1Chain | undefined {
  if (!slug) return undefined;
  const testnet = wantsTestnet(network);
  const candidates = CATALOG.filter((c) => c.slug === slug);
  return candidates.find((c) => (c.isTestnet === true) === testnet) ?? candidates[0];
}

/** Whether this URL points at a chain the explorer has no data for. */
export function isUnindexedChain(network: string, slug: string | undefined): boolean {
  return resolveCatalogChain(network, slug)?.isIndexed === false;
}

/** Chains named `slug` that are not entitled to it as a bare alias. */
export function findAliasClaimants(network: string, slug: string | undefined): L1Chain[] {
  if (!slug) return [];
  const testnet = wantsTestnet(network);
  return CATALOG.filter(
    (c) =>
      (c.isTestnet === true) === testnet &&
      !c.aliasVerified &&
      isBareAliasOf(slug, c.chainName),
  );
}
