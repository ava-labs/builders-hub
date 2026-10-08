"use client";

import { useMemo, useState } from "react";
import { ViewSwitch } from "@/components/explorer-v2/network/icm-parts";
import { fenceSeries, firstDay, windowFor, type RangeChoice } from "@/lib/rwa/series";
import type { FenceHistoricalData, TimeInterval } from "@/lib/rwa/types";
import { usd } from "./palette";
import { RwaChart, zipRows, type RwaSeries } from "./rwa-chart";
import { IntervalSwitch, RangePicker, TimedHeader } from "./rwa-time";

/* The old dashboard's collections over time: Fence's paid and expected
   collections, both running totals, over the reader's range by day, week
   or month. The cumulative reading draws the totals; the periodic one
   each bucket's increase. Combined they share a scale; split, each gets
   its own chart. */

const TONE = "var(--rwa-1)";
const INK = "var(--rwa-2)";
const SYNC = "rwa-fence";
/* module constants: recharts resets a chart's brush whenever its data or series change identity */
const PAID: RwaSeries[] = [{ key: "paid", label: "Paid", color: TONE }];
const EXPECTED: RwaSeries[] = [{ key: "expected", label: "Expected", color: INK, dashed: true }];
const BOTH: RwaSeries[] = [...PAID, ...EXPECTED];
const SPLIT_OPTIONS: { v: "combined" | "split"; label: string }[] = [
  { v: "combined", label: "Combined" },
  { v: "split", label: "Split" },
];

export function RwaCollections({ history, failed }: { history: FenceHistoricalData | null; failed: boolean }) {
  const [interval, setInterval] = useState<TimeInterval>("daily");
  const [range, setRange] = useState<RangeChoice>({ preset: "all" });
  const [split, setSplit] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const first = history ? firstDay(history.paidCollections, history.expectedCollections) : null;
  const w = windowFor(range, today, first);

  // the window's days stand in for the window, rebuilt on every render
  const { periodic, cumulative } = useMemo(() => {
    if (!history) return { periodic: [], cumulative: [] };
    const paid = fenceSeries(history.paidCollections, w, interval);
    const expected = fenceSeries(history.expectedCollections, w, interval);
    return {
      periodic: zipRows({ paid: paid.periodic, expected: expected.periodic }),
      cumulative: zipRows({ paid: paid.cumulative, expected: expected.cumulative }),
    };
  }, [history, w.from, w.to, interval]);

  const state = { interval, syncId: SYNC, fmt: usd, kind: "line" as const, cumulative: true, defaultView: "cumulative" as const, loading: !history && !failed, failed: failed && !history };
  const splitSwitch = <ViewSwitch id="rwa-collections-split" value={split ? "split" : "combined"} onChange={(v) => setSplit(v === "split")} options={SPLIT_OPTIONS} />;

  return (
    <div className="flex flex-col gap-4">
      <TimedHeader label="Collections Over Time">
        <IntervalSwitch id="rwa-collections-interval" value={interval} onChange={setInterval} />
        <RangePicker value={range} shown={w} bounds={{ from: first ?? today, to: today }} onChange={setRange} />
      </TimedHeader>
      {split ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RwaChart id="rwa-paid" title="Paid Collections" series={PAID} rows={periodic} cumulativeRows={cumulative} extra={splitSwitch} {...state} />
          <RwaChart id="rwa-expected" title="Expected Collections" series={EXPECTED} rows={periodic} cumulativeRows={cumulative} {...state} />
        </div>
      ) : (
        <RwaChart
          id="rwa-collections"
          title="Paid vs Expected Collections"
          series={BOTH}
          rows={periodic}
          cumulativeRows={cumulative}
          extra={splitSwitch}
          {...state}
        />
      )}
      <p className="font-mono text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">Data sourced from Fence Finance. Expected collections are available from March 2026.</p>
    </div>
  );
}
