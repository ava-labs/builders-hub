"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import type { PchainNetwork } from "@/lib/pchain-explorer";
import { C_CHAIN_ID } from "@/lib/explorer-catalog";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion-curves";
import { Board, EmptyRow } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { thin, windowSeries } from "@/components/explorer-v2/staking/data";
import { RANGE_DAYS, rangeWindowLabel, useExplorerTimeRange, type ExplorerRange } from "@/components/explorer-v2/time-range";
import {
  CHART_FLOOR_DAYS,
  fmtCompact,
  metricSeries,
  pctOf,
  statsWindow,
  useChainMetrics,
  windowPair,
  type Metrics,
  type MetricsRead,
  type StatsWindow,
} from "@/components/explorer-v2/evm/metric-charts";
import { BLOCK_GRAY, LayerBlock, PickReadout, type BlockDay, type BlockLayer } from "@/components/explorer-v2/network/icm-parts";

/* The network-scope Stats facet: the chain-stats indexer aggregated across
   every indexed chain, in the C-Chain home's voice. Eight readouts carry
   each metric's window, its move against the window before, and its
   series in the foot. A readout is also the way in: click it and the
   large block below draws that metric, with the overlay that explains it
   (TPS over transactions, senders under addresses, the daily spike over
   the gas price). Everything rides the page clock; charts floor at a week.
   Fuji reads its own rollup, with the fee readings from its C-Chain. */

const METRIC_KEYS = [
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
];
const METRICS = METRIC_KEYS.join(",");

/* Fuji's rollup adds Beam's BEAM fees and Dexalot's ALOT fees to the
   C-Chain's AVAX fees, so the fee readings on Fuji read the Fuji C-Chain alone */
const FEE_KEYS: string[] = ["feesPaid", "avgGasPrice", "maxGasPrice"];
const FUJI_METRICS = METRIC_KEYS.filter((k) => !FEE_KEYS.includes(k)).join(",");
const FUJI_FEES = FEE_KEYS.join(",");

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

const EMPTY: Metrics = {};

/* exp-range-hold (a) and stats-chart-pick (a): a region whose content
   changes cross-fades. The copy it leaves goes to opacity 0 into a 2px
   blur, which hides the double image, and the new one arrives out of that
   blur 40ms later, both on the strong ease-out. Nothing in either moves;
   the leaving copy, popped out of the flow over the new one, takes no
   pointer, focus or reader, and keyboard focus inside it moves to the same
   control in the new copy. A window leaves in 140ms and arrives in 200ms,
   a picked chart in 120ms and 180ms. Under Reduce Motion a swap is a 150ms
   opacity cross-fade with no blur. */
interface Beat {
  out: number;
  in: number;
}
const WINDOW_BEAT: Beat = { out: 0.14, in: 0.2 };
const PICK_BEAT: Beat = { out: 0.12, in: 0.18 };
const FOCUSABLE = "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** the control that takes over focus from a copy that leaves: the one at the
 *  same place among the arriving copy's controls (tab order). Null when focus
 *  is in no leaving copy, or the arriving copy has no control there. */
export function focusHandOff<E>(copies: readonly { leaving: boolean; controls: readonly E[] }[], active: E): E | null {
  const from = copies.find((c) => c.leaving && c.controls.includes(active));
  const to = copies.find((c) => !c.leaving);
  if (!from || !to) return null;
  return to.controls[from.controls.indexOf(active)] ?? null;
}

function Swap({ k, beat, children }: { k: string; beat: Beat; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  // the copy that leaves goes inert, and at its next rendering update the
  // browser would drop the focus inside it on the page: a layout effect runs
  // first, and hands focus to the same control in the copy that arrives
  useLayoutEffect(() => {
    const root = box.current;
    const active = document.activeElement;
    if (!root || !(active instanceof HTMLElement) || !root.contains(active)) return;
    const copies = [...root.children].map((c) => ({
      leaving: c.hasAttribute("inert"),
      controls: [...c.querySelectorAll<HTMLElement>(FOCUSABLE)],
    }));
    focusHandOff(copies, active)?.focus({ preventScroll: true });
  }, [k]);
  return (
    <div ref={box} className="relative">
      <AnimatePresence initial={false} mode="popLayout">
        <SwapCopy key={k} beat={beat}>
          {children}
        </SwapCopy>
      </AnimatePresence>
    </div>
  );
}

function SwapCopy({ beat, ref, children }: { beat: Beat; ref?: Ref<HTMLDivElement>; children: ReactNode }) {
  const present = useIsPresent();
  const still = useReducedMotion();
  const blur = still ? {} : { filter: "blur(2px)" };
  return (
    <motion.div
      ref={ref}
      inert={!present}
      initial={{ opacity: 0, ...blur }}
      animate={{
        opacity: 1,
        ...(still ? {} : { filter: "blur(0px)" }),
        transitionEnd: { filter: "none" },
        transition: still ? { duration: 0.15, ease: EASE_OUT } : { duration: beat.in, delay: 0.04, ease: EASE_OUT },
      }}
      exit={{ opacity: 0, ...blur, transition: { duration: still ? 0.15 : beat.out, ease: EASE_OUT } }}
    >
      {children}
    </motion.div>
  );
}

/** the network's windowed readings and the chart they pick, without the shell */
export function NetworkStatsBody({ network = "mainnet" }: { network?: PchainNetwork }) {
  return network === "fuji" ? <FujiStatsBody /> : <StatsBody network={network} />;
}

/* Fuji's fee readings: the C-Chain's own read, on the same clock */
function FujiStatsBody() {
  const range = RANGE_DAYS[useExplorerTimeRange()];
  const fees = useChainMetrics(C_CHAIN_ID.fuji, Math.min(range * 2, 365), FUJI_FEES);
  return <StatsBody network="fuji" fees={fees} />;
}

function StatsBody({ network, fees }: { network: PchainNetwork; fees?: MetricsRead }) {
  const clock = useExplorerTimeRange();
  const fuji = network === "fuji";
  // fetch double the window so every reading can face its previous window
  const main = useChainMetrics(fuji ? "fuji" : "all", Math.min(RANGE_DAYS[clock] * 2, 365), fuji ? FUJI_METRICS : METRICS);
  const [pick, setPick] = useState<MetricKey>("txCount");
  const still = useReducedMotion();

  // exp-range-hold: the last window every read answered stays on screen,
  // dimmed, until the next one has; a first visit has none to hold, and
  // draws each read as it lands
  const [kept, setKept] = useState<StatsWindow<ExplorerRange> | null>(null);
  const { view, stale, keep } = statsWindow(kept, clock, main, fees);
  if (keep) setKept(keep);
  const ownFees = !!fees;
  const viewMetrics = view?.metrics;
  const viewFees = view?.fees;
  const m = useMemo<Metrics>(() => {
    if (!viewMetrics) return EMPTY;
    if (!ownFees) return viewMetrics;
    // the C-Chain's fee series stand in for the rollup's
    const merged: Metrics = { ...viewMetrics };
    for (const k of FEE_KEYS) merged[k] = viewFees?.[k];
    return merged;
  }, [viewMetrics, viewFees, ownFees]);
  const shown = view?.clock ?? clock;
  const range = RANGE_DAYS[shown];
  // under Reduce Motion a window swaps in place, where its dim lifts; otherwise it cross-fades
  const key = still ? "still" : shown;
  const chartDays = Math.max(CHART_FLOOR_DAYS, range);
  const isFee = (spec: MetricSpec) => ownFees && FEE_KEYS.includes(spec.key);
  // a reading's feed has answered: on Fuji a fee reading waits for the C-Chain's
  const answered = (spec: MetricSpec) => !!view && (!isFee(spec) || view.complete);

  // the ICM feed has its own shape: received and sent per day
  const icmDays = useMemo<BlockDay[]>(() => {
    const pts = [...(m.icmMessages?.data ?? [])].sort((a, b) => a.timestamp - b.timestamp);
    return thin(windowSeries(pts, chartDays), 200).map((p) => ({ date: p.date, v: { in: p.incomingCount, out: p.outgoingCount } }));
  }, [m, chartDays]);
  const icmPair = useMemo(() => {
    const pts = [...(m.icmMessages?.data ?? [])].sort((a, b) => a.timestamp - b.timestamp);
    if (!pts.length) return null;
    return windowPair(
      pts.map((p) => ({ timestamp: p.timestamp, value: p.incomingCount + p.outgoingCount })),
      range,
      "sum",
    );
  }, [m, range]);

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
  const subOf = (spec: MetricSpec) => {
    const sub = spec.mode === "avg" && range > 1 ? "daily avg" : spec.mode === "last" ? "all-time" : undefined;
    if (!isFee(spec)) return sub;
    return sub ? `C-Chain · ${sub}` : "C-Chain";
  };
  const windowNote = range < CHART_FLOOR_DAYS ? "7 days" : rangeWindowLabel(shown);

  let body: React.ReactNode;
  if (main.failed) {
    body = (
      <Board divide={false} className="border">
        <EmptyRow>Chain metrics unavailable</EmptyRow>
      </Board>
    );
  } else {
    const chart = pickedDays.length ? (
      <LayerBlock
        label={picked.label}
        note={isFee(picked) ? `C-Chain · ${windowNote}` : windowNote}
        days={pickedDays}
        layers={picked.key === "icm" ? ICM_LAYERS : [{ key: "a", label: picked.label, tone: BLOCK_GRAY }]}
        fmt={fmtOf(picked)}
        unit={picked.unit}
        headline={picked.mode}
        overlay={picked.overlay}
        href={picked.key === "icm" ? `/explorer/${network}/chains` : undefined}
        stale={stale}
      />
    ) : answered(picked) ? (
      <Board divide={false} className={cn("border transition-opacity duration-150 ease-out", stale && "opacity-60")}>
        <EmptyRow>No {picked.label.toLowerCase()} in this window</EmptyRow>
      </Board>
    ) : (
      <div className="h-72 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
    );
    body = (
      // a held window is busy for a screen reader too: its figures are being replaced
      <div className="flex flex-col gap-12" aria-busy={stale}>
        {/* the readings on the clock; each one picks the chart below. A readout
            stays mounted through a new window, so focus on it stays too: only
            its face cross-fades */}
        <ReadoutRow cols={4} className={cn("transition-opacity duration-150 ease-out", stale && "opacity-60")}>
          {SPECS.map((spec) => {
            const { value, delta } = readingOf(spec);
            const d = days(spec);
            const spark = spec.key === "icm" ? d.map((x) => x.v.in + x.v.out) : d.map((x) => x.v.a);
            return (
              <PickReadout key={spec.key} label={spec.label} on={pick === spec.key} onPick={() => setPick(spec.key)}>
                <Swap k={key} beat={WINDOW_BEAT}>
                  <Readout
                    label={spec.label}
                    value={value !== null ? fmtOf(spec)(value) : answered(spec) ? "—" : null}
                    unit={value !== null ? spec.unit : undefined}
                    sub={subOf(spec)}
                    delta={delta}
                    spark={spark}
                  />
                </Swap>
              </PickReadout>
            );
          })}
        </ReadoutRow>

        {/* the picked chart: it cross-fades on a new window, and on a new pick */}
        <Swap k={key} beat={WINDOW_BEAT}>
          <Swap k={pick} beat={PICK_BEAT}>
            {chart}
          </Swap>
        </Swap>
      </div>
    );
  }

  return body;
}
