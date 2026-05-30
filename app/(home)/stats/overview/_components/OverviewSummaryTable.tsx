"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChartArea,
  Compass,
  Users,
  Info,
} from "lucide-react";
import { getCategoryColor } from "@/components/stats/CategoryChip";
import { formatMarketCap } from "@/lib/utils/format-market-cap";
import { SortButton } from "./SortButton";
import { TableSkeleton } from "./OverviewSkeletons";
import {
  getChainSlug,
  getValidatorChainSlug,
  getChainRpcUrl,
  getChainCategory,
} from "./chain-helpers";
import {
  TIME_RANGE_CONFIG,
  type ChainOverviewMetrics,
  type SortDirection,
  type TimeRangeKey,
} from "./types";

interface OverviewSummaryTableProps {
  data: ChainOverviewMetrics[];
  totalCount: number;
  visibleCount: number;
  loading: boolean;
  timeRange: TimeRangeKey;
  sortField: string;
  sortDirection: SortDirection;
  onSort: (field: string) => void;
  onLoadMore: () => void;
  getThemedLogoUrl: (logoUrl: string) => string;
}

function formatFullNumber(num: number): string {
  return num.toLocaleString();
}

export function OverviewSummaryTable({
  data,
  totalCount,
  visibleCount,
  loading,
  timeRange,
  sortField,
  sortDirection,
  onSort,
  onLoadMore,
  getThemedLogoUrl,
}: OverviewSummaryTableProps) {
  const router = useRouter();
  const timeRangeLabel = TIME_RANGE_CONFIG[timeRange].label;
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
                    field="activeAddresses"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="right"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {timeRangeLabel} Addresses
                    </span>
                  </SortButton>
                </th>
                <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                  <SortButton
                    field="txCount"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="right"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {timeRangeLabel} Txns
                    </span>
                  </SortButton>
                </th>
                <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                  <SortButton
                    field="marketCap"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="right"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1">
                      Market Cap
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 text-zinc-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Data from CoinGecko</p>
                        </TooltipContent>
                      </Tooltip>
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
                    field="tps"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="right"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Avg TPS
                    </span>
                  </SortButton>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left whitespace-nowrap">
                  <SortButton
                    field="category"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="left"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Category
                    </span>
                  </SortButton>
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
                data.map((chain) => {
                  const chainSlug = getChainSlug(chain.chainId, chain.chainName);
                  const validatorChainSlug = getValidatorChainSlug(
                    chain.chainId,
                    chain.chainName
                  );
                  const hasRpcUrl = !!getChainRpcUrl(
                    chain.chainId,
                    chain.chainName
                  );
                  const category = getChainCategory(
                    chain.chainId,
                    chain.chainName
                  );
                  return (
                    <tr
                      key={chain.chainId}
                      onClick={() =>
                        chainSlug && router.push(`/stats/l1/${chainSlug}`)
                      }
                      className={`group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50 ${chainSlug ? "cursor-pointer" : ""}`}
                    >
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden">
                            {chain.chainLogoURI ? (
                              <Image
                                src={
                                  getThemedLogoUrl(chain.chainLogoURI) ||
                                  "/placeholder.svg"
                                }
                                alt={chain.chainName}
                                width={40}
                                height={40}
                                className="h-full w-full rounded-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="text-base font-semibold text-zinc-600 dark:text-zinc-300">
                                {chain.chainName.charAt(0)}
                              </span>
                            )}
                          </div>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {chain.chainName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                        {typeof chain.activeAddresses === "number"
                          ? formatFullNumber(chain.activeAddresses)
                          : "N/A"}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                        {typeof chain.txCount === "number"
                          ? formatFullNumber(Math.round(chain.txCount))
                          : "N/A"}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                        {chain.marketCap ? formatMarketCap(chain.marketCap) : "-"}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                        {typeof chain.validatorCount === "number"
                          ? formatFullNumber(chain.validatorCount)
                          : chain.validatorCount}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                        {chain.tps.toFixed(2)}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getCategoryColor(category)}`}
                        >
                          {category}
                        </span>
                      </td>
                      <td
                        className="px-4 sm:px-6 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() =>
                                  chainSlug &&
                                  router.push(`/stats/l1/${chainSlug}`)
                                }
                                disabled={!chainSlug}
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
                                onClick={() =>
                                  validatorChainSlug &&
                                  router.push(
                                    `/stats/validators/${validatorChainSlug}`
                                  )
                                }
                                disabled={!validatorChainSlug}
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
                                onClick={() =>
                                  chainSlug &&
                                  hasRpcUrl &&
                                  router.push(`/explorer/${chainSlug}`)
                                }
                                disabled={!chainSlug || !hasRpcUrl}
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
