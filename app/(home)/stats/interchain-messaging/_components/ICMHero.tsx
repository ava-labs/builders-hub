"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  MessageCircleMore,
  ArrowUpRight,
  BookOpen,
  Globe,
  ChevronRight,
} from "lucide-react";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { ChainCategoryFilter } from "@/components/stats/ChainCategoryFilter";
import { formatNumber } from "./helpers";

interface ICMHeroProps {
  totalICMMessages: number;
  dailyICM: number;
  avgDailyICM: number;
  totalICTTTransfers: number;
  icttPercentage: string;
  selectedChainIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
}

export function ICMHero({
  totalICMMessages,
  dailyICM,
  avgDailyICM,
  totalICTTTransfers,
  icttPercentage,
  selectedChainIds,
  onSelectionChange,
}: ICMHeroProps) {
  return (
    <div className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div
        className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
        style={{
          background:
            "linear-gradient(to left, rgba(232, 65, 66, 0.2) 0%, rgba(232, 65, 66, 0.12) 40%, rgba(232, 65, 66, 0.04) 70%, transparent 100%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
        <nav className="flex items-center gap-1.5 text-xs sm:text-sm mb-3 sm:mb-4 pb-1">
          <Link
            href="/stats/overview"
            className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
          >
            <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>Ecosystem</span>
          </Link>
          <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
          <span className="inline-flex items-center gap-1 sm:gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap flex-shrink-0">
            <MessageCircleMore className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0 text-red-600 dark:text-red-500" />
            <span>Interchain Messaging</span>
          </span>
        </nav>

        <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
          <div className="space-y-4 sm:space-y-6 flex-1">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <AvalancheLogo
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="#E84142"
                />
                <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 tracking-wide uppercase">
                  Avalanche Ecosystem
                </p>
              </div>
              <div className="flex items-center gap-3 sm:gap-4">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Interchain Messaging
                </h1>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
                  Comprehensive analytics for Avalanche Interchain Messaging and
                  Token Transfer activity across L1s
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-baseline gap-6 sm:gap-8 md:gap-12 pt-2">
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                  Total ICM (365d)
                </span>
                <div className="flex items-baseline gap-0.5 flex-wrap">
                  <span className="text-xl sm:text-2xl md:text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {formatNumber(totalICMMessages)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                  Latest Day ICM
                </span>
                <div className="flex items-baseline gap-0.5 flex-wrap">
                  <span className="text-xl sm:text-2xl md:text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {formatNumber(dailyICM)}
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-400 dark:text-zinc-500 ml-1">
                    avg {formatNumber(avgDailyICM)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                  ICTT Transfers
                </span>
                <div className="flex items-baseline gap-0.5 flex-wrap">
                  <span className="text-xl sm:text-2xl md:text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {formatNumber(totalICTTTransfers)}
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-400 dark:text-zinc-500 ml-1">
                    {icttPercentage}% ICM
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <ChainCategoryFilter
                selectedChainIds={selectedChainIds}
                onSelectionChange={onSelectionChange}
                showChainChips={true}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600"
            >
              <a
                href="/academy/avalanche-l1/avalanche-fundamentals/interoperability/icm-icmContracts-and-ictt"
                className="flex items-center gap-2"
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">ICM Docs</span>
                <span className="sm:hidden">ICM</span>
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600"
            >
              <a
                href="/docs/cross-chain/interchain-token-transfer/overview"
                className="flex items-center gap-2"
              >
                <ArrowUpRight className="h-4 w-4" />
                <span className="hidden sm:inline">ICTT Docs</span>
                <span className="sm:hidden">ICTT</span>
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
