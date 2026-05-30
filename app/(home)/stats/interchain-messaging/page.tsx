"use client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircleMore } from "lucide-react";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { allChains } from "@/components/stats/ChainCategoryFilter";
import { ICMHero } from "./_components/ICMHero";
import { ICMStickyNav } from "./_components/ICMStickyNav";
import { ICMLoadingSkeleton } from "./_components/ICMLoadingSkeleton";
import { ICMOverviewSection } from "./_components/ICMOverviewSection";
import { TopChainsSection } from "./_components/TopChainsSection";
import { ICTTSection } from "./_components/ICTTSection";
import { TopTransfersSection } from "./_components/TopTransfersSection";
import type { ChartPeriod, SectionDefinition } from "./_components/types";
import { useIcmStats } from "./_hooks/useIcmStats";
import { useIcttStats } from "./_hooks/useIcttStats";
import { useIcmFlows } from "./_hooks/useIcmFlows";
import { useScrollSection } from "./_hooks/useScrollSection";
import { useFilteredIcmData } from "./_hooks/useFilteredIcmData";

const SECTIONS: readonly SectionDefinition[] = [
  { id: "overview", label: "ICM Overview" },
  { id: "top-chains", label: "Top Chains" },
  { id: "ictt", label: "ICTT Analytics" },
  { id: "transfers", label: "Top Transfers" },
];

export default function ICMStatsPage() {
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

  const { activeSection, scrollToSection } = useScrollSection(
    SECTIONS,
    "overview"
  );

  if (icmLoading) {
    return <ICMLoadingSkeleton />;
  }

  if (icmError) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
          <Card className="border border-zinc-200 dark:border-zinc-700 rounded-lg bg-card max-w-md shadow-none mx-auto">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-950 rounded-lg flex items-center justify-center mx-auto mb-4">
                <MessageCircleMore className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                Failed to Load Data
              </h3>
              <p className="text-red-600 dark:text-red-400 text-sm mb-4">
                {icmError}
              </p>
              <Button onClick={retryIcm}>Retry</Button>
            </div>
          </Card>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  // Header-row aggregates that depend on totalICMMessages.
  const avgDailyICM = Math.round(totalICMMessages / 365);
  const totalICTTTransfers = icttData?.overview?.totalTransfers || 0;
  const icttPercentage =
    totalICMMessages > 0
      ? ((totalICTTTransfers / totalICMMessages) * 100).toFixed(1)
      : "0";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <ICMHero
        totalICMMessages={totalICMMessages}
        dailyICM={dailyICM}
        avgDailyICM={avgDailyICM}
        totalICTTTransfers={totalICTTTransfers}
        icttPercentage={icttPercentage}
        selectedChainIds={selectedChainIds}
        onSelectionChange={setSelectedChainIds}
      />

      <ICMStickyNav
        sections={SECTIONS}
        activeSection={activeSection}
        onSectionClick={scrollToSection}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12 sm:space-y-16 pb-24">
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
      </main>

      <StatsBubbleNav />
    </div>
  );
}
