"use client";

import Link from "next/link";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { Board, SectionHeader, StatCell, StatFigure } from "@/components/explorer-v2/ui";
import { TopProtocolsGrid } from "@/app/(home)/stats/dapps/_components/TopProtocolsGrid";
import { DappsTableControls } from "@/app/(home)/stats/dapps/_components/DappsTableControls";
import { DappsTable } from "@/app/(home)/stats/dapps/_components/DappsTable";
import { formatCurrency } from "@/app/(home)/stats/dapps/_components/helpers";
import { useDapps } from "@/app/(home)/stats/dapps/_hooks/useDapps";
import { useDappsTable } from "@/app/(home)/stats/dapps/_hooks/useDappsTable";

/* The network scope's "Apps" facet — the applications driving on-chain
   activity across Avalanche (formerly /stats/dapps). The drafting-sheet
   chrome comes from NetworkShell; here we only wire the data and lay out
   the meat sections, dropping the old hero and bubble nav. Mainnet-only. */
export function NetworkApps() {
  const { dapps, metrics, loading, error } = useDapps();

  const table = useDappsTable(dapps);

  return (
    <NetworkShell
      eyebrow="Avalanche Ecosystem"
      title="Apps"
      intro="The applications driving on-chain activity across Avalanche, ranked by real usage."
    >
      {loading ? (
        <AppsLoading />
      ) : error ? (
        <p className="py-24 text-center font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#E6212F]">
          {error}
        </p>
      ) : (
        <div className="flex flex-col gap-10">
          {/* headline metrics, formerly the hero figures */}
          {metrics && <MetricsStrip metrics={metrics} />}

          <TopProtocolsGrid dapps={dapps} />

          <section className="flex flex-col gap-6">
            <SectionHeader
              label="Leaderboard"
              action={
                <Link
                  href="/explorer/mainnet/c-chain/gas"
                  className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#0061E2] transition-colors hover:text-[#E6212F] dark:text-[#5f9dff]"
                >
                  Gas market →
                </Link>
              }
            />

            <DappsTableControls
              trackedCount={table.sortedData.length}
              visibleCategories={table.visibleCategories}
              overflowCategories={table.overflowCategories}
              selectedCategory={table.selectedCategory}
              onCategoryChange={table.setSelectedCategory}
              getCategoryCount={table.getCategoryCount}
              categoryDropdownOpen={table.categoryDropdownOpen}
              onCategoryDropdownToggle={table.setCategoryDropdownOpen}
              categoryDropdownRef={table.categoryDropdownRef}
              showOnChainOnly={table.showOnChainOnly}
              onShowOnChainOnlyChange={table.setShowOnChainOnly}
              searchTerm={table.searchTerm}
              onSearchChange={table.setSearchTerm}
              onSearchClear={table.clearSearch}
            />

            <DappsTable
              visibleData={table.visibleData}
              sortedData={table.sortedData}
              hasMoreData={table.hasMoreData}
              visibleCount={table.visibleCount}
              sortField={table.sortField}
              sortDirection={table.sortDirection}
              onSort={table.onSort}
              onLoadMore={table.onLoadMore}
            />
          </section>
        </div>
      )}
    </NetworkShell>
  );
}

/* The hero's headline figures, re-cut as a hairline stat strip. TVL and
   volume stay as pre-formatted currency (the count-up integer figure can't
   carry a $ + B/M suffix); protocol count animates; AVAX price rides its
   own 24h delta. */
function MetricsStrip({ metrics }: { metrics: NonNullable<ReturnType<typeof useDapps>["metrics"]> }) {
  const hasPrice = Boolean(metrics.avaxPrice);
  return (
    <Board divide={false}>
      <div
        className={
          hasPrice
            ? "grid grid-cols-2 divide-x divide-y divide-zinc-200 sm:divide-y-0 lg:grid-cols-4 dark:divide-zinc-800"
            : "grid grid-cols-2 divide-x divide-y divide-zinc-200 sm:divide-y-0 lg:grid-cols-3 dark:divide-zinc-800"
        }
      >
        <StatCell label="TVL">
          <Figure>{formatCurrency(metrics.totalTVL)}</Figure>
        </StatCell>
        <StatCell label="24h Volume">
          <Figure>{formatCurrency(metrics.total24hVolume)}</Figure>
        </StatCell>
        <StatCell label="Protocols">
          <StatFigure value={metrics.totalProtocols} />
        </StatCell>
        {metrics.avaxPrice && (
          <StatCell label="AVAX Price">
            <span className="flex items-baseline gap-2">
              <Figure>${metrics.avaxPrice.usd.toFixed(2)}</Figure>
              <span
                className={
                  metrics.avaxPrice.usd_24h_change >= 0
                    ? "font-mono text-[11px] tabular-nums text-emerald-600 dark:text-emerald-400"
                    : "font-mono text-[11px] tabular-nums text-[#E6212F]"
                }
              >
                {metrics.avaxPrice.usd_24h_change >= 0 ? "+" : ""}
                {metrics.avaxPrice.usd_24h_change.toFixed(2)}%
              </span>
            </span>
          </StatCell>
        )}
      </div>
    </Board>
  );
}

/* Non-count-up figure, styled to match StatFigure so string metrics
   (currency, price) sit on the same baseline as the animated integers. */
function Figure({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
      {children}
    </span>
  );
}

/* Loading: the shell is already on screen; only the content area shimmers
   as squared placeholder blocks (no rounded corners, per the design rules). */
function AppsLoading() {
  return (
    <div className="flex flex-col gap-10" role="status" aria-label="Loading apps">
      <div className="grid grid-cols-2 gap-px lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
      <div className="h-40 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-96 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
