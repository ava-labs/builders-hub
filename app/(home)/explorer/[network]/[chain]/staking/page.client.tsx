"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { PrimaryStakingContent } from "@/components/explorer-v2/staking/PrimaryStaking";
import { useChainContext } from "../layout.client";

/* The C-Chain's Staking tab: the Primary Network's staking economy
   mounted inside the chain's own chrome — same shell idiom as /gas. */
export function ChainStakingPageClient({ chainSlug }: { chainSlug: string }) {
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
      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-5 pb-16 pt-2 md:px-6">
        <PrimaryStakingContent
          validatorsHref={`/explorer/mainnet/${chainSlug}/validators`}
          base={`/explorer/mainnet/${chainSlug}/staking`}
        />
      </div>
    </ExplorerLayout>
  );
}
