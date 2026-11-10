"use client";

import { useMemo, useState } from "react";
import { ViewSwitch } from "@/components/explorer-v2/network/icm-parts";
import { firstDay, poolSeries, windowFor, type RangeChoice } from "@/lib/rwa/series";
import type { HistoricalData, TimeInterval, TimeSeriesDataPoint } from "@/lib/rwa/types";
import { usd } from "./palette";
import { RwaChart, zipRows, type ChartRow, type RwaSeries } from "./rwa-chart";
import { IntervalSwitch, RangePicker, TimedHeader } from "./rwa-time";

/* The old dashboard's historical trends: the pool's volume, utilization,
   financing against repayments, invested capital and outstanding principal
   over the reader's range, by day, week or month. The charts share one
   tooltip, so a day reads across all of them. */

const TONE = "var(--rwa-1)";
const INK = "var(--rwa-2)";
const SYNC = "rwa-pool";
const SPLIT_OPTIONS: { v: "combined" | "split"; label: string }[] = [
  { v: "combined", label: "Combined" },
  { v: "split", label: "Split" },
];
const pct = (v: number) => `${v.toFixed(1)}%`;
const single = (points: TimeSeriesDataPoint[] | undefined): ChartRow[] => (points ? zipRows({ v: points }) : []);
/* module constants, like the memoized rows below: recharts resets a chart's brush whenever its data changes
   identity, so a re-render that changes nothing must hand it the same arrays */
const VOLUME: RwaSeries[] = [{ key: "v", label: "Volume", color: TONE }];
const UTILIZATION: RwaSeries[] = [{ key: "v", label: "Utilization", color: TONE }];
const FINANCED: RwaSeries[] = [{ key: "financed", label: "Assets financed", color: TONE }];
const REPAID: RwaSeries[] = [{ key: "repaid", label: "Lender repayments", color: INK }];
const FLOWS: RwaSeries[] = [...FINANCED, ...REPAID];
const INVESTED: RwaSeries[] = [{ key: "v", label: "Invested capital", color: TONE }];
const OUTSTANDING: RwaSeries[] = [{ key: "v", label: "Outstanding principal", color: TONE }];

export function RwaHistory({ historical, failed }: { historical: HistoricalData | null; failed: boolean }) {
  const [interval, setInterval] = useState<TimeInterval>("daily");
  const [range, setRange] = useState<RangeChoice>({ preset: "all" });
  const [split, setSplit] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const first = historical ? firstDay(historical.transactedVolume, historical.assetsFinanced, historical.lenderRepayments, historical.committedCapital) : null;
  const w = windowFor(range, today, first);
  // the window's days stand in for the window, rebuilt on every render
  const series = useMemo(() => (historical ? poolSeries(historical, w, interval) : null), [historical, w.from, w.to, interval]);
  const rows = useMemo(
    () => ({
      volume: single(series?.volume),
      utilization: single(series?.utilization),
      flows: series ? zipRows({ financed: series.financed, repaid: series.repaid }) : [],
      invested: single(series?.invested),
      outstanding: single(series?.outstanding),
    }),
    [series],
  );

  const state = { interval, syncId: SYNC, loading: !historical && !failed, failed: failed && !historical };
  const splitSwitch = <ViewSwitch id="rwa-flows-split" value={split ? "split" : "combined"} onChange={(v) => setSplit(v === "split")} options={SPLIT_OPTIONS} />;

  return (
    <section id="rwa-historical" className="flex scroll-mt-40 flex-col gap-5">
      <TimedHeader label="Historical Trends">
        <IntervalSwitch id="rwa-history-interval" value={interval} onChange={setInterval} />
        <RangePicker value={range} shown={w} bounds={{ from: first ?? today, to: today }} onChange={setRange} />
      </TimedHeader>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RwaChart id="rwa-volume" title="Transaction Volume Over Time" series={VOLUME} rows={rows.volume} fmt={usd} kind="bar" cumulative {...state} />
        <RwaChart id="rwa-utilization" title="Capital Utilization" series={UTILIZATION} rows={rows.utilization} fmt={pct} kind="line" {...state} />
        {split ? (
          <>
            <RwaChart id="rwa-financed" title="Assets Financed" series={FINANCED} rows={rows.flows} fmt={usd} kind="bar" cumulative extra={splitSwitch} {...state} />
            <RwaChart id="rwa-repaid" title="Lender Repayments" series={REPAID} rows={rows.flows} fmt={usd} kind="bar" cumulative {...state} />
          </>
        ) : (
          <RwaChart
            id="rwa-flows"
            title="Assets Financed vs Repayments"
            className="lg:col-span-2"
            series={FLOWS}
            rows={rows.flows}
            fmt={usd}
            kind="bar"
            cumulative
            extra={splitSwitch}
            {...state}
          />
        )}
        <RwaChart id="rwa-invested" title="Lender Invested Capital Over Time" series={INVESTED} rows={rows.invested} fmt={usd} kind="area" {...state} />
        <RwaChart id="rwa-outstanding" title="Outstanding Principal" series={OUTSTANDING} rows={rows.outstanding} fmt={usd} kind="line" {...state} />
      </div>
    </section>
  );
}
