"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  Brush,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  AXIS_TICK,
  BRUSH_PROPS,
  ChartPlate,
  SheetFrame,
  SheetGrid,
  SiblingDoor,
  dayLabel,
} from "@/components/explorer-v2/metric-sheet";
import { Board, BoardHeader, ChartBoard, StatDash } from "@/components/explorer-v2/ui";
import {
  RANGE_DAYS,
  RANGE_LABEL,
  useExplorerTimeRange,
  type ExplorerRange,
} from "@/components/explorer-v2/time-range";
import {
  BandKey,
  DOW_LABELS,
  FEE_HISTORY_BLOCKS,
  FeeBandChart,
  FeeHeatmap,
  GasStat,
  HistoryEmpty,
  ProtocolTable,
  ProtocolsTreemap,
  SelectorBars,
  TipPlate,
  UtilHistogram,
  fmtGas,
  useGasHistory,
  fmtNano,
  nanoUnit,
  useFeeHistory,
} from "@/components/explorer/GasMarketPage";
import { useContractNames } from "@/lib/sourcify-client";
import { GAS_METRICS, type GasMetricKey } from "@/components/explorer/gas-metrics";
import type { GasDayPoint, GasHistoryDays, GasMarket } from "@/lib/explorer-clickhouse";
import type { L1Chain } from "@/types/stats";

/* The per-metric detail sheets behind the Gas Market's stat cells: one
   figure, everything we know about it. The frame (eyebrow, title, blurb,
   methodology colophon) is shared; each metric composes its own sections
   from the market's chart idioms. The whole point of the top sheet staying
   quiet is that these pages don't have to. */

/* ---------------------------------------------------------------- */
/* data                                                              */
/* ---------------------------------------------------------------- */

function useGasMarket(evmChainId: number, rangeDays: number) {
  const [market, setMarket] = useState<GasMarket | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!Number.isFinite(evmChainId)) return;
    let cancelled = false;
    setMarket(null);
    setMissing(false);
    fetch(`/api/gas-market/${evmChainId}?range=${rangeDays}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: GasMarket) => {
        if (!cancelled) setMarket(data);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [evmChainId, rangeDays]);
  return { market, missing };
}

/* the clock's window, in the vocabularies this sheet's two feeds accept */
function historyDays(range: ExplorerRange): GasHistoryDays {
  const d = RANGE_DAYS[range];
  return d <= 7 ? 7 : d <= 30 ? 30 : d <= 90 ? 90 : 365;
}

/* ---------------------------------------------------------------- */
/* shared frame                                                      */
/* ---------------------------------------------------------------- */

/* the sheet chrome and instruments live in the shared metric-sheet module
   (extracted for the staking sheets); this wrapper keeps the gas registry
   lookup local so call sites stay one-liner */
function MetricFrame({
  base,
  chainName,
  metric,
  children,
}: {
  base: string;
  chainName: string;
  metric: GasMetricKey;
  children: React.ReactNode;
}) {
  const def = GAS_METRICS[metric];
  return (
    <SheetFrame
      backHref={`${base}/gas`}
      backLabel={`Gas Market · ${chainName}`}
      title={def.title}
      blurb={def.blurb}
      methodology={def.methodology}
    >
      {children}
    </SheetFrame>
  );
}

/* spike premium: how far p95 rides above the median, per bucket — the
   volatility a single fee line hides. Works on hourly and daily rows. */
function SpikePremiumChart<T extends { p50: number; p95: number }>({
  data,
  unit,
  labelFor,
  xTick,
}: {
  data: T[];
  unit: string;
  labelFor: (d: T) => string;
  xTick: (d: T) => string;
}) {
  const shaped = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        premiumPct: d.p50 > 0 ? ((d.p95 - d.p50) / d.p50) * 100 : 0,
        xLabel: xTick(d),
      })),
    [data, xTick],
  );
  return (
    <ChartPlate name="spike-premium">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={shaped}>
          <SheetGrid />
          <XAxis dataKey="xLabel" tickLine={false} axisLine={false} minTickGap={48} tick={AXIS_TICK} />
          <YAxis
            domain={[0, "dataMax"]}
            width={48}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => `+${Math.round(v)}%`}
          />
          <RechartsTooltip
            cursor={{ stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as T & { premiumPct: number };
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{labelFor(d)}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    +{d.premiumPct.toFixed(0)}% spike premium
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    p95 {d.p95} vs median {d.p50} {unit}
                  </p>
                </TipPlate>
              );
            }}
          />
          <Bar dataKey="premiumPct" fill="#E6212F" fillOpacity={0.55} isAnimationActive={false} />
          <Brush
            dataKey="xLabel"
            height={26}
            travellerWidth={8}
            stroke="#A2AFB2"
            fill="rgba(162, 175, 178, 0.06)"
            tickFormatter={() => ""}
          >
            <LineChart>
              <Line type="monotone" dataKey="premiumPct" stroke="#E6212F" strokeWidth={1} dot={false} isAnimationActive={false} />
            </LineChart>
          </Brush>
        </ComposedChart>
      </ResponsiveContainer>
    </ChartPlate>
  );
}

/* daily gas volume over the window — demand in absolute units */
function GasVolumeChart({ data }: { data: GasDayPoint[] }) {
  return (
    <ChartPlate name="gas-volume">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} barCategoryGap="18%">
          <SheetGrid />
          <XAxis dataKey="d" tickLine={false} axisLine={false} minTickGap={48} tick={AXIS_TICK} tickFormatter={dayLabel} />
          <YAxis
            domain={[0, "dataMax"]}
            width={48}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => fmtGas(v)}
          />
          <RechartsTooltip
            cursor={{ fill: "rgba(161,161,170,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as GasDayPoint;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.d}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {fmtGas(d.gas)} gas
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    {d.blocks.toLocaleString("en-US")} blocks
                  </p>
                </TipPlate>
              );
            }}
          />
          <Bar dataKey="gas" fill="#A2AFB2" isAnimationActive={false} />
          <Brush
            dataKey="d"
            height={26}
            travellerWidth={8}
            stroke="#A2AFB2"
            fill="rgba(162, 175, 178, 0.06)"
            tickFormatter={() => ""}
          >
            <LineChart>
              <Line type="monotone" dataKey="gas" stroke="#A2AFB2" strokeWidth={1} dot={false} isAnimationActive={false} />
            </LineChart>
          </Brush>
        </ComposedChart>
      </ResponsiveContainer>
    </ChartPlate>
  );
}

/* median fee per weekday, the week grid's rows collapsed to seven bars */
function DowProfileChart({ cells, unit }: { cells: GasMarket["heatmap"]; unit: string }) {
  const data = useMemo(() => {
    return DOW_LABELS.map((label, i) => {
      const vals = cells
        .filter((c) => c.dow === i + 1 && c.p50 > 0)
        .map((c) => c.p50)
        .sort((a, b) => a - b);
      return { label, p50: vals.length ? vals[Math.floor(vals.length / 2)] : 0 };
    });
  }, [cells]);
  return (
    <ChartPlate name="weekday-profile">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} barCategoryGap="24%">
          <SheetGrid />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} />
          <YAxis domain={[0, "dataMax"]} width={48} tickLine={false} axisLine={false} tick={AXIS_TICK} />
          <RechartsTooltip
            cursor={{ fill: "rgba(161,161,170,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as { label: string; p50: number };
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.label} · all hours</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.p50} {unit} median
                  </p>
                </TipPlate>
              );
            }}
          />
          <Bar dataKey="p50" fill="#A2AFB2" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartPlate>
  );
}

/* the actionable extract of the heatmap: the five cheapest and five
   priciest hour-of-week cells, as rows someone can schedule against */
function BestHoursList({ cells, unit }: { cells: GasMarket["heatmap"]; unit: string }) {
  const { cheapest, priciest, weekMedian } = useMemo(() => {
    const live = cells.filter((c) => c.p50 > 0);
    const sorted = [...live].sort((a, b) => a.p50 - b.p50);
    const medians = live.map((c) => c.p50).sort((a, b) => a - b);
    return {
      cheapest: sorted.slice(0, 5),
      priciest: sorted.slice(-5).reverse(),
      weekMedian: medians[Math.floor(medians.length / 2)] ?? 0,
    };
  }, [cells]);

  const row = (c: GasMarket["heatmap"][number]) => {
    const vsPct = weekMedian > 0 ? ((c.p50 - weekMedian) / weekMedian) * 100 : 0;
    return (
      <div
        key={`${c.dow}-${c.hour}`}
        className="flex items-center justify-between gap-4 px-5 py-2.5 md:px-6"
      >
        <span className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
          {DOW_LABELS[c.dow - 1]} {String(c.hour).padStart(2, "0")}:00 UTC
        </span>
        <span className="flex items-center gap-3 font-mono text-[12px] tabular-nums">
          <span className="text-zinc-500 dark:text-zinc-400">
            {c.p50} {unit}
          </span>
          <span className={vsPct > 0 ? "text-[#E6212F]" : "text-zinc-400 dark:text-zinc-500"}>
            {vsPct > 0 ? "+" : ""}
            {vsPct.toFixed(0)}%
          </span>
        </span>
      </div>
    );
  };

  return (
    <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
      <Board className="border">
        <BoardHeader label="Cheapest Hours · vs week median" />
        {cheapest.map(row)}
      </Board>
      <Board className="border">
        <BoardHeader label="Priciest Hours · vs week median" />
        {priciest.map(row)}
      </Board>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Base Fee                                                          */
/* ---------------------------------------------------------------- */

function BaseFeeSheet({ catalog, base }: { catalog: L1Chain; base: string }) {
  const evmChainId = Number(catalog.chainId);
  const unit = nanoUnit(catalog.networkToken?.symbol);
  const range = useExplorerTimeRange();
  const fee = useFeeHistory(catalog.rpcUrl);

  const days = historyDays(range);
  const { daily, missing } = useGasHistory(evmChainId, days);
  // the market payload feeds the hourly series (range-independent) and
  // the seasonality teaser, which follows the clock like everything else
  const { market, missing: marketMissing } = useGasMarket(evmChainId, Math.min(RANGE_DAYS[range], 90));

  const windowed = useMemo(() => (daily ?? []).slice(-RANGE_DAYS[range]), [daily, range]);
  const isHourly = range === "day";
  const windowLabel = isHourly
    ? "last 48 hours"
    : range === "all"
      ? `${RANGE_LABEL.year} · longest window`
      : RANGE_LABEL[range];

  // the window's story in three numbers: typical, spike, floor
  const stats = useMemo(() => {
    const src = windowed;
    if (!src.length) return null;
    const medians = src.map((p) => p.p50).sort((a, b) => a - b);
    const typical = medians[Math.floor(medians.length / 2)];
    let high = src[0];
    let low = src[0];
    for (const p of src) {
      if (p.p95 > high.p95) high = p;
      if (p.p50 < low.p50) low = p;
    }
    return { typical, high, low };
  }, [windowed]);

  return (
    <MetricFrame base={base} chainName={catalog.chainName} metric="base-fee">
      <Board divide={false} className="border">
        <BoardHeader label={`The Fee · ${windowLabel}`} />
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
          <GasStat label="Right Now" live>
            {fee.baseFeeWei !== null ? (
              <>
                {fmtNano(fee.baseFeeWei)}
                <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Typical · median of medians">
            {stats ? (
              <>
                {stats.typical}
                <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Spike · highest p95" sub={stats ? dayLabel(stats.high.d) : undefined}>
            {stats ? (
              <>
                {stats.high.p95}
                <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Floor · lowest median" sub={stats ? dayLabel(stats.low.d) : undefined}>
            {stats ? (
              <>
                {stats.low.p50}
                <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
        </div>
      </Board>

      <ChartBoard label={`Base Fee · ${windowLabel}`} action={<BandKey unit={unit} />}>
        <ChartPlate name="base-fee">
          {isHourly ? (
            market?.hourly.length ? (
              <FeeBandChart
                data={market.hourly}
                unit={unit}
                labelFor={(d) => d.t.replace("T", " · ") + " UTC"}
                detailed
                xTick={(d) => d.t.slice(11)}
              />
            ) : (
              <HistoryEmpty missing={marketMissing} />
            )
          ) : windowed.length ? (
            <FeeBandChart
              data={windowed}
              unit={unit}
              labelFor={(d) => d.d}
              detailed
              xTick={(d) => dayLabel(d.d)}
            />
          ) : (
            <HistoryEmpty missing={missing} />
          )}
        </ChartPlate>
      </ChartBoard>

      {/* the complementary time scale beside the volatility it smooths over */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard
          label={isHourly ? "Base Fee · last 7 days, daily" : "Base Fee · last 48 hours, hourly"}
          action={<BandKey unit={unit} />}
        >
          <ChartPlate name="base-fee">
            {isHourly ? (
              daily?.length ? (
                <FeeBandChart
                  data={daily}
                  unit={unit}
                  labelFor={(d) => d.d}
                  detailed
                  xTick={(d) => dayLabel(d.d)}
                />
              ) : (
                <HistoryEmpty missing={missing} />
              )
            ) : market?.hourly.length ? (
              <FeeBandChart
                data={market.hourly}
                unit={unit}
                labelFor={(d) => d.t.replace("T", " · ") + " UTC"}
                detailed
                xTick={(d) => d.t.slice(11)}
              />
            ) : (
              <HistoryEmpty missing={marketMissing} />
            )}
          </ChartPlate>
        </ChartBoard>

        <ChartBoard label={`Spike Premium · p95 over median, ${windowLabel}`}>
          {isHourly ? (
            market?.hourly.length ? (
              <SpikePremiumChart
                data={market.hourly}
                unit={unit}
                labelFor={(d) => d.t.replace("T", " · ") + " UTC"}
                xTick={(d) => d.t.slice(11)}
              />
            ) : (
              <HistoryEmpty missing={marketMissing} />
            )
          ) : windowed.length ? (
            <SpikePremiumChart
              data={windowed}
              unit={unit}
              labelFor={(d) => d.d}
              xTick={(d) => dayLabel(d.d)}
            />
          ) : (
            <HistoryEmpty missing={missing} />
          )}
        </ChartBoard>
      </div>

      {/* the fee's weekly rhythm, inline — the card doors to the full sheet */}
      {market && market.heatmap.length > 0 && (
        <ChartBoard
          label="Fee Seasonality · median by hour of week"
          href={`${base}/gas/fee-seasonality`}
        >
          <FeeHeatmap cells={market.heatmap} unit={unit} />
        </ChartBoard>
      )}

      <SiblingDoor
        href={`${base}/gas/utilization`}
        label="Utilization"
        sub="the demand these prices respond to, block by block"
      />
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* Utilization                                                       */
/* ---------------------------------------------------------------- */

function UtilTrendChart({ data }: { data: GasDayPoint[] }) {
  return (
    <ChartPlate name="daily-utilization">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <SheetGrid />
          <XAxis dataKey="d" tickLine={false} axisLine={false} minTickGap={48} tick={AXIS_TICK} tickFormatter={dayLabel} />
          <YAxis
            domain={[0, "dataMax"]}
            width={40}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => `${Math.round(v)}%`}
          />
          <YAxis yAxisId="gas" hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as GasDayPoint;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.d}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.utilPct.toFixed(1)}% utilized
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    {fmtGas(d.gas)} gas · {d.blocks.toLocaleString("en-US")} blocks
                  </p>
                </TipPlate>
              );
            }}
          />
          {/* gas volume rides under the utilization line — same demand, two units */}
          <Bar yAxisId="gas" dataKey="gas" fill="currentColor" fillOpacity={0.1} isAnimationActive={false} />
          <Line type="monotone" dataKey="utilPct" stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Brush
            dataKey="d"
            height={26}
            travellerWidth={8}
            stroke="#A2AFB2"
            fill="rgba(162, 175, 178, 0.06)"
            tickFormatter={() => ""}
          >
            <LineChart>
              <Line type="monotone" dataKey="utilPct" stroke="#A2AFB2" strokeWidth={1} dot={false} isAnimationActive={false} />
            </LineChart>
          </Brush>
        </ComposedChart>
      </ResponsiveContainer>
    </ChartPlate>
  );
}

function LiveUtilBars({ utilization }: { utilization: number[] }) {
  const data = utilization.map((u, i) => ({ i, pct: u * 100 }));
  return (
    <ChartPlate name="live-utilization">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} barCategoryGap="18%">
          <SheetGrid />
          <YAxis
            domain={[0, 100]}
            width={40}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => `${v}%`}
          />
          <RechartsTooltip
            cursor={{ fill: "rgba(161,161,170,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as { i: number; pct: number };
              return (
                <TipPlate>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.pct.toFixed(1)}% full
                  </p>
                  <p className="text-[10px] text-zinc-500">{data.length - d.i} blocks ago</p>
                </TipPlate>
              );
            }}
          />
          <Bar dataKey="pct" fill="currentColor" fillOpacity={0.55} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartPlate>
  );
}

function UtilizationSheet({ catalog, base }: { catalog: L1Chain; base: string }) {
  const evmChainId = Number(catalog.chainId);
  const range = useExplorerTimeRange();
  const fee = useFeeHistory(catalog.rpcUrl);

  const days = historyDays(range);
  const { daily, missing } = useGasHistory(evmChainId, days);
  // the fullness histogram is computed over the market's demand window,
  // which caps at 90d — the year view reads the quarter's distribution
  const histDays = Math.min(RANGE_DAYS[range], 90);
  const { market, missing: marketMissing } = useGasMarket(evmChainId, histDays);

  const windowed = useMemo(() => (daily ?? []).slice(-RANGE_DAYS[range]), [daily, range]);
  const windowLabel = RANGE_LABEL[range];
  const histLabel = RANGE_DAYS[range] > 90 ? `${RANGE_LABEL.quarter} · longest computed` : windowLabel;
  // a one-point daily chart says nothing: the day view keeps its 7-day
  // fetch as the trend, labeled as such
  const trendData = range === "day" ? (daily ?? []) : windowed;
  const trendLabel = range === "day" ? RANGE_LABEL.week : windowLabel;

  const liveUtil = fee.utilization.length
    ? (fee.utilization.reduce((s, u) => s + u, 0) / fee.utilization.length) * 100
    : null;

  const stats = useMemo(() => {
    if (!windowed.length) return null;
    const avg = windowed.reduce((s, p) => s + p.utilPct, 0) / windowed.length;
    let busiest = windowed[0];
    for (const p of windowed) if (p.utilPct > busiest.utilPct) busiest = p;
    const totalGas = windowed.reduce((s, p) => s + p.gas, 0);
    return { avg, busiest, totalGas };
  }, [windowed]);

  return (
    <MetricFrame base={base} chainName={catalog.chainName} metric="utilization">
      <Board divide={false} className="border">
        <BoardHeader label={`Blockspace · ${windowLabel}`} />
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
          <GasStat label="Right Now" live sub={`last ${FEE_HISTORY_BLOCKS} blocks`}>
            {liveUtil !== null ? (
              <>
                {liveUtil.toFixed(1)}
                <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Average">
            {stats ? (
              <>
                {stats.avg.toFixed(1)}
                <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Busiest Day" sub={stats ? dayLabel(stats.busiest.d) : undefined}>
            {stats ? (
              <>
                {stats.busiest.utilPct.toFixed(1)}
                <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Gas Used">{stats ? fmtGas(stats.totalGas) : <StatDash />}</GasStat>
        </div>
      </Board>

      {/* the live pulse beside its longer record */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard label={`Block by Block · last ${FEE_HISTORY_BLOCKS} blocks, live`}>
          {fee.utilization.length ? (
            <LiveUtilBars utilization={fee.utilization} />
          ) : (
            <HistoryEmpty missing={false} />
          )}
        </ChartBoard>

        <ChartBoard label={`Daily Utilization · ${trendLabel}`}>
          {trendData.length ? (
            <UtilTrendChart data={trendData} />
          ) : (
            <HistoryEmpty missing={missing} />
          )}
        </ChartBoard>
      </div>

      {/* the shape of demand, then its absolute size */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard label={`Block Fullness Distribution · ${histLabel}`}>
          {market?.histogram.length ? (
            <UtilHistogram histogram={market.histogram} />
          ) : (
            <HistoryEmpty missing={marketMissing} />
          )}
        </ChartBoard>

        <ChartBoard label={`Gas Volume · ${trendLabel}, daily`}>
          {trendData.length ? (
            <GasVolumeChart data={trendData} />
          ) : (
            <HistoryEmpty missing={missing} />
          )}
        </ChartBoard>
      </div>

      <SiblingDoor
        href={`${base}/gas/base-fee`}
        label="Base Fee"
        sub="the price this demand sets, percentile by percentile"
      />
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* Fee Seasonality                                                   */
/* ---------------------------------------------------------------- */

/* the detail heatmap: same 168 cells as the market sheet's, but each one
   answers on hover — a reader line pins the cell's story under the grid
   instead of a floating tooltip, so comparisons don't chase the cursor */
function HeatmapReader({ cells, unit }: { cells: GasMarket["heatmap"]; unit: string }) {
  const [hovered, setHovered] = useState<{ dow: number; hour: number } | null>(null);
  const byKey = useMemo(() => new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.p50])), [cells]);
  const values = cells.map((c) => c.p50).filter((v) => v > 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1e-9);
  const sorted = [...values].sort((a, b) => a - b);
  const weekMedian = sorted[Math.floor(sorted.length / 2)] ?? 0;

  const reader = (() => {
    if (!hovered) return null;
    const v = byKey.get(`${hovered.dow}-${hovered.hour}`);
    if (v === undefined) return null;
    const vsPct = weekMedian > 0 ? ((v - weekMedian) / weekMedian) * 100 : 0;
    return {
      label: `${DOW_LABELS[hovered.dow - 1]} ${String(hovered.hour).padStart(2, "0")}:00 UTC`,
      value: v,
      vsPct,
    };
  })();

  return (
    <div className="flex flex-col gap-3" onMouseLeave={() => setHovered(null)}>
      <div className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-px">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span
            key={`h-${h}`}
            className="pb-1 text-center font-mono text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500"
          >
            {h % 6 === 0 ? h : ""}
          </span>
        ))}
        {DOW_LABELS.map((label, i) => {
          const dow = i + 1;
          return (
            <HeatRow key={label} label={label}>
              {Array.from({ length: 24 }, (_, h) => {
                const v = byKey.get(`${dow}-${h}`);
                const t = v === undefined ? null : (v - min) / span;
                const active = hovered?.dow === dow && hovered?.hour === h;
                return (
                  <span
                    key={h}
                    onMouseEnter={() => setHovered({ dow, hour: h })}
                    className="aspect-square min-h-4 cursor-crosshair"
                    style={{
                      backgroundColor:
                        t === null
                          ? "rgba(161,161,170,0.08)"
                          : `rgba(230, 33, 47, ${(0.05 + 0.75 * t).toFixed(3)})`,
                      outline: active ? "1px solid currentColor" : undefined,
                      outlineOffset: active ? "-1px" : undefined,
                    }}
                  />
                );
              })}
            </HeatRow>
          );
        })}
      </div>
      {/* the reader line: pinned, so two cells can be compared without memory */}
      <div className="flex min-h-5 items-center justify-between font-mono text-[11px] tabular-nums">
        {reader ? (
          <>
            <span className="text-zinc-900 dark:text-zinc-100">
              {reader.label} · median {reader.value} {unit}
            </span>
            <span className={reader.vsPct > 0 ? "text-[#E6212F]" : "text-zinc-500 dark:text-zinc-400"}>
              {reader.vsPct > 0 ? "+" : ""}
              {reader.vsPct.toFixed(0)}% vs week median
            </span>
          </>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500">hover a cell · hours UTC</span>
        )}
      </div>
      <div className="flex items-center justify-end font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
        <span className="flex items-center gap-2">
          cheap {min} {unit}
          <span
            className="h-2 w-24"
            style={{
              background: "linear-gradient(to right, rgba(230,33,47,0.05), rgba(230,33,47,0.8))",
            }}
          />
          {max} {unit} pricey
        </span>
      </div>
    </div>
  );
}

function HeatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="flex items-center pr-2 font-mono text-[9px] uppercase text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      {children}
    </>
  );
}

/* median fee by hour of day, all seven days collapsed — the daily rhythm
   the week grid hints at, as one line */
function HourProfileChart({ cells, unit }: { cells: GasMarket["heatmap"]; unit: string }) {
  const data = useMemo(() => {
    return Array.from({ length: 24 }, (_, h) => {
      const vals = cells
        .filter((c) => c.hour === h && c.p50 > 0)
        .map((c) => c.p50)
        .sort((a, b) => a - b);
      return { h, p50: vals.length ? vals[Math.floor(vals.length / 2)] : 0 };
    });
  }, [cells]);
  return (
    <ChartPlate name="hour-profile">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <SheetGrid />
          <XAxis dataKey="h" tickLine={false} axisLine={false} interval={5} tick={AXIS_TICK} />
          <YAxis domain={[0, "dataMax"]} width={48} tickLine={false} axisLine={false} tick={AXIS_TICK} />
          <RechartsTooltip
            cursor={{ stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as { h: number; p50: number };
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">
                    {String(d.h).padStart(2, "0")}:00 UTC · all days
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.p50} {unit} median
                  </p>
                </TipPlate>
              );
            }}
          />
          <Line type="monotone" dataKey="p50" stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartPlate>
  );
}

function SeasonalitySheet({ catalog, base }: { catalog: L1Chain; base: string }) {
  const evmChainId = Number(catalog.chainId);
  const unit = nanoUnit(catalog.networkToken?.symbol);
  // on the page clock like every sheet. The heatmap needs a full week
  // for its 168 cells and the market fetch caps at a quarter, so the
  // effective window clamps both ways and the label says so.
  const range = useExplorerTimeRange();
  const rangeDays = Math.min(RANGE_DAYS[range], 90);
  const { market, missing } = useGasMarket(evmChainId, rangeDays);
  const heatLabel =
    RANGE_DAYS[range] < 7
      ? `${RANGE_LABEL.week} · shortest weekly window`
      : RANGE_DAYS[range] > 90
        ? `${RANGE_LABEL.quarter} · longest computed`
        : RANGE_LABEL[range];

  const stats = useMemo(() => {
    const cells = (market?.heatmap ?? []).filter((c) => c.p50 > 0);
    if (!cells.length) return null;
    let cheapest = cells[0];
    let priciest = cells[0];
    for (const c of cells) {
      if (c.p50 < cheapest.p50) cheapest = c;
      if (c.p50 > priciest.p50) priciest = c;
    }
    const median = (vals: number[]) => {
      const s = [...vals].sort((a, b) => a - b);
      return s.length ? s[Math.floor(s.length / 2)] : 0;
    };
    const weekday = median(cells.filter((c) => c.dow <= 5).map((c) => c.p50));
    const weekend = median(cells.filter((c) => c.dow >= 6).map((c) => c.p50));
    const weekendVsWeekday = weekday > 0 ? ((weekend - weekday) / weekday) * 100 : 0;
    return { cheapest, priciest, weekendVsWeekday };
  }, [market]);

  const cellLabel = (c: { dow: number; hour: number }) =>
    `${DOW_LABELS[c.dow - 1]} ${String(c.hour).padStart(2, "0")}:00`;

  return (
    <MetricFrame base={base} chainName={catalog.chainName} metric="fee-seasonality">
      <Board divide={false} className="border">
        <BoardHeader label={`The Weekly Rhythm · ${heatLabel}`} />
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 lg:grid-cols-3 lg:divide-y-0 dark:divide-zinc-800">
          <GasStat label="Cheapest Hour" sub={stats ? `${cellLabel(stats.cheapest)} UTC` : undefined}>
            {stats ? (
              <>
                {stats.cheapest.p50}
                <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Priciest Hour" sub={stats ? `${cellLabel(stats.priciest)} UTC` : undefined}>
            {stats ? (
              <>
                {stats.priciest.p50}
                <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Weekend vs Weekday" sub="median base fee">
            {stats ? (
              <>
                {stats.weekendVsWeekday > 0 ? "+" : ""}
                {stats.weekendVsWeekday.toFixed(0)}
                <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
        </div>
      </Board>

      <ChartBoard label="Hour of Week · median base fee">
        {market?.heatmap.length ? (
          <HeatmapReader cells={market.heatmap} unit={unit} />
        ) : (
          <HistoryEmpty missing={missing} />
        )}
      </ChartBoard>

      {/* the grid collapsed both ways: by hour, then by weekday */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard label="Hour of Day Profile · all days collapsed">
          {market?.heatmap.length ? (
            <HourProfileChart cells={market.heatmap} unit={unit} />
          ) : (
            <HistoryEmpty missing={missing} />
          )}
        </ChartBoard>

        <ChartBoard label="Day of Week Profile · all hours collapsed">
          {market?.heatmap.length ? (
            <DowProfileChart cells={market.heatmap} unit={unit} />
          ) : (
            <HistoryEmpty missing={missing} />
          )}
        </ChartBoard>
      </div>

      {/* the schedule someone actually acts on */}
      {market && market.heatmap.length > 0 && <BestHoursList cells={market.heatmap} unit={unit} />}

      <SiblingDoor
        href={`${base}/gas/base-fee`}
        label="Base Fee"
        sub="the price this rhythm plays out in, hour by hour"
      />
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* Blockspace Demand                                                 */
/* ---------------------------------------------------------------- */

function DemandSheet({ catalog, base }: { catalog: L1Chain; base: string }) {
  const evmChainId = Number(catalog.chainId);
  const symbol = catalog.networkToken?.symbol ?? "AVAX";
  const range = useExplorerTimeRange();
  // the demand aggregations scan raw_txs, which caps the window at 90d
  const rangeDays = Math.min(RANGE_DAYS[range], 90);
  const clamped = RANGE_DAYS[range] > 90;
  const windowLabel = clamped ? `${RANGE_LABEL.quarter} · longest computed` : RANGE_LABEL[range];
  const { market, missing } = useGasMarket(evmChainId, rangeDays);

  const unknownAddresses = useMemo(
    () => market?.protocols.flatMap((p) => (p.address ? [p.address] : [])) ?? [],
    [market],
  );
  const names = useContractNames(evmChainId, unknownAddresses);

  const top = market?.protocols[0];
  const revertedPct =
    market?.reverted && market.reverted.gas > 0
      ? (market.reverted.revertedGas / market.reverted.gas) * 100
      : null;

  return (
    <MetricFrame base={base} chainName={catalog.chainName} metric="demand">
      <Board divide={false} className="border">
        <BoardHeader label={`The Buyers · ${windowLabel}`} />
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
          <GasStat label="Total Gas">
            {market ? fmtGas(market.rangeTotalGas) : <StatDash />}
          </GasStat>
          <GasStat label="Transactions">
            {market?.reverted ? market.reverted.txs.toLocaleString("en-US") : <StatDash />}
          </GasStat>
          <GasStat
            label="Top Buyer"
            sub={top ? `${top.sharePct.toFixed(1)}% of the window's gas` : undefined}
          >
            {top ? (
              <span className="min-w-0 truncate">{top.name}</span>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat
            label="Reverted"
            sub={
              market?.reverted
                ? `${market.reverted.revertedTxs.toLocaleString("en-US")} txs paid for nothing`
                : undefined
            }
          >
            {revertedPct !== null ? (
              <>
                {revertedPct.toFixed(1)}
                <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
        </div>
      </Board>

      {/* the map: tile area = gas share, tiles link to dapp pages/addresses */}
      <ChartBoard label="Where the Gas Goes · by protocol" bodyClassName="p-2">
        {market?.protocols.length ? (
          <ProtocolsTreemap protocols={market.protocols} names={names} base={base} />
        ) : (
          <HistoryEmpty missing={missing} />
        )}
      </ChartBoard>

      {/* the figures the tiles can't fit */}
      <Board divide={false} className="border overflow-x-auto">
        {market?.protocols.length ? (
          <ProtocolTable protocols={market.protocols} names={names} base={base} symbol={symbol} />
        ) : (
          <HistoryEmpty missing={missing} />
        )}
      </Board>

      <ChartBoard
        label="By Method"
        action={
          market?.reverted ? (
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              {market.reverted.txs.toLocaleString("en-US")} txs
            </span>
          ) : undefined
        }
      >
        {market?.selectors.length ? (
          <SelectorBars selectors={market.selectors} />
        ) : (
          <HistoryEmpty missing={missing} />
        )}
      </ChartBoard>

      <SiblingDoor
        href={`${base}/gas/utilization`}
        label="Utilization"
        sub="how full this demand actually runs the blocks"
      />
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* entry                                                             */
/* ---------------------------------------------------------------- */

export function GasMetricContent({
  catalog,
  base,
  metric,
}: {
  catalog: L1Chain;
  base: string;
  metric: GasMetricKey;
}) {
  if (metric === "base-fee") return <BaseFeeSheet catalog={catalog} base={base} />;
  if (metric === "utilization") return <UtilizationSheet catalog={catalog} base={base} />;
  if (metric === "demand") return <DemandSheet catalog={catalog} base={base} />;
  return <SeasonalitySheet catalog={catalog} base={base} />;
}
