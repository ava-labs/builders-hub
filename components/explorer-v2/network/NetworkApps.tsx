"use client";

import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { useDapps } from "@/app/(home)/stats/dapps/_hooks/useDapps";
import { useDappsTable } from "@/app/(home)/stats/dapps/_hooks/useDappsTable";
import { CategorySplit, Leaderboard, ProtocolTreemap, useCategoryShares, usd } from "./apps-parts";

/* The network scope's Apps facet: the applications driving activity
   across Avalanche (formerly /stats/dapps). The figures lead, then the
   TVL split by category and the biggest protocols to scale; a category
   picked there cuts the leaderboard below. Mainnet-only. */
export function NetworkApps() {
  const { dapps, metrics, loading, error } = useDapps();
  const table = useDappsTable(dapps);
  const shares = useCategoryShares(dapps);
  const pick = (key: string) => {
    table.setSelectedCategory(key);
    table.clearSearch();
  };
  const onChain = dapps.filter((d) => !d.tvl).length;

  return (
    <NetworkShell>
      {error ? (
        <p className="py-24 text-center font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#E6212F]">{error}</p>
      ) : (
        <div className="flex flex-col gap-12">
          <ReadoutRow cols={4}>
            <Readout label="TVL" value={metrics ? usd(metrics.totalTVL) : loading ? null : "—"} sub="DefiLlama" />
            <Readout label="Volume · 24h" value={metrics ? usd(metrics.total24hVolume) : loading ? null : "—"} sub="DEX volume" />
            <Readout
              label="Protocols"
              value={metrics ? metrics.totalProtocols.toLocaleString("en-US") : loading ? null : "—"}
              sub={metrics ? `${onChain} on-chain only` : undefined}
            />
            <Readout
              label="AVAX Price"
              live
              href="/explorer/mainnet/token"
              value={metrics?.avaxPrice ? `$${metrics.avaxPrice.usd.toFixed(2)}` : loading ? null : "—"}
              sub={
                metrics?.avaxPrice
                  ? `${metrics.avaxPrice.usd_24h_change >= 0 ? "▲" : "▼"} ${Math.abs(metrics.avaxPrice.usd_24h_change).toFixed(2)}% · 24h`
                  : undefined
              }
            />
          </ReadoutRow>

          {loading ? (
            <AppsLoading />
          ) : (
            <>
              <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
                <CategorySplit shares={shares} picked={table.selectedCategory} onPick={pick} />
                <ProtocolTreemap dapps={dapps} category={table.selectedCategory} />
              </div>
              <Leaderboard table={table} total={dapps.length} />
            </>
          )}
        </div>
      )}
    </NetworkShell>
  );
}

/* the boards stand as squares while the list loads */
function AppsLoading() {
  return (
    <div className="flex flex-col gap-12" role="status" aria-label="Loading apps">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="h-[30rem] animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-[30rem] animate-pulse bg-zinc-100 dark:bg-zinc-900" />
      </div>
      <div className="h-96 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
