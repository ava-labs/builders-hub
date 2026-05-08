"use client";
import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { OverviewHero } from "./_components/OverviewHero";
import { OverviewNetworkSection } from "./_components/OverviewNetworkSection";
import { OverviewTableControls } from "./_components/OverviewTableControls";
import { OverviewSummaryTable } from "./_components/OverviewSummaryTable";
import { OverviewValidatorsTable } from "./_components/OverviewValidatorsTable";
import { OverviewPageSkeleton } from "./_components/OverviewSkeletons";
import {
  getChainCategory,
  getCategoryForSubnetId,
} from "./_components/chain-helpers";
import { calculateValidatorStats } from "./_components/validator-helpers";
import {
  type SortDirection,
  type TableView,
  type TimeRangeKey,
} from "./_components/types";
import { useOverviewMetrics } from "./_hooks/useOverviewMetrics";
import { useAvaxSupply } from "./_hooks/useAvaxSupply";
import { useIcmFlows } from "./_hooks/useIcmFlows";
import { useValidatorStats } from "./_hooks/useValidatorStats";
import { useCosmosData } from "./_hooks/useCosmosData";
import { useThemedLogo } from "./_hooks/useThemedLogo";

const MAX_VISIBLE_CATEGORIES = 4;
const PAGE_SIZE = 25;

export default function AvalancheMetrics() {
  const { getThemedLogoUrl } = useThemedLogo();
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("day");
  const [tableView, setTableView] = useState<TableView>("summary");
  const [sortField, setSortField] = useState<string>("activeAddresses");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [minVersion, setMinVersion] = useState<string>("");

  const {
    data: overviewMetrics,
    initialLoading,
    refetching,
    error,
  } = useOverviewMetrics(timeRange);
  const { data: avaxSupply } = useAvaxSupply();
  const { flows: icmFlows, failedChainIds } = useIcmFlows();
  const cosmosData = useCosmosData(overviewMetrics?.chains);
  const {
    stats: validatorStats,
    loading: validatorStatsLoading,
    availableVersions,
  } = useValidatorStats(tableView === "validators");

  // Default minVersion to the highest available version once they load.
  useEffect(() => {
    if (!minVersion && availableVersions.length > 0) {
      setMinVersion(availableVersions[0]);
    }
  }, [availableVersions, minVersion]);

  const chains = overviewMetrics?.chains || [];

  // Categories with counts (used by the Controls component for chips + dropdown).
  const { visibleCategories, overflowCategories, categoryCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    chains.forEach((chain) => {
      const category = getChainCategory(chain.chainId, chain.chainName);
      counts.set(category, (counts.get(category) || 0) + 1);
    });

    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);

    return {
      visibleCategories: ["All", ...sorted.slice(0, MAX_VISIBLE_CATEGORIES)],
      overflowCategories: sorted.slice(MAX_VISIBLE_CATEGORIES),
      categoryCounts: counts,
    };
  }, [chains]);

  // Filter + sort summary view.
  const summaryData = useMemo(() => {
    const filtered = chains.filter((chain) => {
      const category = getChainCategory(chain.chainId, chain.chainName);
      const matchesCategory =
        selectedCategory === "All" || category === selectedCategory;
      const matchesSearch = chain.chainName
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      switch (sortField) {
        case "chainName":
          aValue = a.chainName;
          bValue = b.chainName;
          break;
        case "txCount":
          aValue = a.txCount || 0;
          bValue = b.txCount || 0;
          break;
        case "activeAddresses":
          aValue = a.activeAddresses || 0;
          bValue = b.activeAddresses || 0;
          break;
        case "marketCap":
          aValue = a.marketCap ?? 0;
          bValue = b.marketCap ?? 0;
          break;
        case "validatorCount":
          aValue = typeof a.validatorCount === "number" ? a.validatorCount : 0;
          bValue = typeof b.validatorCount === "number" ? b.validatorCount : 0;
          break;
        case "tps":
          aValue = a.tps || 0;
          bValue = b.tps || 0;
          break;
        case "category":
          aValue = getChainCategory(a.chainId, a.chainName);
          bValue = getChainCategory(b.chainId, b.chainName);
          break;
        default:
          aValue = 0;
          bValue = 0;
      }
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      const aNum = typeof aValue === "number" ? aValue : 0;
      const bNum = typeof bValue === "number" ? bValue : 0;
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [chains, searchTerm, selectedCategory, sortField, sortDirection]);

  // Filter + sort validators view.
  const validatorData = useMemo(() => {
    const filtered = validatorStats.filter((subnet) => {
      const category = getCategoryForSubnetId(subnet.id, subnet.name);
      const matchesCategory =
        selectedCategory === "All" || category === selectedCategory;
      const matchesSearch =
        subnet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        subnet.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      const aStats = calculateValidatorStats(a, minVersion);
      const bStats = calculateValidatorStats(b, minVersion);
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "chainName":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "validatorCount":
          aValue = aStats.totalNodes;
          bValue = bStats.totalNodes;
          break;
        case "nodesPercent":
          aValue = aStats.nodesPercentAbove;
          bValue = bStats.nodesPercentAbove;
          break;
        case "stakePercent":
          aValue = aStats.stakePercentAbove;
          bValue = bStats.stakePercentAbove;
          break;
        default:
          aValue = aStats.totalNodes;
          bValue = bStats.totalNodes;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      const aNum = typeof aValue === "number" ? aValue : 0;
      const bNum = typeof bValue === "number" ? bValue : 0;
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [validatorStats, searchTerm, selectedCategory, sortField, sortDirection, minVersion]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setVisibleCount(PAGE_SIZE);
  };

  const handleLoadMore = () => {
    const total =
      tableView === "summary" ? summaryData.length : validatorData.length;
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, total));
  };

  const handleTableViewChange = (view: TableView) => {
    setTableView(view);
    setVisibleCount(PAGE_SIZE);
    setSortField(view === "summary" ? "activeAddresses" : "validatorCount");
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setVisibleCount(PAGE_SIZE);
  };

  // Initial loading state — full-page skeleton until the first metrics arrive.
  if (initialLoading && !overviewMetrics) {
    return <OverviewPageSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Activity className="h-12 w-12 text-red-500 mx-auto" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  if (!overviewMetrics || overviewMetrics.chains.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500">No data available</p>
        <StatsBubbleNav />
      </div>
    );
  }

  const trackedCount =
    tableView === "summary" ? summaryData.length : validatorData.length;
  const visibleSummary = summaryData.slice(0, visibleCount);
  const visibleValidators = validatorData.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <OverviewHero
        metrics={overviewMetrics}
        avaxSupply={avaxSupply}
        timeRange={timeRange}
        refetching={refetching}
        onTimeRangeChange={setTimeRange}
      />

      <OverviewNetworkSection
        cosmosData={cosmosData}
        icmFlows={icmFlows}
        failedChainIds={failedChainIds}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <OverviewTableControls
          tableView={tableView}
          onTableViewChange={handleTableViewChange}
          trackedCount={trackedCount}
          visibleCategories={visibleCategories}
          overflowCategories={overflowCategories}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
          categoryCounts={categoryCounts}
          totalChains={chains.length}
          searchTerm={searchTerm}
          onSearchChange={(term) => {
            setSearchTerm(term);
            setVisibleCount(PAGE_SIZE);
          }}
          onSearchClear={() => {
            setSearchTerm("");
            setVisibleCount(PAGE_SIZE);
          }}
          availableVersions={availableVersions}
          minVersion={minVersion}
          onMinVersionChange={setMinVersion}
        />

        {tableView === "summary" ? (
          <OverviewSummaryTable
            data={visibleSummary}
            totalCount={summaryData.length}
            visibleCount={visibleCount}
            loading={refetching}
            timeRange={timeRange}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onLoadMore={handleLoadMore}
            getThemedLogoUrl={getThemedLogoUrl}
          />
        ) : (
          <OverviewValidatorsTable
            data={visibleValidators}
            totalCount={validatorData.length}
            visibleCount={visibleCount}
            loading={validatorStatsLoading}
            minVersion={minVersion}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onLoadMore={handleLoadMore}
            getThemedLogoUrl={getThemedLogoUrl}
          />
        )}
      </div>

      <StatsBubbleNav />
    </div>
  );
}
