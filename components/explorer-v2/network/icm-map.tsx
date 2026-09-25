"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ChainCosmosData, ICMFlowRoute } from "@/components/stats/NetworkDiagram";
import { Board, SectionHeader } from "@/components/explorer-v2/ui";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

/* The network as a cosmos on the ICM tab: every validator set a body,
   30 days of ICM traffic as arcs between them. It fetches its own data,
   so the page only mounts it. */

interface MapChain {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: number | null;
  activeAddresses: number | null;
  icmMessages: number | null;
  validatorCount: number | string;
  tps: number | null;
}

/* a 1.6k-line canvas: client only, never in the first paint */
const NetworkDiagram = dynamic(() => import("@/components/stats/NetworkDiagram"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-900 dark:bg-black" />,
});

const catalogByChainId = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true).map((c) => [String(c.chainId), c]),
);

/* a stable tint for catalog chains without a brand color */
function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${hash % 360}, 70%, 50%)`;
}

export function IcmNetworkMap() {
  const [chains, setChains] = useState<MapChain[] | null>(null);
  const [flows, setFlows] = useState<ICMFlowRoute[]>([]);
  const [failedChainIds, setFailedChainIds] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    // the arcs are 30 days, so the bodies are too
    fetch("/api/overview-stats?timeRange=month", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { chains?: MapChain[] }) => setChains(d.chains ?? []))
      .catch(() => {});
    // a failed flow feed is not fatal: the bodies still draw, without traffic
    fetch("/api/icm-flow?days=30", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { flows?: ICMFlowRoute[]; failedChainIds?: string[] }) => {
        if (Array.isArray(d.flows)) setFlows(d.flows);
        if (Array.isArray(d.failedChainIds)) setFailedChainIds(d.failedChainIds);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  /* validator-backed chains only, largest sets first to anchor the layout */
  const cosmos = useMemo<ChainCosmosData[]>(
    () =>
      (chains ?? [])
        .map((c) => {
          const validatorCount = typeof c.validatorCount === "number" ? c.validatorCount : 0;
          if (validatorCount === 0) return null;
          const catalog = catalogByChainId.get(String(c.chainId));
          return {
            id: catalog?.subnetId || c.chainId,
            chainId: c.chainId,
            name: c.chainName,
            logo: c.chainLogoURI,
            color: catalog?.color || colorFromName(c.chainName),
            validatorCount,
            subnetId: catalog?.subnetId,
            activeAddresses: (c.activeAddresses ?? 0) > 0 ? c.activeAddresses! : undefined,
            txCount: (c.txCount ?? 0) > 0 ? Math.round(c.txCount!) : undefined,
            icmMessages: (c.icmMessages ?? 0) > 0 ? Math.round(c.icmMessages!) : undefined,
            tps: (c.tps ?? 0) > 0 ? parseFloat(c.tps!.toFixed(2)) : undefined,
            category: catalog?.category || "General",
          } as ChainCosmosData;
        })
        .filter((c): c is ChainCosmosData => c !== null)
        .sort((a, b) => b.validatorCount - a.validatorCount),
    [chains],
  );

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Network Map · 30 days" />
      <Board divide={false} className="overflow-hidden bg-zinc-900 p-0 dark:bg-black">
        <div className="h-[400px] sm:h-[500px] md:h-[560px]">
          {cosmos.length > 0 ? (
            <NetworkDiagram data={cosmos} icmFlows={flows} failedChainIds={failedChainIds} />
          ) : (
            <div className="h-full w-full animate-pulse bg-zinc-900 dark:bg-black" />
          )}
        </div>
      </Board>
    </section>
  );
}
