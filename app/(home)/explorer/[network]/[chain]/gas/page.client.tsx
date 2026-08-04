"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { GasMarketContent } from "@/components/explorer/GasMarketPage";
import { useChainContext } from "../layout.client";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";

/* The chain's Gas tab: the gas market instrument mounted inside this
   chain's own chrome — same shell idiom as /details. */
export function ChainGasPageClient({ chainSlug }: { chainSlug: string }) {
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
      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-5 pb-16 pt-2 md:px-6">
        {catalog ? (
          <GasMarketContent
            catalog={catalog}
            base={`/explorer/${catalog.isTestnet === true ? "fuji" : "mainnet"}/${chainSlug}`}
          />
        ) : (
          <p className="py-16 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
            No catalog record for this chain
          </p>
        )}
      </div>
    </ExplorerLayout>
  );
}
