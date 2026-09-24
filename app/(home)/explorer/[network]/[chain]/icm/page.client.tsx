"use client";

import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { IcmMessagesPage } from "@/components/explorer/IcmMessagesPage";
import { useChainContext } from "../layout.client";
import { useExplorerNetwork } from "@/components/explorer/useExplorerNetwork";

/* The chain's ICM tab in the explorer's own shell: the search header
   every EVM page begins with. The chain layout already provides the
   ExplorerProvider the message feed reads. */
export function IcmPageClient({ chainSlug }: { chainSlug: string }) {
  const chain = useChainContext();
  const network = useExplorerNetwork();
  return (
    <EvmShell network={network}>
      <IcmMessagesPage
        chainId={chain.chainId}
        chainSlug={chain.chainSlug ?? chainSlug}
        tokenSymbol={chain.nativeToken}
      />
    </EvmShell>
  );
}
