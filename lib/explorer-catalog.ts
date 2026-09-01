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

/**
 * The chains worth listing: those whose validator set is still active.
 *
 * `isActive` is written by scripts/enrich-chains.ts --prune from the P-Chain's
 * own view (getAllValidatorsAt at the proposed height), so it counts legacy
 * Subnet validators as well as ACP-77 L1 seats. 68 of the 357 catalog entries
 * are active on mainnet as of the last enrichment.
 */
export function activeChains(opts?: { testnet?: boolean }): L1Chain[] {
  return CATALOG.filter((c) => {
    if (c.isActive === false) return false;
    if (opts?.testnet === undefined) return true;
    return (c.isTestnet === true) === opts.testnet;
  });
}
