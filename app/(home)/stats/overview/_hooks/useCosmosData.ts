"use client";
import { useMemo } from "react";
import type { L1Chain } from "@/types/stats";
import l1ChainsData from "@/constants/l1-chains.json";
import type { ChainCosmosData } from "@/components/stats/NetworkDiagram";
import type { ChainOverviewMetrics } from "../_components/types";
import { generateColorFromName } from "../_components/chain-helpers";

const allChains = l1ChainsData as L1Chain[];

// Transforms raw overview metrics into the shape expected by NetworkDiagram.
// Drops chains with no validators (they render as orphan dots) and sorts by
// validator count so the diagram's largest nodes anchor the layout.
export function useCosmosData(
  chains: ChainOverviewMetrics[] | undefined
): ChainCosmosData[] {
  return useMemo(() => {
    if (!chains) return [];

    return chains
      .map((chain) => {
        const l1Chain = allChains.find(
          (c) =>
            c.chainId === chain.chainId ||
            c.chainName.toLowerCase() === chain.chainName.toLowerCase()
        );

        const validatorCount =
          typeof chain.validatorCount === "number" ? chain.validatorCount : 0;
        if (validatorCount === 0) return null;

        return {
          id: l1Chain?.subnetId || chain.chainId,
          chainId: chain.chainId,
          name: chain.chainName,
          logo: chain.chainLogoURI,
          color: l1Chain?.color || generateColorFromName(chain.chainName),
          validatorCount,
          subnetId: l1Chain?.subnetId,
          activeAddresses:
            chain.activeAddresses > 0 ? chain.activeAddresses : undefined,
          txCount: chain.txCount > 0 ? Math.round(chain.txCount) : undefined,
          icmMessages:
            chain.icmMessages > 0 ? Math.round(chain.icmMessages) : undefined,
          tps: chain.tps > 0 ? parseFloat(chain.tps.toFixed(2)) : undefined,
          category: l1Chain?.category || "General",
        } as ChainCosmosData;
      })
      .filter((chain): chain is ChainCosmosData => chain !== null)
      .sort((a, b) => b.validatorCount - a.validatorCount);
  }, [chains]);
}
