"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { IcmMessagesPage } from "@/components/explorer/IcmMessagesPage";
import { useChainContext } from "../layout.client";

export function IcmPageClient({ chainSlug }: { chainSlug: string }) {
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
      <IcmMessagesPage
        chainId={chain.chainId}
        chainSlug={chain.chainSlug}
        tokenSymbol={chain.nativeToken}
      />
    </ExplorerLayout>
  );
}
