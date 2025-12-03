"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import BlockDetailPage from "@/components/explorer/BlockDetailPage";
import { useChainContext } from "../../layout.client";

interface BlockDetailPageClientProps {
  blockNumber: string;
}

export function BlockDetailPageClient({ blockNumber }: BlockDetailPageClientProps) {
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
      breadcrumbItems={[{ label: `Block #${blockNumber}` }]}
    >
      <BlockDetailPage
        chainId={chain.chainId}
        chainName={chain.chainName}
        chainSlug={chain.chainSlug}
        blockNumber={blockNumber}
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

