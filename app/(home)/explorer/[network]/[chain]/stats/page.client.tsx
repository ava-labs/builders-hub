"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { EvmStats } from "@/components/explorer-v2/evm/EvmStats";
import { useChainContext } from "../layout.client";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";

/* The chain's Stats tab: the metrics sheet mounted inside the chain's own
   chrome (hero, search, subnav) — same shell idiom as /gas. This absorbed
   /stats/l1/[slug], which now redirects here. */
export function ChainStatsPageClient({ chainSlug }: { chainSlug: string }) {
  const chain = useChainContext();
  const catalog = (l1ChainsData as L1Chain[]).find((c) => c.slug === chainSlug);

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
      <div className="mx-auto w-full max-w-[90rem] px-5 pb-16 pt-2 md:px-6">
        <EvmStats
          chainId={chain.chainId}
          chainSlug={chainSlug}
          tokenSymbol={catalog?.networkToken?.symbol ?? "AVAX"}
        />
      </div>
    </ExplorerLayout>
  );
}
