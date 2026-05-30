"use client";
import { Button } from "@/components/ui/button";
import {
  AppWindow,
  Globe,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import type { DAppsMetrics } from "@/types/dapps";
import { formatCurrency } from "./helpers";

interface DappsHeroProps {
  metrics: DAppsMetrics | null;
}

export function DappsHero({ metrics }: DappsHeroProps) {
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
        <nav className="flex items-center gap-1.5 text-xs sm:text-sm mb-3 sm:mb-4 overflow-x-auto scrollbar-hide pb-1">
          <span className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap flex-shrink-0">
            <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>Ecosystem</span>
          </span>
          <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
          <span className="inline-flex items-center gap-1 sm:gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap flex-shrink-0">
            <AppWindow className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500" />
            <span>DApp Analytics</span>
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
                Avalanche C-Chain
              </p>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
              DApp Analytics
            </h1>
          </div>

          <div className="flex gap-2 sm:gap-3 self-start sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open("https://defillama.com/chain/Avalanche", "_blank")
              }
              className="gap-2 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
            >
              DefiLlama
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-baseline gap-y-3 gap-x-6 sm:gap-6 md:gap-12 pt-4 sm:pt-6">
          <div className="flex items-baseline">
            <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
              {formatCurrency(metrics?.totalTVL)}
            </span>
            <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
              TVL
            </span>
          </div>
          <div className="flex items-baseline justify-end sm:justify-start">
            <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
              {formatCurrency(metrics?.total24hVolume)}
            </span>
            <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
              24h Vol
            </span>
          </div>
          <div className="flex items-baseline">
            <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
              {metrics?.totalProtocols || 0}
            </span>
            <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
              protocols
            </span>
          </div>
          {metrics?.avaxPrice && (
            <div className="flex items-baseline justify-end sm:justify-start">
              <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                ${metrics.avaxPrice.usd.toFixed(2)}
              </span>
              <span
                className={`text-xs sm:text-sm ml-1 sm:ml-2 ${
                  metrics.avaxPrice.usd_24h_change >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {metrics.avaxPrice.usd_24h_change >= 0 ? "+" : ""}
                {metrics.avaxPrice.usd_24h_change.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
