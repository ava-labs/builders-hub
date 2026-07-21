"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { SectionHeader, StatStrip, StatCell, StatFigure } from "@/components/explorer-v2/ui";
import {
  ChainCategoryFilter,
  allChains,
} from "@/components/stats/ChainCategoryFilter";
import { ICMOverviewSection } from "@/app/(home)/stats/interchain-messaging/_components/ICMOverviewSection";
import { TopChainsSection } from "@/app/(home)/stats/interchain-messaging/_components/TopChainsSection";
import { ICTTSection } from "@/app/(home)/stats/interchain-messaging/_components/ICTTSection";
import { TopTransfersSection } from "@/app/(home)/stats/interchain-messaging/_components/TopTransfersSection";
import { formatNumber } from "@/app/(home)/stats/interchain-messaging/_components/helpers";
import type { ChartPeriod } from "@/app/(home)/stats/interchain-messaging/_components/types";
import { useIcmStats } from "@/app/(home)/stats/interchain-messaging/_hooks/useIcmStats";
import { useIcttStats } from "@/app/(home)/stats/interchain-messaging/_hooks/useIcttStats";
import { useIcmFlows } from "@/app/(home)/stats/interchain-messaging/_hooks/useIcmFlows";
import { useFilteredIcmData } from "@/app/(home)/stats/interchain-messaging/_hooks/useFilteredIcmData";

const SHELL_INTRO =
  "Every ICM message and token transfer across the network — volume, routes, and the chains doing the talking. Per-chain message feeds live on each chain's own ICM tab.";

/* The network-scope ICM facet. The four data sections are ported verbatim
   from /stats/interchain-messaging; the page's hero, sticky nav, bubble nav
   and full-page skeleton are dropped in favor of the NetworkShell chrome and
   in-sheet loading/error states. The chain-category filter is kept (it feeds
   useFilteredIcmData) and framed in the sheet grammar rather than restyled,
   since ChainCategoryFilter is shared with other stats surfaces. */
export function NetworkIcm() {
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("D");
  const [selectedChainIds, setSelectedChainIds] = useState<Set<string>>(
    () => new Set(allChains.map((c) => c.chainId))
  );

  const selectedChainNames = useMemo(() => {
    const names = new Set<string>();
    allChains.forEach((chain) => {
      if (selectedChainIds.has(chain.chainId)) {
        names.add(chain.chainName);
      }
    });
    return names;
  }, [selectedChainIds]);

  const {
    data: metrics,
    loading: icmLoading,
    error: icmError,
    retry: retryIcm,
  } = useIcmStats();
  const {
    data: icttData,
    loadingMore: loadingMoreTransfers,
    error: icttError,
    retry: retryIctt,
    loadMore: loadMoreTransfers,
  } = useIcttStats();
  const {
    data: icmFlowData,
    loading: icmFlowLoading,
    error: icmFlowError,
    retry: retryIcmFlow,
  } = useIcmFlows();

  const {
    chartData,
    topChains,
    totalICMMessages,
    dailyICM,
    filteredIcmFlowData,
    filteredIcttData,
    getTopPeers,
  } = useFilteredIcmData(metrics, icttData, icmFlowData, selectedChainNames);

  // Header-row aggregates that depend on totalICMMessages.
  const avgDailyICM = Math.round(totalICMMessages / 365);
  const totalICTTTransfers = icttData?.overview?.totalTransfers || 0;
  const icttPercentage =
    totalICMMessages > 0
      ? ((totalICTTTransfers / totalICMMessages) * 100).toFixed(1)
      : "0";

  let body: React.ReactNode;
  if (icmLoading) {
    body = (
      <div className="flex flex-col gap-10" aria-label="Loading interchain messaging data" role="status">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-64 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    );
  } else if (icmError) {
    body = (
      <div className="flex flex-col items-center gap-5 py-24 text-center">
        <p className="max-w-md font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
          {icmError || "Failed to load interchain messaging data"}
        </p>
        <button
          onClick={retryIcm}
          className="inline-flex items-center border border-zinc-200 bg-white/80 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-900 transition-colors hover:border-zinc-900 hover:bg-zinc-900 hover:text-white dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:hover:border-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
        >
          Retry
        </button>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-10">
        <StatStrip cols={3}>
          <StatCell label="Total ICM (365d)">
            <StatFigure value={totalICMMessages} />
          </StatCell>
          <StatCell label="Latest Day ICM">
            <StatFigure value={dailyICM} suffix={`avg ${formatNumber(avgDailyICM)}`} />
          </StatCell>
          <StatCell label="ICTT Transfers">
            <StatFigure value={totalICTTTransfers} suffix={`${icttPercentage}% ICM`} />
          </StatCell>
        </StatStrip>

        <section className="flex flex-col gap-4">
          <SectionHeader label="Chain Filter" />
          <ChainCategoryFilter
            selectedChainIds={selectedChainIds}
            onSelectionChange={setSelectedChainIds}
            showChainChips
          />
        </section>

        <ICMOverviewSection
          metrics={metrics}
          chartData={chartData}
          chartPeriod={chartPeriod}
          onChartPeriodChange={setChartPeriod}
        />

        <TopChainsSection
          topChains={topChains}
          totalICMMessages={totalICMMessages}
          filteredIcmFlowData={filteredIcmFlowData}
          flowLoading={icmFlowLoading}
          flowError={icmFlowError}
          onRetryFlow={retryIcmFlow}
          getTopPeers={getTopPeers}
        />

        <ICTTSection
          data={icttData}
          totalICMMessages={totalICMMessages}
          loadingMore={loadingMoreTransfers}
          error={icttError}
          onLoadMore={loadMoreTransfers}
          onRetry={retryIctt}
        />

        <TopTransfersSection
          data={filteredIcttData}
          loadingMore={loadingMoreTransfers}
          onLoadMore={loadMoreTransfers}
        />
      </div>
    );
  }

  return (
    <NetworkShell
      eyebrow="Avalanche Ecosystem"
      title="Interchain Messaging"
      intro={SHELL_INTRO}
      aside={
        <Link
          href="/explorer/mainnet/chains"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#0061E2] transition-colors hover:text-[#E6212F] dark:text-[#5f9dff]"
        >
          Per-chain ICM feeds
          <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {body}
    </NetworkShell>
  );
}
