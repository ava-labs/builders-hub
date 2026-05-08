"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AppWindow } from "lucide-react";
import { DAPP_CATEGORIES, type DAppStats } from "@/types/dapps";
import { SortButton } from "./SortButton";
import { formatCurrency } from "./helpers";
import { getCategoryColor } from "./helpers";
import type { SortDirection, SortField } from "./types";

interface DappsTableProps {
  visibleData: DAppStats[];
  sortedData: DAppStats[];
  hasMoreData: boolean;
  visibleCount: number;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onLoadMore: () => void;
}

// Renders the sortable protocol leaderboard. Rank is computed from each row's
// position in `sortedData` (not the visible slice) so it stays accurate as the
// user pages through.
export function DappsTable({
  visibleData,
  sortedData,
  hasMoreData,
  visibleCount,
  sortField,
  sortDirection,
  onSort,
  onLoadMore,
}: DappsTableProps) {
  const router = useRouter();

  return (
    <>
      <div className="overflow-hidden border-0 bg-white dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 sm:px-6 py-4 text-left whitespace-nowrap w-12">
                  <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    #
                  </span>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left whitespace-nowrap">
                  <SortButton
                    field="name"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="left"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Protocol
                    </span>
                  </SortButton>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left whitespace-nowrap">
                  <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Category
                  </span>
                </th>
                <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                  <SortButton
                    field="tvl"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="right"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      TVL
                    </span>
                  </SortButton>
                </th>
                <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                  <SortButton
                    field="change_1d"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="right"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      24h
                    </span>
                  </SortButton>
                </th>
                <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                  <SortButton
                    field="change_7d"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="right"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      7d
                    </span>
                  </SortButton>
                </th>
                <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap hidden lg:table-cell">
                  <SortButton
                    field="volume24h"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="right"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Volume 24h
                    </span>
                  </SortButton>
                </th>
                <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap hidden xl:table-cell">
                  <SortButton
                    field="mcap"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={onSort}
                    align="right"
                  >
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Market Cap
                    </span>
                  </SortButton>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {visibleData.map((dapp) => {
                const catInfo = DAPP_CATEGORIES[dapp.category];
                const rank = sortedData.indexOf(dapp) + 1;

                return (
                  <tr
                    key={dapp.id}
                    onClick={() => router.push(`/stats/dapps/${dapp.slug}`)}
                    className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer"
                  >
                    <td className="px-4 sm:px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                      {rank}
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden">
                          {dapp.logo ? (
                            <Image
                              src={dapp.logo}
                              alt={dapp.name}
                              width={40}
                              height={40}
                              unoptimized={dapp.logo?.endsWith(".svg")}
                              className={`h-full w-full rounded-full object-cover ${dapp.darkInvert ? "dark:invert" : ""}`}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <span className="text-base font-semibold text-zinc-600 dark:text-zinc-300">
                              {dapp.name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                          {dapp.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getCategoryColor(dapp.category)}`}
                      >
                        {catInfo?.name || dapp.category}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(dapp.tvl)}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums">
                      {dapp.change_1d != null ? (
                        <span
                          className={`${
                            dapp.change_1d >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {dapp.change_1d >= 0 ? "+" : ""}
                          {dapp.change_1d.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums">
                      {dapp.change_7d != null ? (
                        <span
                          className={`${
                            dapp.change_7d >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {dapp.change_7d >= 0 ? "+" : ""}
                          {dapp.change_7d.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100 hidden lg:table-cell">
                      {dapp.volume24h ? formatCurrency(dapp.volume24h) : "-"}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100 hidden xl:table-cell">
                      {dapp.mcap ? formatCurrency(dapp.mcap) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {hasMoreData && (
        <div className="flex justify-center mt-4 sm:mt-6 pb-14">
          <Button
            onClick={onLoadMore}
            variant="outline"
            size="lg"
            className="px-4 sm:px-8 py-2 sm:py-3 text-sm sm:text-base border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-900 text-black dark:text-white transition-colors hover:border-black dark:hover:border-white hover:bg-[#fcfcfd] dark:hover:bg-neutral-900"
          >
            <span className="hidden sm:inline">Load More Protocols </span>
            <span className="sm:hidden">Load More </span>(
            {sortedData.length - visibleCount} remaining)
          </Button>
        </div>
      )}

      {sortedData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AppWindow className="h-12 w-12 text-zinc-400 mb-4" />
          <p className="text-zinc-600 dark:text-zinc-400 mb-2">
            No protocols found
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Try adjusting your search or filter
          </p>
        </div>
      )}
    </>
  );
}
