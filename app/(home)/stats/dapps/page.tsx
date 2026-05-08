"use client";
import { useState } from "react";
import { AppWindow } from "lucide-react";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { DappsHero } from "./_components/DappsHero";
import { TopProtocolsGrid } from "./_components/TopProtocolsGrid";
import { OnChainAnalyticsSection } from "./_components/OnChainAnalyticsSection";
import { DappsTableControls } from "./_components/DappsTableControls";
import { DappsTable } from "./_components/DappsTable";
import { DappsLoadingSkeleton } from "./_components/DappsLoadingSkeleton";
import type { ChainStatsRange } from "./_components/types";
import { useDapps } from "./_hooks/useDapps";
import { useChainStats } from "./_hooks/useChainStats";
import { useDappsTable } from "./_hooks/useDappsTable";

export default function DAppsPage() {
  const { dapps, metrics, loading, error } = useDapps();
  const [chainStatsRange, setChainStatsRange] =
    useState<ChainStatsRange>("all");
  const {
    data: chainStats,
    loading: chainStatsLoading,
    error: chainStatsError,
  } = useChainStats(chainStatsRange);

  const table = useDappsTable(dapps);

  if (loading) {
    return <DappsLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AppWindow className="h-12 w-12 text-red-500 mx-auto" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <DappsHero metrics={metrics} />

      <TopProtocolsGrid dapps={dapps} />

      <OnChainAnalyticsSection
        data={chainStats}
        loading={chainStatsLoading}
        error={chainStatsError}
        range={chainStatsRange}
        onRangeChange={setChainStatsRange}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <DappsTableControls
          trackedCount={table.sortedData.length}
          visibleCategories={table.visibleCategories}
          overflowCategories={table.overflowCategories}
          selectedCategory={table.selectedCategory}
          onCategoryChange={table.setSelectedCategory}
          getCategoryCount={table.getCategoryCount}
          categoryDropdownOpen={table.categoryDropdownOpen}
          onCategoryDropdownToggle={table.setCategoryDropdownOpen}
          categoryDropdownRef={table.categoryDropdownRef}
          showOnChainOnly={table.showOnChainOnly}
          onShowOnChainOnlyChange={table.setShowOnChainOnly}
          searchTerm={table.searchTerm}
          onSearchChange={table.setSearchTerm}
          onSearchClear={table.clearSearch}
        />

        <DappsTable
          visibleData={table.visibleData}
          sortedData={table.sortedData}
          hasMoreData={table.hasMoreData}
          visibleCount={table.visibleCount}
          sortField={table.sortField}
          sortDirection={table.sortDirection}
          onSort={table.onSort}
          onLoadMore={table.onLoadMore}
        />
      </div>

      <StatsBubbleNav />
    </div>
  );
}
