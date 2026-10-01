"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { DefiSwitch } from "@/components/explorer-v2/network/defi-switch";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { SectionHeader } from "@/components/explorer-v2/ui";
import { LayerBlock, type BlockDay } from "@/components/explorer-v2/network/icm-parts";
import { ChartEmpty } from "@/components/explorer-v2/staking/bits";
import { RANGE_DAYS, rangeWindowLabel, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { dayShort, timeAgo } from "@/components/explorer-v2/format";
import { useMetrics } from "@/lib/rwa/hooks/useMetrics";
import { useHistorical } from "@/lib/rwa/hooks/useHistorical";
import { useFenceMetrics } from "@/lib/rwa/hooks/useFenceMetrics";
import { bigintToNumber } from "@/lib/rwa/utils";
import { collectionDays, dayWindow, firstDay, poolHistory } from "@/lib/rwa/series";
import type { TimeSeriesDataPoint } from "@/lib/rwa/types";
import { CHIP, OFF } from "./ProtocolFilters";
import { DEFI_SCOPE, DEFI_STYLE, groupTone, usd } from "./palette";
import { CapitalFlow, FacilityFigures, Money, fenceAsOfDay } from "./rwa-parts";
import { useFenceCollections } from "./rwa-data";
import { RwaCollections } from "./RwaCollections";
import { RwaTransactions } from "./RwaTransactions";

/* The C-Chain DeFi tab's RWA view: the Valinor x OatFi x Fence pilot,
   real-world asset lending through an SPV on the C-Chain. Lenders fund a
   tranche pool, the pool finances the borrower, and the borrower's
   repayments flow back. The view leads with the pool's rates, then its
   money to date, what Fence reports about the facility, how the pool
   moved over the page clock's window, and every transfer. Figures are
   to date; charts read the window. */

/* the pilot's three slugs read one pool; one slug keeps one set of caches warm */
const POOL = "oatfi";
const RWA_TONE = groupTone("rwa");
const blockDays = (points: TimeSeriesDataPoint[]): BlockDay[] => points.map((p) => ({ date: p.date, v: { v: p.value } }));

function HistorySkeleton({ failed, className }: { failed: boolean; className?: string }) {
  return (
    <div className={cn("border border-zinc-200 dark:border-zinc-800", className)}>
      <ChartEmpty failed={failed} />
    </div>
  );
}

export function DefiRwa() {
  const range = useExplorerTimeRange();
  const today = new Date().toISOString().slice(0, 10);
  const days = RANGE_DAYS[range];
  const windowNote = days < 7 ? "7 days" : rangeWindowLabel(range);

  const { metrics, error: metricsError } = useMetrics({ slug: POOL });
  const { historical, error: historyError } = useHistorical({ slug: POOL });
  const { fenceMetrics, error: fenceError } = useFenceMetrics({ slug: POOL });
  // Fence keeps about 100 readings a series a day, so the view asks for its window in whole days; All asks for everything
  const fenceWindow = range === "all" ? null : dayWindow(days, today, null);
  const fenceHistory = useFenceCollections(POOL, fenceWindow);

  const history = useMemo(() => {
    if (!historical) return null;
    const h = poolHistory(historical, days, today);
    return { financed: blockDays(h.financed), repaid: blockDays(h.repaid), volume: blockDays(h.volume) };
  }, [historical, days, today]);
  const collections = useMemo(
    () => (fenceHistory.data ? collectionDays(fenceHistory.data.paidCollections, fenceHistory.data.expectedCollections, days, today) : null),
    [fenceHistory.data, days, today],
  );

  const g = metrics?.general;
  // a figure the route could not read says so; a figure still on its way waits
  const lead = metricsError && !metrics ? "n/a" : null;
  const since = historical ? firstDay(historical.assetsFinanced) : null;
  const updated = metrics ? timeAgo(Math.floor(Date.parse(metrics.lastUpdated) / 1000)) : null;
  const asOf = fenceAsOfDay(fenceMetrics);

  const downloadCsv = async () => {
    if (!metrics) return;
    const { exportHistoricalToCSV, exportMetricsToCSV } = await import("@/lib/rwa/export/csv");
    exportMetricsToCSV(metrics);
    if (historical) exportHistoricalToCSV(historical);
  };

  return (
    <EvmShell network="mainnet">
      <div className="mb-8">
        <DefiSwitch on="rwa" />
      </div>
      <div className={`${DEFI_SCOPE} flex flex-col gap-12`}>
        <style>{DEFI_STYLE}</style>

        <section className="flex flex-col gap-5">
          <SectionHeader
            label="Valinor × OatFi × Fence Pilot"
            action={
              <button type="button" onClick={downloadCsv} disabled={!metrics} className={cn(CHIP, OFF, "uppercase tracking-[0.1em]")} title="Download the pool's figures and daily history as CSV" aria-label="Download CSV">
                <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                {/* a phone keeps the icon, so the pilot's name fits beside it */}
                <span className="hidden sm:inline">CSV</span>
              </button>
            }
          />
          <p className="-mt-1 font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Real-world asset lending through an SPV on the C-Chain: lenders fund the tranche pool, the pool finances the borrower, and repayments flow back.
            {updated ? ` Updated ${updated}.` : ""}
          </p>
          <ReadoutRow cols={4}>
            <Readout label="Transacted Volume" value={g ? <Money value={bigintToNumber(g.transactedVolume)} /> : lead} sub="in and out of the pool and borrower" />
            <Readout label="Capital Turnover" value={g ? `${g.capitalTurnover.toFixed(2)}×` : lead} sub="financed / invested" />
            {/* the series has a point only on a day with a transfer, so the mean is over those days */}
            <Readout label="Avg Capital Utilization" value={g ? `${g.averageCapitalUtilization.toFixed(1)}%` : lead} sub="average over days with transfers" />
            <Readout label="Avg Recycling Time" value={g ? g.avgCapitalRecycling.toFixed(1) : lead} unit={g ? "days" : undefined} sub="per turn of capital" />
          </ReadoutRow>
        </section>

        <CapitalFlow metrics={metrics} since={since} failed={!!metricsError} />

        <section className="flex flex-col gap-5">
          <SectionHeader
            label="Facility Performance"
            action={asOf ? <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">as of {dayShort(asOf)}</span> : undefined}
          />
          <FacilityFigures fence={fenceMetrics} failed={!!fenceError} />
          {!(fenceError && !fenceMetrics) && <RwaCollections days={collections} note={windowNote} failed={fenceHistory.failed && !fenceHistory.data} stale={fenceHistory.stale} />}
        </section>

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {history ? (
            <>
              <LayerBlock label="Assets Financed" note={windowNote} days={history.financed} layers={[{ key: "v", label: "Financed", tone: RWA_TONE }]} fmt={usd} headline="sum" />
              <LayerBlock label="Lender Repayments" note={windowNote} days={history.repaid} layers={[{ key: "v", label: "Repaid", tone: RWA_TONE }]} fmt={usd} headline="sum" />
              <div className="lg:col-span-2">
                <LayerBlock label="Volume Over Time" note={windowNote} days={history.volume} layers={[{ key: "v", label: "Volume", tone: RWA_TONE }]} fmt={usd} headline="sum" />
              </div>
            </>
          ) : (
            [0, 1, 2].map((i) => <HistorySkeleton key={i} failed={!!historyError} className={i === 2 ? "lg:col-span-2" : undefined} />)
          )}
        </section>

        <RwaTransactions slug={POOL} />

        <p className="font-mono text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          USDC transfers, native and bridged, of the tranche pool, the borrower&apos;s operating wallet and the two lenders, indexed from the C-Chain. Collections and the industry
          concentration come from Fence; expected collections start in March 2026. Pool figures refresh every 5 minutes, Fence figures every 30.
        </p>
      </div>
    </EvmShell>
  );
}
