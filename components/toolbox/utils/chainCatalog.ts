/** An L1 from the site's chain catalog (constants/l1-chains.json), with the fields the Console reads. */
export interface CatalogChain {
  chainName: string;
  rpcUrl?: string;
  chainLogoURI?: string;
  networkToken?: { name?: string; symbol?: string };
}

/**
 * The catalog entry for an EVM chain ID, or null when the catalog does not list it. The catalog is imported on the
 * first call, so a page that never looks up a chain does not load it.
 */
export async function findCatalogChain(evmChainId: number | string): Promise<CatalogChain | null> {
  const [{ default: active }, { default: inactive }] = await Promise.all([
    import('@/constants/l1-chains.json'),
    import('@/constants/l1-chains-inactive.json'),
  ]);
  const id = String(evmChainId);
  const chains: ({ chainId: string } & CatalogChain)[] = [...active, ...inactive];
  return chains.find((c) => c.chainId === id) ?? null;
}
