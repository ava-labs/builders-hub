"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { AlertTriangle, ArrowRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Board,
  BoardHeader,
  ChartBoard,
  StatCell,
  StatFigure,
} from "@/components/explorer-v2/ui";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { SortIcon } from "@/components/stats/SortIcon";
import {
  compareVersions,
  VersionBarChart,
  VersionLabels,
  VersionBreakdownInline,
} from "@/components/stats/VersionBreakdown";
import { type SubnetStats } from "@/types/validator-stats";
import { PRIMARY_NETWORK_ID, useValidatorStats } from "@/components/explorer-v2/validator-stats";
import type { L1Chain } from "@/types/stats";
import l1ChainsData from "@/constants/l1-chains.json";

/* The network-scope validator aggregate — every validator set on Mainnet,
   from the Primary Network down to each L1: node counts, stake, and how far
   each set has caught up to a target client version. Lifted wholesale from
   the old /stats/validators page; the gradient hero is gone, its headline
   metrics survive as the stat strip and the table wears the v2 grammar.
   Rows link into each chain's own Validators tab. */

type SortColumn = "name" | "nodeCount" | "nodes" | "stake";
type SortDirection = "asc" | "desc";

const TH =
  "px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500 md:px-6";
const TD = "px-5 py-3.5 text-[13px] md:px-6";

/* the action-slot qualifier chip — a window tag or a count, in the quiet
   mono voice every board header shares (this page has no clock; the one
   window statement is the lead board's "Current set") */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
      {children}
    </span>
  );
}

export function NetworkValidators() {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [minVersion, setMinVersion] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("nodeCount");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(25);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getThemedLogoUrl = (logoUrl: string): string => {
    if (!isMounted || !logoUrl) return logoUrl;
    // handle both light and dark mode logo variants
    return resolvedTheme === "dark"
      ? logoUrl.replace(/Light/g, "Dark")
      : logoUrl.replace(/Dark/g, "Light");
  };

  // resolve a subnet id to its catalog slug (mainnet chains only)
  const getSlugForSubnetId = (subnetId: string): string | null => {
    const chain = (l1ChainsData as L1Chain[]).find((c) => c.subnetId === subnetId);
    if (chain?.isTestnet) return null;
    return chain?.slug || null;
  };

  // the row's per-chain detail target, or null when there's nowhere to go.
  // Primary Network staking lives on the C-Chain's Validators tab.
  const rowHref = (subnet: SubnetStats): string | null => {
    if (subnet.id === PRIMARY_NETWORK_ID) return "/explorer/mainnet/c-chain/validators";
    if (subnet.isL1) {
      const slug = getSlugForSubnetId(subnet.id);
      if (slug) return `/explorer/mainnet/${slug}/validators`;
    }
    return null;
  };

  // network scope is mainnet-only (the aggregate source doesn't cover Fuji)
  const { subnets, error: feedError, loading } = useValidatorStats();
  const data = subnets ?? [];
  const error = feedError ? "Failed to load validator stats" : null;

  const availableVersions = useMemo(() => {
    const versions = new Set<string>();
    data.forEach((subnet) => {
      Object.keys(subnet.byClientVersion).forEach((v) => versions.add(v));
    });
    return Array.from(versions)
      .filter((v) => v !== "Unknown")
      .sort()
      .reverse();
  }, [data]);

  // default the filter to the newest version once the feed lands
  useEffect(() => {
    if (!minVersion && availableVersions.length > 0) {
      setMinVersion(availableVersions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableVersions]);

  const calculateStats = (subnet: SubnetStats) => {
    const totalStake = BigInt(subnet.totalStakeString);
    let aboveTargetNodes = 0;
    let belowTargetNodes = 0;
    let aboveTargetStake = 0n;

    Object.entries(subnet.byClientVersion).forEach(([version, d]) => {
      const isAboveTarget = compareVersions(version, minVersion) >= 0;
      if (isAboveTarget) {
        aboveTargetNodes += d.nodes;
        aboveTargetStake += BigInt(d.stakeString);
      } else {
        belowTargetNodes += d.nodes;
      }
    });

    const totalNodes = aboveTargetNodes + belowTargetNodes;
    const nodesPercentAbove =
      totalNodes > 0 ? (aboveTargetNodes / totalNodes) * 100 : 0;
    const stakePercentAbove =
      totalStake > 0n
        ? Number((aboveTargetStake * 10000n) / totalStake) / 100
        : 0;

    return {
      totalNodes,
      aboveTargetNodes,
      belowTargetNodes,
      nodesPercentAbove,
      stakePercentAbove,
      isStakeHealthy: stakePercentAbove >= 80,
    };
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
    setVisibleCount(25);
  };

  const formatNumber = (num: number | string): string => {
    if (num === "N/A" || num === "" || num === null || num === undefined)
      return "N/A";
    const numValue = typeof num === "string" ? Number.parseFloat(num) : num;
    if (isNaN(numValue)) return "N/A";

    if (numValue >= 1e12) return `${(numValue / 1e12).toFixed(2)}T`;
    if (numValue >= 1e9) return `${(numValue / 1e9).toFixed(2)}B`;
    if (numValue >= 1e6) return `${(numValue / 1e6).toFixed(2)}M`;
    if (numValue >= 1e3) return `${(numValue / 1e3).toFixed(2)}K`;
    return numValue.toLocaleString();
  };

  const filteredData = data.filter(
    (subnet) =>
      subnet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subnet.id.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const sortedData = [...filteredData].sort((a, b) => {
    let aValue: any;
    let bValue: any;
    const aStats = calculateStats(a);
    const bStats = calculateStats(b);

    switch (sortColumn) {
      case "name":
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case "nodeCount":
        aValue = aStats.totalNodes;
        bValue = bStats.totalNodes;
        break;
      case "nodes":
        aValue = aStats.nodesPercentAbove;
        bValue = bStats.nodesPercentAbove;
        break;
      case "stake":
        aValue = aStats.stakePercentAbove;
        bValue = bStats.stakePercentAbove;
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

  const visibleData = sortedData.slice(0, visibleCount);
  const hasMoreData = visibleCount < sortedData.length;
  const handleLoadMore = () =>
    setVisibleCount((prev) => Math.min(prev + 25, sortedData.length));

  // headline metrics — what the old hero showed, now the stat strip
  const aggregatedStats = {
    totalSubnets: data.length,
    l1Count: data.filter((subnet) => subnet.isL1).length,
    totalNodes: data.reduce(
      (sum, subnet) => sum + calculateStats(subnet).totalNodes,
      0,
    ),
  };

  const totalVersionBreakdown = useMemo(
    () =>
      data.reduce(
        (acc, subnet) => {
          Object.entries(subnet.byClientVersion).forEach(([version, d]) => {
            if (!acc[version]) acc[version] = { nodes: 0 };
            acc[version].nodes += d.nodes;
          });
          return acc;
        },
        {} as Record<string, { nodes: number }>,
      ),
    [data],
  );

  const upToDateValidators = Object.entries(totalVersionBreakdown).reduce(
    (sum, [version, d]) =>
      compareVersions(version, minVersion) >= 0 ? sum + d.nodes : sum,
    0,
  );
  const upToDatePercentage =
    aggregatedStats.totalNodes > 0
      ? (upToDateValidators / aggregatedStats.totalNodes) * 100
      : 0;

  const getHealthColor = (percent: number): string => {
    if (percent === 0) return "text-[#E6212F]";
    if (percent < 80) return "text-amber-600 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
  };

  const SortButton = ({
    column,
    children,
  }: {
    column: SortColumn;
    children: React.ReactNode;
  }) => (
    <button
      className="inline-flex items-center gap-1.5 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
      onClick={() => handleSort(column)}
    >
      {children}
      <SortIcon
        column={column}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        iconVariant="arrow"
        className="h-3 w-3"
      />
    </button>
  );

  let content: React.ReactNode;

  if (loading) {
    content = (
      <div className="flex flex-col gap-10" role="status" aria-label="Loading validators">
        <Board divide={false} className="border">
          <BoardHeader label="Validators" display action={<Chip>Current set</Chip>} />
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2.5 px-5 py-5 md:px-6">
                <span className="h-2.5 w-20 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                <span className="h-7 w-24 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
              </div>
            ))}
          </div>
        </Board>
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="h-12 w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
      </div>
    );
  } else if (error) {
    content = (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#E6212F]">
          {error}
        </p>
      </div>
    );
  } else if (!data || data.length === 0) {
    content = (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
          No validator data available
        </p>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-10">
        {/* the lead board: the former hero's headline metrics, and the one
            place the roster window is named. Nothing here follows a clock —
            this is the live set as it stands, so the chip says "Current set"
            rather than a time window */}
        <Board divide={false} className="border">
          <BoardHeader label="Validators" display action={<Chip>Current set</Chip>} />
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
            <StatCell label="Chains">
              <StatFigure value={aggregatedStats.totalSubnets} />
            </StatCell>
            <StatCell label="Validators">
              <StatFigure value={aggregatedStats.totalNodes} />
            </StatCell>
            <StatCell label="Up to date" sub={minVersion ? `≥ ${minVersion}` : undefined}>
              <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
                {upToDatePercentage.toFixed(1)}
                <span className="ml-0.5 text-sm text-zinc-400 dark:text-zinc-500">%</span>
              </span>
            </StatCell>
            <StatCell label="L1s">
              <StatFigure value={aggregatedStats.l1Count} />
            </StatCell>
          </div>
        </Board>

        {/* client-version spread across the whole network: the stacked
            distribution bar carries the picture, the labels name it. The
            green/gray split is measured against the selected target below,
            so the header chip names that target */}
        <ChartBoard
          label="Client Versions"
          bodyClassName="flex flex-col gap-4"
          action={minVersion ? <Chip>target {minVersion}</Chip> : undefined}
        >
          <VersionBarChart
            versionBreakdown={{ byClientVersion: totalVersionBreakdown }}
            minVersion={minVersion}
            totalNodes={aggregatedStats.totalNodes}
            height="h-8"
          />
          <VersionBreakdownInline
            versions={totalVersionBreakdown}
            minVersion={minVersion}
            limit={5}
          />
        </ChartBoard>

        {/* the validator sets. The search and target-version controls are
            page-level furniture (target version also drives the client-version
            board and the up-to-date stat above), so they lead; the table's
            own ChartBoard names the section and carries the set count */}
        <section className="flex flex-col gap-4">
          {/* search + target-version filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setVisibleCount(25);
                }}
                placeholder="Filter by name or subnet ID"
                spellCheck={false}
                className="w-full border border-zinc-200 bg-white/80 py-2.5 pl-11 pr-10 font-mono text-[12px] text-zinc-900 outline-none backdrop-blur-sm transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setVisibleCount(25);
                  }}
                  aria-label="Clear filter"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {availableVersions.length > 0 && (
              <label className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                  Target version
                </span>
                <select
                  value={minVersion}
                  onChange={(e) => setMinVersion(e.target.value)}
                  className="border border-zinc-200 bg-white/80 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-700 outline-none transition-colors focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:focus:border-zinc-100"
                >
                  {availableVersions.map((version) => (
                    <option key={version} value={version}>
                      {version}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <ChartBoard
            label="Validator Sets"
            bodyClassName="p-0 overflow-x-auto"
            action={<Chip>{sortedData.length} sets</Chip>}
          >
            <table className="w-full min-w-[56rem] border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                  <th className={TH}>
                    <SortButton column="name">Chain</SortButton>
                  </th>
                  <th className={cn(TH, "text-right")}>
                    <SortButton column="nodeCount">Validators</SortButton>
                  </th>
                  <th className={cn(TH, "text-right whitespace-nowrap")}>
                    <SortButton column="nodes">By nodes %</SortButton>
                  </th>
                  <th className={cn(TH, "text-right whitespace-nowrap")}>
                    <SortButton column="stake">By stake %</SortButton>
                  </th>
                  <th className={TH}>Version breakdown</th>
                  <th className={cn(TH, "text-right")} aria-label="Detail" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {visibleData.map((subnet) => {
                  const stats = calculateStats(subnet);
                  const href = rowHref(subnet);
                  const kind =
                    subnet.id === PRIMARY_NETWORK_ID
                      ? "Primary Network"
                      : subnet.isL1
                        ? "L1"
                        : "Subnet";
                  return (
                    <tr
                      key={subnet.id}
                      className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    >
                      <td className={cn(TD, "max-w-80")}>
                        <span className="flex items-center gap-3">
                          <span className="relative h-7 w-7 shrink-0">
                            {subnet.chainLogoURI ? (
                              <Image
                                src={getThemedLogoUrl(subnet.chainLogoURI) || "/placeholder.svg"}
                                alt=""
                                width={28}
                                height={28}
                                className="h-7 w-7 rounded-full object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 font-mono text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                                {subnet.name.charAt(0)}
                              </span>
                            )}
                          </span>
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="flex items-center gap-2">
                              {href ? (
                                <Link
                                  href={href}
                                  className="truncate font-medium text-[#0061E2] hover:underline dark:text-[#5f9dff]"
                                >
                                  {subnet.name}
                                </Link>
                              ) : (
                                <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                                  {subnet.name}
                                </span>
                              )}
                              <span className="shrink-0 border border-zinc-200 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                                {kind}
                              </span>
                            </span>
                            <span className="truncate font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
                              {subnet.id}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className={cn(TD, "text-right font-mono tabular-nums text-zinc-900 dark:text-zinc-100")}>
                        {formatNumber(stats.totalNodes)}
                      </td>
                      <td className={cn(TD, "text-right font-mono tabular-nums")}>
                        <span className={getHealthColor(stats.nodesPercentAbove)}>
                          {stats.nodesPercentAbove.toFixed(1)}%
                        </span>
                      </td>
                      <td className={cn(TD, "text-right font-mono tabular-nums")}>
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <span className={getHealthColor(stats.stakePercentAbove)}>
                            {stats.stakePercentAbove.toFixed(1)}%
                          </span>
                          {stats.stakePercentAbove < 80 && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          )}
                        </span>
                      </td>
                      <td className={cn(TD, "min-w-56")}>
                        <div className="flex flex-col gap-1.5">
                          <VersionBarChart
                            versionBreakdown={{ byClientVersion: subnet.byClientVersion }}
                            minVersion={minVersion}
                            totalNodes={stats.totalNodes}
                          />
                          <VersionLabels
                            versionBreakdown={{ byClientVersion: subnet.byClientVersion }}
                            minVersion={minVersion}
                            totalNodes={stats.totalNodes}
                            showPercentage={false}
                            size="sm"
                          />
                        </div>
                      </td>
                      <td className={cn(TD, "text-right")}>
                        {href ? (
                          <Link
                            href={href}
                            aria-label={`${subnet.name} validators`}
                            className="group/go inline-flex"
                          >
                            <ArrowRight className="h-3.5 w-3.5 text-zinc-300 transition-all group-hover/go:translate-x-0.5 group-hover/go:text-[#E6212F] dark:text-zinc-600" />
                          </Link>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-700">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {hasMoreData && (
              <div className="flex justify-center border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <button
                  onClick={handleLoadMore}
                  className="border border-zinc-200 bg-white/80 px-6 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 backdrop-blur-sm transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
                >
                  Load more · {sortedData.length - visibleCount} remaining
                </button>
              </div>
            )}
          </ChartBoard>
        </section>
      </div>
    );
  }

  return (
    <NetworkShell
      eyebrow="Avalanche Ecosystem"
      title="Validators"
      intro="Every validator set on the network: stake, nodes, and client versions, from the Primary Network down to each L1."
    >
      {content}
    </NetworkShell>
  );
}
