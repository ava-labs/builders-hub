"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import AddressDetailPage from "@/components/explorer/AddressDetailPage";
import { useChainContext } from "../../layout.client";

interface AddressDetailPageClientProps {
  address: string;
  sourcifySupport?: boolean;
}

export function AddressDetailPageClient({ address, sourcifySupport }: AddressDetailPageClientProps) {
  const chain = useChainContext();
  const shortAddress = `${address.slice(0, 10)}...${address.slice(-8)}`;
  
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
      breadcrumbItems={[{ label: shortAddress }]}
    >
      <AddressDetailPage
        chainId={chain.chainId}
        chainName={chain.chainName}
        chainSlug={chain.chainSlug}
        address={address}
        themeColor={chain.themeColor}
        chainLogoURI={chain.chainLogoURI}
        nativeToken={chain.nativeToken}
        description={chain.description}
        website={chain.website}
        socials={chain.socials}
        rpcUrl={chain.rpcUrl}
        sourcifySupport={sourcifySupport ?? chain.sourcifySupport}
      />
    </ExplorerLayout>
  );
}

