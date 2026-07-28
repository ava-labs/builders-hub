"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { StakingMetricContent } from "@/components/explorer-v2/staking/StakingMetricPage";
import type { StakingMetricKey } from "@/components/explorer-v2/staking/staking-metrics";
import { useChainContext } from "../../layout.client";

/* A staking metric's detail sheet, mounted inside the chain's own chrome —
   same shell idiom as the gas sheets. */
export function ChainStakingMetricPageClient({
  chainSlug,
  network,
  metric,
}: {
  chainSlug: string;
  network: string;
  metric: StakingMetricKey;
}) {
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
      // the sheet carries its own title and breadcrumb; the chain identity
      // stays in the subnav's switcher
      hideHeader
    >
      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-5 pb-16 pt-8 md:px-6">
        <StakingMetricContent
          base={`/explorer/${network}/${chainSlug}/staking`}
          network={network}
          metric={metric}
        />
      </div>
    </ExplorerLayout>
  );
}
