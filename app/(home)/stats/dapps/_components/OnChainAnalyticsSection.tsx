"use client";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Fuel,
  Flame,
  Layers,
} from "lucide-react";
import {
  CHAIN_STATS_RANGES,
  type ChainStats,
  type ChainStatsRange,
} from "./types";
import { formatNumber } from "./helpers";

interface OnChainAnalyticsSectionProps {
  data: ChainStats | null;
  loading: boolean;
  error: string | null;
  range: ChainStatsRange;
  onRangeChange: (range: ChainStatsRange) => void;
}

export function OnChainAnalyticsSection({
  data,
  loading,
  error,
  range,
  onRangeChange,
}: OnChainAnalyticsSectionProps) {
  const router = useRouter();

  // Hide the entire section when there's nothing to show — preserves the
  // original behavior where the section only renders if at least one of
  // data/loading/error is truthy.
  if (!data && !loading && !error) return null;

  return (
    <div className="bg-gradient-to-b from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 py-8 sm:py-12 border-y border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-500" />
            On-Chain Activity
            <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
              (
              {range === "all"
                ? "All Time"
                : CHAIN_STATS_RANGES[range].label}
              )
            </span>
          </h3>
          <div className="flex items-center gap-2">
            {loading && (
              <span className="text-xs text-zinc-500 animate-pulse">
                Loading...
              </span>
            )}
            <div className="flex items-center gap-1 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-lg p-1">
              {(Object.keys(CHAIN_STATS_RANGES) as ChainStatsRange[]).map(
                (r) => (
                  <button
                    key={r}
                    onClick={() => onRangeChange(r)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      range === r
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    {CHAIN_STATS_RANGES[r].label}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 animate-pulse"
              >
                <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
                <div className="h-8 w-28 bg-zinc-200 dark:bg-zinc-700 rounded" />
              </div>
            ))
          ) : data ? (
            <>
              <StatCard
                label="Transactions"
                value={formatNumber(data.totalTransactions)}
                icon={<BarChart3 className="w-4 h-4 text-blue-500" />}
              />
              <StatCard
                label="Gas Consumed"
                value={formatNumber(data.totalGasUsed)}
                icon={<Fuel className="w-4 h-4 text-amber-500" />}
              />
              <StatCard
                label="AVAX Burned"
                value={`${formatNumber(data.totalAvaxBurned)} AVAX`}
                icon={<Flame className="w-4 h-4 text-orange-500" />}
                valueClassName="text-orange-600 dark:text-orange-400"
              />
              <StatCard
                label="Top Protocols"
                value={String(data.protocolBreakdown.length)}
                icon={<Layers className="w-4 h-4 text-purple-500" />}
              />
            </>
          ) : error ? (
            <div className="col-span-2 lg:col-span-4 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/40 rounded-xl p-4 sm:p-5">
              <p className="text-sm text-red-600 dark:text-red-400">
                Couldn't load on-chain stats: {error}
              </p>
            </div>
          ) : null}
        </div>

        {data && data.protocolBreakdown.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <Fuel className="w-4 h-4 text-amber-500" />
              Top Gas Consumers (30d)
            </h4>
            <div className="space-y-3">
              {data.protocolBreakdown.slice(0, 10).map((protocol, index) => (
                <div
                  key={protocol.protocol}
                  onClick={() =>
                    protocol.slug && router.push(`/stats/dapps/${protocol.slug}`)
                  }
                  className={`flex items-center gap-3 ${protocol.slug ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors" : ""}`}
                >
                  <span className="text-xs text-zinc-400 w-5">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                        {protocol.protocol}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-2">
                        {protocol.gasShare.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                        style={{ width: `${Math.min(protocol.gasShare, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium text-zinc-900 dark:text-white">
                      {formatNumber(protocol.txCount)} txs
                    </p>
                    <p className="text-xs text-orange-500">
                      {formatNumber(protocol.avaxBurned)} AVAX
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  valueClassName = "text-zinc-900 dark:text-white",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {label}
        </span>
        {icon}
      </div>
      <p className={`text-xl sm:text-2xl font-semibold ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}
