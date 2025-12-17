"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import L1ExplorerPage from "@/components/explorer/L1ExplorerPage";
import { useChainContext } from "./layout.client";

interface ChainExplorerPageClientProps {
  chainSlug: string;
}

export function ChainExplorerPageClient({ chainSlug }: ChainExplorerPageClientProps) {
  const chain = useChainContext();
  
  return (
    <ExplorerLayout
      chainId={chain.chainId}
      chainName={chain.chainName}
      chainSlug={chain.chainSlug}
      themeColor={chain.themeColor}
      chainLogoURI={chain.chainLogoURI}
      description={chain.description}
      website={chain.website}
      socials={chain.socials}
      rpcUrl={chain.rpcUrl}
      showSearch
    >
      <L1ExplorerPage
        chainId={chain.chainId}
        chainName={chain.chainName}
        chainSlug={chain.chainSlug}
        themeColor={chain.themeColor}
        chainLogoURI={chain.chainLogoURI}
        nativeToken={chain.nativeToken}
        description={chain.description}
        website={chain.website}
        socials={chain.socials}
        rpcUrl={chain.rpcUrl}
      />
    </ExplorerLayout>
  );
}

