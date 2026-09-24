"use client";

import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { IcmMessagesPage } from "@/components/explorer/IcmMessagesPage";
import { SectionHeader } from "@/components/explorer-v2/ui";
import { TxsViewSwitch } from "@/components/explorer-v2/evm/views";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import { useExplorerNetwork } from "@/components/explorer/useExplorerNetwork";

/* The Transactions tab's ICM view, in the explorer's own shell: the search header
   every EVM page begins with. The chain layout already provides the
   ExplorerProvider the message feed reads. */
export function IcmPageClient({ chainSlug }: { chainSlug: string }) {
  const chain = useChainContext();
  const network = useExplorerNetwork();
  return (
    <EvmShell network={network}>
      <div className="mb-6">
        <SectionHeader label="ICM Messages" action={<TxsViewSwitch base={`/explorer/${network}/${chain.chainSlug ?? chainSlug}`} slug={chain.chainSlug ?? chainSlug} view="icm" />} />
      </div>
      <IcmMessagesPage
        chainId={chain.chainId}
        chainSlug={chain.chainSlug ?? chainSlug}
        tokenSymbol={chain.nativeToken}
      />
    </EvmShell>
  );
}
