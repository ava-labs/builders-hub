"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import TransactionDetailPage from "@/components/explorer/TransactionDetailPage";
import { useChainContext } from "../../layout.client";

interface TransactionDetailPageClientProps {
  txHash: string;
}

export function TransactionDetailPageClient({ txHash }: TransactionDetailPageClientProps) {
  const chain = useChainContext();
  const shortHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
  
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
      breadcrumbItems={[{ label: shortHash }]}
    >
      <TransactionDetailPage
        chainId={chain.chainId}
        chainName={chain.chainName}
        chainSlug={chain.chainSlug}
        txHash={txHash}
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

