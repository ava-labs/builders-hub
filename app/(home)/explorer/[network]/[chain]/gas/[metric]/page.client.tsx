"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { GasMetricContent } from "@/components/explorer/GasMetricPage";
import type { GasMetricKey } from "@/components/explorer/gas-metrics";
import { useChainContext } from "../../layout.client";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";

/* A gas metric's detail sheet, mounted inside the chain's own chrome —
   same shell idiom as the Gas tab it opens from. */
export function ChainGasMetricPageClient({
  chainSlug,
  metric,
}: {
  chainSlug: string;
  metric: GasMetricKey;
}) {
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
      // the sheet carries its own title and breadcrumb; the chain identity
      // stays in the subnav's switcher
      hideHeader
    >
      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-5 pb-16 pt-8 md:px-6">
        {catalog ? (
          <GasMetricContent
            catalog={catalog}
            base={`/explorer/${catalog.isTestnet === true ? "fuji" : "mainnet"}/${chainSlug}`}
            metric={metric}
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
