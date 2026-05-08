"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChartArea, Compass, Users, AlertTriangle } from "lucide-react";
import {
  VersionBarChart,
  VersionLabels,
} from "@/components/stats/VersionBreakdown";
import { type SubnetStats } from "@/types/validator-stats";
import { SortButton } from "./SortButton";
import { TableSkeleton } from "./OverviewSkeletons";
import {
  getSlugForSubnetId,
  getValidatorSlugForSubnetId,
} from "./chain-helpers";
import {
  calculateValidatorStats,
  getHealthColor,
} from "./validator-helpers";
import type { SortDirection } from "./types";

const PRIMARY_NETWORK_ID = "11111111111111111111111111111111LpoYY";

interface OverviewValidatorsTableProps {
  data: SubnetStats[];
  totalCount: number;
  visibleCount: number;
  loading: boolean;
  minVersion: string;
  sortField: string;
  sortDirection: SortDirection;
  onSort: (field: string) => void;
  onLoadMore: () => void;
  getThemedLogoUrl: (logoUrl: string) => string;
}

function formatNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

export function OverviewValidatorsTable({
  data,
  totalCount,
  visibleCount,
  loading,
  minVersion,
  sortField,
  sortDirection,
  onSort,
  onLoadMore,
  getThemedLogoUrl,
}: OverviewValidatorsTableProps) {
  const router = useRouter();
  const hasMoreData = visibleCount < totalCount;

  return (
    <>
      <div className="overflow-hidden border-0 bg-white dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 sm:px-6 py-4 text-left whitespace-nowrap">
                  <SortButton
                    field="chainName"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="left"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Name
                    </span>
                  </SortButton>
                </th>
                <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                  <SortButton
                    field="validatorCount"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="right"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Validators
                    </span>
                  </SortButton>
                </th>
                <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                  <SortButton
                    field="nodesPercent"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="right"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Nodes %
                    </span>
                  </SortButton>
                </th>
                <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                  <SortButton
                    field="stakePercent"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="right"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Stake %
                    </span>
                  </SortButton>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left whitespace-nowrap">
                  <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Version Breakdown
                  </span>
                </th>
                <th className="px-4 sm:px-6 py-4 text-center whitespace-nowrap">
                  <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading ? (
                <TableSkeleton />
              ) : (
                data.map((subnet) => {
                  const stats = calculateValidatorStats(subnet, minVersion);
                  const slug = getSlugForSubnetId(subnet.id);
                  const validatorSlug = getValidatorSlugForSubnetId(subnet.id);
                  const isPrimaryNetwork = subnet.id === PRIMARY_NETWORK_ID;
                  const canNavigate =
                    isPrimaryNetwork || (subnet.isL1 && !!validatorSlug);
                  return (
                    <tr
                      key={subnet.id}
                      onClick={() => {
                        if (isPrimaryNetwork) {
                          router.push("/stats/validators/c-chain");
                        } else if (validatorSlug && subnet.isL1) {
                          router.push(`/stats/validators/${validatorSlug}`);
                        }
                      }}
                      className={`group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50 ${canNavigate ? "cursor-pointer" : ""}`}
                    >
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden">
                            {subnet.chainLogoURI ? (
                              <Image
                                src={
                                  getThemedLogoUrl(subnet.chainLogoURI) ||
                                  "/placeholder.svg"
                                }
                                alt={subnet.name}
                                width={40}
                                height={40}
                                className="h-full w-full rounded-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="text-base font-semibold text-zinc-600 dark:text-zinc-300">
                                {subnet.name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {subnet.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {formatNumber(stats.totalNodes)}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <span
                          className={`text-sm font-medium ${getHealthColor(stats.nodesPercentAbove)}`}
                        >
                          {stats.nodesPercentAbove.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={`text-sm font-medium ${getHealthColor(stats.stakePercentAbove)}`}
                          >
                            {stats.stakePercentAbove.toFixed(1)}%
                          </span>
                          {stats.stakePercentAbove < 80 && (
                            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="space-y-1.5 min-w-[200px]">
                          <VersionBarChart
                            versionBreakdown={{
                              byClientVersion: subnet.byClientVersion,
                            }}
                            minVersion={minVersion}
                            totalNodes={stats.totalNodes}
                          />
                          <VersionLabels
                            versionBreakdown={{
                              byClientVersion: subnet.byClientVersion,
                            }}
                            minVersion={minVersion}
                            totalNodes={stats.totalNodes}
                            showPercentage={false}
                            size="sm"
                          />
                        </div>
                      </td>
                      <td
                        className="px-4 sm:px-6 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  if (isPrimaryNetwork) {
                                    router.push("/stats/l1/c-chain");
                                  } else if (slug) {
                                    router.push(`/stats/l1/${slug}`);
                                  }
                                }}
                                disabled={!isPrimaryNetwork && !slug}
                                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-500"
                              >
                                <ChartArea className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View Stats</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  if (isPrimaryNetwork) {
                                    router.push("/stats/validators/c-chain");
                                  } else if (validatorSlug && subnet.isL1) {
                                    router.push(
                                      `/stats/validators/${validatorSlug}`
                                    );
                                  }
                                }}
                                disabled={!canNavigate}
                                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-500"
                              >
                                <Users className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View Validators</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  if (isPrimaryNetwork) {
                                    router.push("/explorer/c-chain");
                                  } else if (slug) {
                                    router.push(`/explorer/${slug}`);
                                  }
                                }}
                                disabled={!isPrimaryNetwork && !slug}
                                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-500"
                              >
                                <Compass className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View Explorer</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMoreData && !loading && (
        <div className="flex justify-center mt-4 sm:mt-6 pb-14">
          <Button
            onClick={onLoadMore}
            variant="outline"
            size="lg"
            className="px-4 sm:px-8 py-2 sm:py-3 text-sm sm:text-base border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-900 text-black dark:text-white transition-colors hover:border-black dark:hover:border-white hover:bg-[#fcfcfd] dark:hover:bg-neutral-900"
          >
            <span className="hidden sm:inline">Load More Chains </span>
            <span className="sm:hidden">Load More </span>(
            {totalCount - visibleCount} remaining)
          </Button>
        </div>
      )}
    </>
  );
}
