"use client";

import { Globe, ChevronRight, AppWindow, LayoutGrid } from "lucide-react";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import GasTreemap from "@/components/stats/gas-treemap";
import ContractGasXray from "@/components/stats/contract-gas-xray";

export default function TreemapPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div
          className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
          style={{
            background: `linear-gradient(to left, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.12) 40%, rgba(239, 68, 68, 0.04) 70%, transparent 100%)`,
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-6 sm:pb-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs sm:text-sm mb-3 sm:mb-4">
            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400">
              <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Ecosystem</span>
            </span>
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600" />
            <a
              href="/stats/dapps"
              className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              <AppWindow className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>DApp Analytics</span>
            </a>
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600" />
            <span className="inline-flex items-center gap-1 sm:gap-1.5 font-medium text-zinc-900 dark:text-zinc-100">
              <LayoutGrid className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500" />
              <span>Gas Treemap</span>
            </span>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <AvalancheLogo className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" />
            <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 tracking-wide uppercase">
              Avalanche C-Chain
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Gas Treemap
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            Visual breakdown of gas consumption across protocols. Larger blocks = more gas used.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <GasTreemap />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <ContractGasXray />
      </div>

      <StatsBubbleNav />
    </div>
  );
}
