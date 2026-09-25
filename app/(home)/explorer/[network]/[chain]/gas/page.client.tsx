"use client";

import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { GasMarketContent } from "@/components/explorer/GasMarketPage";
import { useChainContext } from "../layout.client";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";

/* The chain's Gas tab: the gas market instrument in the explorer's own
   shell, the search header every EVM page begins with. */
export function ChainGasPageClient({ chainSlug }: { chainSlug: string }) {
  const chain = useChainContext();
  const catalog = (l1ChainsData as L1Chain[]).find((c) => c.chainId === chain.chainId);

  return (
    <EvmShell network={catalog?.isTestnet === true ? "fuji" : "mainnet"}>
      <div className="flex flex-col gap-10">
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
    </EvmShell>
  );
}
