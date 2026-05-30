"use client";
import {
  Globe,
  ChevronRight,
  BarChart3,
  Network,
  ExternalLink,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { formatMarketCap } from "@/lib/utils/format-market-cap";
import { AnimatedNumber } from "./AnimatedNumber";
import { SpeedGauge } from "./SpeedGauge";
import {
  TIME_RANGE_CONFIG,
  type AvaxSupplyData,
  type OverviewMetrics,
  type TimeRangeKey,
} from "./types";

interface OverviewHeroProps {
  metrics: OverviewMetrics;
  avaxSupply: AvaxSupplyData | null;
  timeRange: TimeRangeKey;
  refetching: boolean;
  onTimeRangeChange: (range: TimeRangeKey) => void;
}

const TIME_RANGES: TimeRangeKey[] = ["day", "week", "month"];

function formatNumber(num: number | string): string {
  if (num === "N/A" || num === "" || num === null || num === undefined)
    return "N/A";
  const numValue = typeof num === "string" ? Number.parseFloat(num) : num;
  if (isNaN(numValue)) return "N/A";
  if (numValue >= 1e12) return `${(numValue / 1e12).toFixed(1)}T`;
  if (numValue >= 1e9) return `${(numValue / 1e9).toFixed(1)}B`;
  if (numValue >= 1e6) return `${(numValue / 1e6).toFixed(1)}M`;
  if (numValue >= 1e3) return `${(numValue / 1e3).toFixed(1)}K`;
  return numValue.toLocaleString();
}

function sumBurnedAvax(supply: AvaxSupplyData): number {
  return (
    parseFloat(supply.totalPBurned) +
    parseFloat(supply.totalCBurned) +
    parseFloat(supply.totalXBurned)
  );
}

export function OverviewHero({
  metrics,
  avaxSupply,
  timeRange,
  refetching,
  onTimeRangeChange,
}: OverviewHeroProps) {
  const totalTx = Math.round(metrics.aggregated.totalTxCount || 0);
  const totalTps = metrics.aggregated.totalTps?.toFixed(2) || "0";
  const totalIcm = Math.round(metrics.aggregated.totalICMMessages || 0);
  const timeRangeLabel = TIME_RANGE_CONFIG[timeRange].label;

  return (
    <div className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
      <div
        className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
        style={{
          background:
            "linear-gradient(to left, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.12) 40%, rgba(239, 68, 68, 0.04) 70%, transparent 100%)",
        }}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-8 sm:pb-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs sm:text-sm mb-3 sm:mb-4 overflow-x-auto scrollbar-hide pb-1">
          <span className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap flex-shrink-0">
            <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>Ecosystem</span>
          </span>
          <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
          <span className="inline-flex items-center gap-1 sm:gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap flex-shrink-0">
            <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500" />
            <span>Overview</span>
          </span>
        </nav>

        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-8">
          <div>
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <AvalancheLogo
                className="w-5 h-5 sm:w-6 sm:h-6"
                fill="currentColor"
              />
              <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 tracking-wide uppercase">
                Avalanche Ecosystem
              </p>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
              L1s Index
            </h1>
          </div>

          <div className="flex gap-2 sm:gap-3 self-start sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => (window.location.href = "/stats/chain-list")}
              className="gap-2 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
            >
              <Network className="h-3.5 w-3.5" />
              Chain List
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(
                  "https://github.com/ava-labs/builders-hub/blob/master/constants/l1-chains.json",
                  "_blank"
                )
              }
              className="gap-2 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
            >
              Submit L1
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Key metrics row + desktop time range selector */}
        <div className="flex items-center justify-between gap-4 pt-4 sm:pt-6">
          <div className="grid grid-cols-2 sm:flex sm:items-baseline gap-y-3 gap-x-6 sm:gap-6 md:gap-12">
            <div className="flex items-baseline">
              {refetching ? (
                <div className="h-8 sm:h-10 md:h-12 w-12 sm:w-14 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              ) : (
                <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                  {metrics.aggregated.activeL1Count ?? metrics.chains.length}
                </span>
              )}
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                chains
              </span>
            </div>
            <div className="flex items-baseline justify-end sm:justify-start">
              {refetching ? (
                <div className="h-8 sm:h-10 md:h-12 w-20 sm:w-28 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              ) : (
                <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                  <AnimatedNumber value={totalTx} />
                </span>
              )}
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                txns
              </span>
            </div>
            <div className="flex items-baseline">
              {refetching ? (
                <div className="h-8 sm:h-10 md:h-12 w-24 sm:w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              ) : (
                <SpeedGauge value={parseFloat(totalTps)} />
              )}
            </div>
            <div className="flex items-baseline justify-end sm:justify-start">
              {refetching ? (
                <div className="h-8 sm:h-10 md:h-12 w-14 sm:w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white cursor-default">
                      {formatNumber(metrics.aggregated.totalValidators)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {metrics.aggregated.totalValidators.toLocaleString()} validators
                  </TooltipContent>
                </Tooltip>
              )}
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                validators
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1 self-center">
            {TIME_RANGES.map((range) => (
              <button
                key={range}
                onClick={() => onTimeRangeChange(range)}
                className={`relative px-3 py-1 text-sm font-medium cursor-pointer transition-colors ${
                  timeRange === range
                    ? "text-zinc-900 dark:text-white"
                    : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400"
                }`}
              >
                {TIME_RANGE_CONFIG[range].shortLabel}
                {timeRange === range && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-red-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile time range selector */}
        <div className="flex sm:hidden items-center justify-end pt-3">
          <div className="flex items-center gap-1">
            {TIME_RANGES.map((range) => (
              <button
                key={range}
                onClick={() => onTimeRangeChange(range)}
                className={`relative px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                  timeRange === range
                    ? "text-zinc-900 dark:text-white"
                    : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400"
                }`}
              >
                {TIME_RANGE_CONFIG[range].shortLabel}
                {timeRange === range && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-red-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary stats row */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 md:gap-8 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1">
              Market Cap:
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-zinc-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Data from CoinGecko</p>
                </TooltipContent>
              </Tooltip>
            </span>
            {refetching ? (
              <div className="h-4 sm:h-5 w-12 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            ) : (
              <span className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-white">
                {formatMarketCap(metrics.aggregated.totalMarketCap)}
              </span>
            )}
          </div>
          <div className="hidden sm:block w-px h-4 bg-zinc-300 dark:bg-zinc-700" />
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              {timeRangeLabel} ICM:
            </span>
            {refetching ? (
              <div className="h-4 sm:h-5 w-12 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            ) : (
              <span className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-white">
                {formatNumber(totalIcm)}
              </span>
            )}
          </div>
          <div className="hidden sm:block w-px h-4 bg-zinc-300 dark:bg-zinc-700" />
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Validation Fees:
            </span>
            <div className="flex items-center gap-1">
              <AvalancheLogo
                className="w-3 h-3 sm:w-4 sm:h-4"
                fill="currentColor"
              />
              <span className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-white">
                {avaxSupply
                  ? Math.round(parseFloat(avaxSupply.l1ValidatorFees)).toLocaleString()
                  : "—"}
              </span>
            </div>
          </div>
          <div className="hidden sm:block w-px h-4 bg-zinc-300 dark:bg-zinc-700" />
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Fees Burned:
            </span>
            <div className="flex items-center gap-1">
              <AvalancheLogo
                className="w-3 h-3 sm:w-4 sm:h-4"
                fill="currentColor"
              />
              <span className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-white">
                {avaxSupply
                  ? Math.round(sumBurnedAvax(avaxSupply)).toLocaleString()
                  : "—"}
              </span>
            </div>
          </div>

          <div className="w-full sm:w-auto sm:ml-auto">
            <span className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500">
              * Metrics are {timeRangeLabel.toLowerCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
