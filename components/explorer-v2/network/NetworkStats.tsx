"use client";

import { useMemo, useState } from "react";
import { Board, EmptyRow } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { thin, windowSeries } from "@/components/explorer-v2/staking/data";
import { RANGE_DAYS, rangeWindowLabel, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { CHART_FLOOR_DAYS, fmtCompact, metricSeries, pctOf, useChainMetrics, windowPair } from "@/components/explorer-v2/evm/metric-charts";
import { BLOCK_GRAY, LayerBlock, PickReadout, type BlockDay, type BlockLayer } from "@/components/explorer-v2/network/icm-parts";

/* The network-scope Stats facet: the chain-stats indexer aggregated across
   every indexed chain, in the C-Chain home's voice. Eight readouts carry
   each metric's window, its move against the window before, and its
   series in the foot. A readout is also the way in: click it and the
   large block below draws that metric, with the overlay that explains it
   (TPS over transactions, senders under addresses, the daily spike over
   the gas price). Everything rides the page clock; charts floor at a week. */

const METRICS = [
  "activeAddresses",
  "activeSenders",
  "txCount",
  "cumulativeAddresses",
  "cumulativeTxCount",
  "contracts",
  "deployers",
  "gasUsed",
  "avgTps",
  "maxTps",
  "feesPaid",
  "avgGasPrice",
  "maxGasPrice",
  "icmMessages",
].join(",");

type MetricKey = "txCount" | "activeAddresses" | "contracts" | "icm" | "feesPaid" | "gasUsed" | "avgGasPrice" | "cumulativeAddresses";

interface MetricSpec {
  key: MetricKey;
  label: string;
  /** how the window reads: a total, a daily mean, or the latest level */
  mode: "sum" | "avg" | "last";
  unit?: string;
  fmt?: (v: number) => string;
  /** the series that explains this one, drawn dashed on its own scale */
  overlay?: { key: string; label: string; fmt: (v: number) => string };
}

const SPECS: MetricSpec[] = [
  { key: "txCount", label: "Transactions", mode: "sum", overlay: { key: "avgTps", label: "avg TPS", fmt: (v) => v.toFixed(1) } },
  { key: "activeAddresses", label: "Active Addresses", mode: "avg", overlay: { key: "activeSenders", label: "senders", fmt: fmtCompact } },
  { key: "contracts", label: "Contracts Deployed", mode: "sum", overlay: { key: "deployers", label: "deployers", fmt: fmtCompact } },
  { key: "icm", label: "ICM Messages", mode: "sum" },
  { key: "feesPaid", label: "Fees Paid", mode: "sum", unit: "AVAX" },
  { key: "gasUsed", label: "Gas Charged", mode: "sum" },
  {
    key: "avgGasPrice",
    label: "Gas Price",
    mode: "avg",
    unit: "nAVAX",
    fmt: (v) => (v >= 10 ? fmtCompact(v) : v.toFixed(2)),
    overlay: { key: "maxGasPrice", label: "daily max", fmt: (v) => `${fmtCompact(v)} nAVAX` },
  },
  { key: "cumulativeAddresses", label: "Total Addresses", mode: "last" },
];

const ICM_LAYERS: BlockLayer[] = [
  { key: "in", label: "Received", tone: BLOCK_GRAY },
  { key: "out", label: "Sent", tone: "#71717A" },
];

/** the network's windowed readings and the chart they pick, without the shell */
export function NetworkStatsBody() {
  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];
  // fetch double the window so every reading can face its previous window
  const { metrics, failed } = useChainMetrics("all", Math.min(range * 2, 365), METRICS);
  const [pick, setPick] = useState<MetricKey>("txCount");

  const m = useMemo(() => metrics ?? {}, [metrics]);
  const chartDays = Math.max(CHART_FLOOR_DAYS, range);

  // the ICM feed has its own shape: received and sent per day
  const icmDays = useMemo<BlockDay[]>(() => {
    const pts = [...(metrics?.icmMessages?.data ?? [])].sort((a, b) => a.timestamp - b.timestamp);
    return thin(windowSeries(pts, chartDays), 200).map((p) => ({ date: p.date, v: { in: p.incomingCount, out: p.outgoingCount } }));
  }, [metrics, chartDays]);
  const icmPair = useMemo(() => {
    const pts = [...(metrics?.icmMessages?.data ?? [])].sort((a, b) => a.timestamp - b.timestamp);
    if (!pts.length) return null;
    return windowPair(
      pts.map((p) => ({ timestamp: p.timestamp, value: p.incomingCount + p.outgoingCount })),
      range,
      "sum",
    );
  }, [metrics, range]);

  const days = (spec: MetricSpec): BlockDay[] => {
    if (spec.key === "icm") return icmDays;
    return metricSeries(m, range, spec.key, spec.overlay?.key).map((p) => ({
      date: p.date,
      v: spec.overlay ? { a: p.a, [spec.overlay.key]: p.b ?? 0 } : { a: p.a },
    }));
  };
  const readingOf = (spec: MetricSpec) => {
    if (spec.key === "icm") return { value: icmPair?.cur ?? null, delta: pctOf(icmPair) };
    if (spec.mode === "last") {
      const pts = m[spec.key]?.data;
      if (!pts?.length) return { value: null, delta: null };
      const sorted = [...pts].sort((a, b) => a.timestamp - b.timestamp);
      const last = sorted[sorted.length - 1].value;
      const start = sorted[Math.max(0, sorted.length - 1 - range)].value;
      return { value: last, delta: start > 0 ? ((last - start) / start) * 100 : null };
    }
    const pair = windowPair(m[spec.key]?.data, range, spec.mode);
    return { value: pair?.cur ?? null, delta: pctOf(pair) };
  };

  const picked = SPECS.find((s) => s.key === pick) ?? SPECS[0];
  const pickedDays = days(picked);
  const fmtOf = (spec: MetricSpec) => spec.fmt ?? fmtCompact;

  let body: React.ReactNode;
  if (failed) {
    body = (
      <Board divide={false} className="border">
        <EmptyRow>Chain metrics unavailable</EmptyRow>
      </Board>
    );
  } else {
    body = (
      <div className="flex flex-col gap-12">
        {/* the readings on the clock; each one picks the chart below */}
        <ReadoutRow cols={4}>
          {SPECS.map((spec) => {
            const { value, delta } = readingOf(spec);
            const d = days(spec);
            const spark = spec.key === "icm" ? d.map((x) => x.v.in + x.v.out) : d.map((x) => x.v.a);
            return (
              <PickReadout key={spec.key} label={spec.label} on={pick === spec.key} onPick={() => setPick(spec.key)}>
                <Readout
                  label={spec.label}
                  value={value !== null ? fmtOf(spec)(value) : metrics ? "—" : null}
                  unit={value !== null ? spec.unit : undefined}
                  sub={spec.mode === "avg" && range > 1 ? "daily avg" : spec.mode === "last" ? "all-time" : undefined}
                  delta={delta}
                  spark={spark}
                />
              </PickReadout>
            );
          })}
        </ReadoutRow>

        {pickedDays.length ? (
          <LayerBlock
            label={picked.label}
            note={range < CHART_FLOOR_DAYS ? "7 days" : rangeWindowLabel(clock)}
            days={pickedDays}
            layers={picked.key === "icm" ? ICM_LAYERS : [{ key: "a", label: picked.label, tone: BLOCK_GRAY }]}
            fmt={fmtOf(picked)}
            unit={picked.unit}
            headline={picked.mode}
            overlay={picked.overlay}
            href={picked.key === "icm" ? "/explorer/mainnet/chains" : undefined}
          />
        ) : metrics ? (
          <Board divide={false} className="border">
            <EmptyRow>No {picked.label.toLowerCase()} in this window</EmptyRow>
          </Board>
        ) : (
          <div className="h-72 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        )}
      </div>
    );
  }

  return body;
}
