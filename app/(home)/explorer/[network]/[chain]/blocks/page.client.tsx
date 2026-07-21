"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { EvmBlocksPage } from "@/components/explorer/EvmListPages";
import { useChainContext } from "../layout.client";

export function BlocksPageClient({ chainSlug }: { chainSlug: string }) {
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
      <EvmBlocksPage chainId={chain.chainId} chainSlug={chainSlug} tokenSymbol={chain.nativeToken} />
    </ExplorerLayout>
  );
}
