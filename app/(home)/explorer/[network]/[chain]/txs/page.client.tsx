"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { EvmTxsPage } from "@/components/explorer/EvmListPages";
import { useChainContext } from "../layout.client";

export function TxsPageClient({ chainSlug }: { chainSlug: string }) {
  const chain = useChainContext();
  return (
    <ExplorerLayout
      chainId={chain.chainId}
      chainName={chain.chainName}
      chainSlug={chain.chainSlug}
      themeColor={chain.themeColor}
      chainLogoURI={chain.chainLogoURI}
      website={chain.website}
      socials={chain.socials}
      rpcUrl={chain.rpcUrl}
    >
      <EvmTxsPage chainId={chain.chainId} chainSlug={chainSlug} tokenSymbol={chain.nativeToken} />
    </ExplorerLayout>
  );
}
