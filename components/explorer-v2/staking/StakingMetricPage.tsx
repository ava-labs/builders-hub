"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
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
import {
  AXIS_TICK,
  BRUSH_PROPS,
  ChartPlate,
  SheetFrame,
  SheetGrid,
  SiblingDoor,
} from "@/components/explorer-v2/metric-sheet";
import { Board, BoardHeader, StatDash } from "@/components/explorer-v2/ui";
import { ChartEmpty, Stat, TipPlate } from "./bits";
import { RANGE_DAYS, RANGE_LABEL, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import {
  NANO,
  fmtCompact,
  joinStakingRatio,
  num,
  thin,
  toSeries,
  useMoneyFlow,
  usePrimaryMetrics,
  useSdkValidators,
  useStakingApy,
  windowSeries,
  type RatioPoint,
} from "./data";
import {
  ConcentrationChart,
  FeeChart,
  LENS_LABEL,
  LensToggle,
  type ConcentrationPoint,
  type FeeBucket,
  type Lens,
} from "./PrimaryStaking";
import { STAKING_METRICS, type StakingMetricKey } from "./staking-metrics";

/* The per-metric detail sheets behind the Primary Network Staking page —
   the gas family's contract, applied to the staking economy: one figure
   per sheet, real axes, a pan strip, the toolbar, and the methodology
   colophon. Every sheet except the current-set distribution rides the
   page clock. */

const OWN_COLOR = "currentColor";
const DELEGATED_COLOR = "#E6212F";
const QUIET_BAR = "#A2AFB2";

/* ---------------------------------------------------------------- */
/* data                                                              */
/* ---------------------------------------------------------------- */

/* the sheets' windows floor at a week — a one-bar day chart says nothing */
function chartWindow(rangeDays: number): number {
  return Math.max(7, rangeDays);
}

/* ---------------------------------------------------------------- */
/* frame + strip                                                     */
/* ---------------------------------------------------------------- */

function MetricFrame({
  base,
  metric,
  children,
}: {
  base: string;
  metric: StakingMetricKey;
  children: React.ReactNode;
}) {
  const def = STAKING_METRICS[metric];
  return (
    <SheetFrame
      backHref={base}
      backLabel="Staking · Primary Network"
      title={def.title}
      blurb={def.blurb}
      methodology={def.methodology}
    >
      {children}
    </SheetFrame>
  );
}

/* the sheet's readings row: bordered board, the window stated once */
function SheetStrip({
  label,
  chip,
  children,
  cols = 4,
}: {
  label: string;
  chip: string;
  children: React.ReactNode;
  cols?: 3 | 4;
}) {
  return (
    <Board divide={false} className="border">
      <BoardHeader
        label={label}
        display
        action={
          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
            {chip}
          </span>
        }
      />
      <div
        className={
          cols === 3
            ? "grid grid-cols-3 divide-x divide-zinc-200 dark:divide-zinc-800"
            : "grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800"
        }
      >
        {children}
      </div>
    </Board>
  );
}

const dateTick = (d: string) => d.slice(5);

/* ---------------------------------------------------------------- */
/* Total Stake                                                       */
/* ---------------------------------------------------------------- */

function TotalStakeSheet({ base, network }: { base: string; network: string }) {
  void network;
  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];
  const { data: metrics, failed } = usePrimaryMetrics();
  const { data: apy } = useStakingApy();

  const stakeSeries = useMemo(() => {
    const own = toSeries(metrics?.validator_weight);
    const delegated = new Map(toSeries(metrics?.delegator_weight).map((p) => [p.day, p.value]));
    const joined = own.map((p) => ({
      day: p.day,
      own: p.value / NANO,
      delegated: (delegated.get(p.day) ?? 0) / NANO,
    }));
    return thin(windowSeries(joined, chartWindow(range)), 400);
  }, [metrics, range]);

  const delegatorSeries = useMemo(
    () => thin(windowSeries(toSeries(metrics?.delegator_count), chartWindow(range)), 400),
    [metrics, range],
  );

  const ratioSeries = useMemo<RatioPoint[]>(
    () => thin(windowSeries(joinStakingRatio(metrics, apy), chartWindow(range)), 400),
    [metrics, apy, range],
  );

  const own = num(metrics?.validator_weight?.current_value);
  const delegated = num(metrics?.delegator_weight?.current_value);
  const total = own !== null && delegated !== null ? (own + delegated) / NANO : null;
  const supply = apy?.current?.supply ?? null;
  const ofSupply = total !== null && supply ? (total / supply) * 100 : null;

  return (
    <MetricFrame base={base} metric="total-stake">
      <div className="flex flex-col gap-10">
        <SheetStrip label="Total Stake" chip="Live set">
          <Stat label="Total Staked">
            {total !== null ? `${fmtCompact(total)} AVAX` : <StatDash />}
          </Stat>
          <Stat label="Own Stake">
            {own !== null ? `${fmtCompact(own / NANO)} AVAX` : <StatDash />}
          </Stat>
          <Stat label="Delegated">
            {delegated !== null ? `${fmtCompact(delegated / NANO)} AVAX` : <StatDash />}
          </Stat>
          <Stat label="Of Supply" sub={supply ? `${fmtCompact(supply)} AVAX circulating` : undefined}>
            {ofSupply !== null ? `${ofSupply.toFixed(1)}%` : <StatDash />}
          </Stat>
        </SheetStrip>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
              {range < 7 ? "Own + Delegated · 7 days" : "Own + Delegated"}
            </p>
            <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 bg-zinc-900/15 dark:bg-zinc-100/15" /> own
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 bg-[#E6212F]/25" /> delegated
              </span>
            </span>
          </div>
          {stakeSeries.length ? (
            <ChartPlate name="total-stake">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stakeSeries} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <SheetGrid />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={48} tick={AXIS_TICK} tickFormatter={dateTick} />
                  <YAxis
                    domain={["auto", "auto"]}
                    width={54}
                    tickLine={false}
                    axisLine={false}
                    tick={AXIS_TICK}
                    tickFormatter={(v: number) => fmtCompact(v)}
                  />
                  <RechartsTooltip
                    cursor={{ stroke: "rgba(161,161,170,0.35)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as { day: string; own: number; delegated: number };
                      return (
                        <TipPlate>
                          <p className="text-[10px] text-zinc-500">{d.day}</p>
                          <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {fmtCompact(d.own + d.delegated)} AVAX staked
                          </p>
                          <p className="text-[10px] tabular-nums text-zinc-500">
                            own {fmtCompact(d.own)} · delegated {fmtCompact(d.delegated)}
                          </p>
                        </TipPlate>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="own" stackId="stake" stroke={OWN_COLOR} strokeWidth={1.5} fill={OWN_COLOR} fillOpacity={0.1} isAnimationActive={false} />
                  <Area type="monotone" dataKey="delegated" stackId="stake" stroke={DELEGATED_COLOR} strokeWidth={1.5} fill={DELEGATED_COLOR} fillOpacity={0.12} isAnimationActive={false} />
                  <Brush dataKey="day" {...BRUSH_PROPS}>
                    <LineChart>
                      <Line dataKey="own" stroke="#A2AFB2" strokeWidth={1} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </Brush>
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPlate>
          ) : (
            <ChartEmpty failed={failed} />
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
              {range < 7 ? "Staking Ratio · 7 days" : "Staking Ratio"}
            </p>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              staked share of circulating supply
            </span>
          </div>
          {ratioSeries.length ? (
            <ChartPlate name="staking-ratio">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ratioSeries} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <SheetGrid />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={48} tick={AXIS_TICK} tickFormatter={dateTick} />
                  <YAxis
                    domain={["auto", "auto"]}
                    width={44}
                    tickLine={false}
                    axisLine={false}
                    tick={AXIS_TICK}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  />
                  <RechartsTooltip
                    cursor={{ stroke: "rgba(161,161,170,0.35)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as RatioPoint;
                      return (
                        <TipPlate>
                          <p className="text-[10px] text-zinc-500">{d.day}</p>
                          <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {d.pct.toFixed(1)}% of supply staked
                          </p>
                          <p className="text-[10px] tabular-nums text-zinc-500">
                            {fmtCompact(d.staked)} of {fmtCompact(d.supply)} AVAX
                          </p>
                        </TipPlate>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="pct" stroke={DELEGATED_COLOR} strokeWidth={1.5} fill={DELEGATED_COLOR} fillOpacity={0.08} isAnimationActive={false} />
                  <Brush dataKey="day" {...BRUSH_PROPS}>
                    <LineChart>
                      <Line dataKey="pct" stroke="#A2AFB2" strokeWidth={1} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </Brush>
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPlate>
          ) : (
            <ChartEmpty failed={failed} />
          )}
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Total stake read against the circulating supply the emission feed reports for the same
            day. The axis floats to magnify the drift — the range across the whole history is only
            a few points, and the drift is the signal.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
            {range < 7 ? "Delegators · 7 days" : "Delegators"}
          </p>
          {delegatorSeries.length ? (
            <ChartPlate name="delegators">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={delegatorSeries} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <SheetGrid />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={48} tick={AXIS_TICK} tickFormatter={dateTick} />
                  <YAxis domain={["auto", "auto"]} width={54} tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(v: number) => fmtCompact(v)} />
                  <RechartsTooltip
                    cursor={{ stroke: "rgba(161,161,170,0.35)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as { day: string; value: number };
                      return (
                        <TipPlate>
                          <p className="text-[10px] text-zinc-500">{d.day}</p>
                          <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {Math.round(d.value).toLocaleString("en-US")} delegators
                          </p>
                        </TipPlate>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="value" stroke="currentColor" strokeWidth={1.5} fill="currentColor" fillOpacity={0.1} isAnimationActive={false} />
                  <Brush dataKey="day" {...BRUSH_PROPS}>
                    <LineChart>
                      <Line dataKey="value" stroke="#A2AFB2" strokeWidth={1} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </Brush>
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPlate>
          ) : (
            <ChartEmpty failed={failed} />
          )}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <SiblingDoor href={`${base}/apy`} label="Reward Rate" sub="What the protocol mints, annualized · est" />
          <SiblingDoor href={`${base}/expiry`} label="Stake Expiry" sub="When it comes unlocked" />
        </div>
      </div>
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* APY                                                               */
/* ---------------------------------------------------------------- */

function ApySheet({ base, network }: { base: string; network: string }) {
  void network;
  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];
  const { data: apy, failed } = useStakingApy();

  const series = useMemo(() => {
    if (!apy?.data) return [];
    const sorted = [...apy.data]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((p) => ({ day: p.date, maxAPY: p.maxAPY, minAPY: p.minAPY }));
    return thin(windowSeries(sorted, chartWindow(range)), 400);
  }, [apy, range]);

  return (
    <MetricFrame base={base} metric="apy">
      <div className="flex flex-col gap-10">
        <SheetStrip label="Reward Rate" chip="Live estimate" cols={3}>
          {/* the two figures differ by TERM LENGTH, not by role — the
              consumption rate interpolates 10% → 12% across durations */}
          <Stat label="1-Year Term · Est" sub="maximum duration rate">
            {apy?.current ? `${apy.current.maxAPY.toFixed(2)}%` : <StatDash />}
          </Stat>
          <Stat label="2-Week Term · Est" sub="minimum duration rate">
            {apy?.current ? `${apy.current.minAPY.toFixed(2)}%` : <StatDash />}
          </Stat>
          <Stat label="Supply" sub="AVAX circulating">
            {apy?.current?.supply ? fmtCompact(apy.current.supply) : <StatDash />}
          </Stat>
        </SheetStrip>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
              {range < 7 ? "Rate Curves · 7 days" : "Rate Curves"}
            </p>
            <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-zinc-900 dark:bg-zinc-100" /> 1-year term
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-b border-dashed border-[#A2AFB2]" /> 2-week
              </span>
            </span>
          </div>
          {series.length ? (
            <ChartPlate name="staking-apy">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <SheetGrid />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={48} tick={AXIS_TICK} tickFormatter={dateTick} />
                  <YAxis
                    domain={["auto", "auto"]}
                    width={44}
                    tickLine={false}
                    axisLine={false}
                    tick={AXIS_TICK}
                    tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                  />
                  <RechartsTooltip
                    cursor={{ stroke: "rgba(161,161,170,0.35)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as { day: string; maxAPY: number; minAPY: number };
                      return (
                        <TipPlate>
                          <p className="text-[10px] text-zinc-500">{d.day}</p>
                          <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {d.maxAPY.toFixed(2)}% · 1-year term
                          </p>
                          <p className="text-[10px] tabular-nums text-zinc-500">2-week {d.minAPY.toFixed(2)}%</p>
                        </TipPlate>
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="maxAPY" stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="minAPY" stroke={QUIET_BAR} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                  <Brush dataKey="day" {...BRUSH_PROPS}>
                    <LineChart>
                      <Line dataKey="maxAPY" stroke="#A2AFB2" strokeWidth={1} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </Brush>
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPlate>
          ) : (
            <ChartEmpty failed={failed} />
          )}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <SiblingDoor href={`${base}/rewards`} label="Rewards" sub="What the rate mints, day by day" />
          <SiblingDoor href={`${base}/total-stake`} label="Total Stake" sub="The denominator: capital at work" />
        </div>
      </div>
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* Rewards                                                           */
/* ---------------------------------------------------------------- */

function RewardsSheet({ base, network }: { base: string; network: string }) {
  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];
  // the money-flow feed's longest window is a year: ALL clamps and says so
  const rangeLabel = clock === "all" ? `${RANGE_LABEL.year} · longest window` : RANGE_LABEL[clock];
  const { data: metrics, failed } = usePrimaryMetrics();
  const { flow, failed: flowFailed } = useMoneyFlow(network, range);

  const mintedSeries = useMemo(() => {
    // the moving average runs over the FULL series so the window's left
    // edge doesn't start artificially low, then the window slices
    const full = toSeries(metrics?.daily_rewards);
    let rolling = 0;
    const withMa = full.map((p, i) => {
      rolling += p.value;
      if (i >= 30) rolling -= full[i - 30].value;
      return { ...p, ma: rolling / Math.min(i + 1, 30) };
    });
    return thin(windowSeries(withMa, chartWindow(range)), 400);
  }, [metrics, range]);

  const cumulativeSeries = useMemo(
    () => thin(windowSeries(toSeries(metrics?.cumulative_rewards), chartWindow(range)), 400),
    [metrics, range],
  );

  // payouts, windowed to the clock (the feed serves the covering span)
  const paidSeries = useMemo(
    () => (flow ? flow.rewards.slice(-chartWindow(range)) : null),
    [flow, range],
  );
  const paidWindow = useMemo(
    () => (flow ? flow.rewards.slice(-range) : null),
    [flow, range],
  );
  const paidTotal = paidWindow?.reduce((s, d) => s + d.avax, 0) ?? null;
  const paidCount = paidWindow?.reduce((s, d) => s + d.payouts, 0) ?? null;

  const mintedLastDay = useMemo(() => {
    const s = toSeries(metrics?.daily_rewards);
    return s.length ? s[s.length - 1].value : null;
  }, [metrics]);
  const cumulative = num(metrics?.cumulative_rewards?.current_value);

  return (
    <MetricFrame base={base} metric="rewards">
      <div className="flex flex-col gap-10">
        <SheetStrip label="Rewards" chip={`Last ${rangeLabel}`}>
          <Stat label="Paid Out" sub={paidCount !== null ? `${paidCount.toLocaleString()} payouts` : undefined}>
            {paidTotal !== null ? `${fmtCompact(paidTotal)} AVAX` : <StatDash />}
          </Stat>
          <Stat label="Minted" sub="last full day">
            {mintedLastDay !== null ? `${fmtCompact(mintedLastDay)} AVAX` : <StatDash />}
          </Stat>
          <Stat label="Minted · All-Time">
            {cumulative !== null ? `${fmtCompact(cumulative)} AVAX` : <StatDash />}
          </Stat>
          <Stat label="Daily Avg" sub="paid, over the window">
            {paidTotal !== null && paidWindow?.length
              ? `${fmtCompact(paidTotal / paidWindow.length)} AVAX`
              : <StatDash />}
          </Stat>
        </SheetStrip>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
              {range < 7 ? "Paid Out Per Day · 7 days" : "Paid Out Per Day"}
            </p>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              reward UTXOs, as they unlocked
            </span>
          </div>
          {paidSeries?.length ? (
            <ChartPlate name="rewards-paid">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paidSeries} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <SheetGrid />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={48} tick={AXIS_TICK} tickFormatter={dateTick} />
                  <YAxis domain={[0, "dataMax"]} width={54} tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(v: number) => fmtCompact(v)} />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(161,161,170,0.08)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as { date: string; avax: number; payouts: number };
                      return (
                        <TipPlate>
                          <p className="text-[10px] text-zinc-500">{d.date}</p>
                          <p className="text-xs font-semibold tabular-nums text-[#E6212F]">
                            {Math.round(d.avax).toLocaleString()} AVAX paid
                          </p>
                          <p className="text-[10px] tabular-nums text-zinc-500">
                            {d.payouts.toLocaleString()} payouts
                          </p>
                        </TipPlate>
                      );
                    }}
                  />
                  <Bar dataKey="avax" fill={DELEGATED_COLOR} fillOpacity={0.8} minPointSize={1} isAnimationActive={false} />
                  <Brush dataKey="date" {...BRUSH_PROPS}>
                    <LineChart>
                      <Line dataKey="avax" stroke="#A2AFB2" strokeWidth={1} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </Brush>
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPlate>
          ) : (
            <ChartEmpty failed={flowFailed} />
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
              {range < 7 ? "Minted Per Day · 7 days" : "Minted Per Day"}
            </p>
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
              <span className="h-0.5 w-4 bg-[#E6212F]" /> 30d avg
            </span>
          </div>
          {mintedSeries.length ? (
            <ChartPlate name="rewards-minted">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={mintedSeries} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <SheetGrid />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={48} tick={AXIS_TICK} tickFormatter={dateTick} />
                  <YAxis domain={[0, "dataMax"]} width={54} tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(v: number) => fmtCompact(v)} />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(161,161,170,0.08)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as { day: string; value: number; ma: number };
                      return (
                        <TipPlate>
                          <p className="text-[10px] text-zinc-500">{d.day}</p>
                          <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {fmtCompact(d.value)} AVAX minted
                          </p>
                          <p className="text-[10px] tabular-nums text-zinc-500">30d average {fmtCompact(d.ma)}</p>
                        </TipPlate>
                      );
                    }}
                  />
                  <Bar dataKey="value" fill={QUIET_BAR} minPointSize={1} isAnimationActive={false} />
                  <Line type="monotone" dataKey="ma" stroke={DELEGATED_COLOR} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Brush dataKey="day" {...BRUSH_PROPS}>
                    <LineChart>
                      <Line dataKey="value" stroke="#A2AFB2" strokeWidth={1} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </Brush>
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPlate>
          ) : (
            <ChartEmpty failed={failed} />
          )}
        </section>

        <section className="flex flex-col gap-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
            {range < 7 ? "Cumulative · 7 days" : "Cumulative"}
          </p>
          {cumulativeSeries.length ? (
            <ChartPlate name="rewards-cumulative">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cumulativeSeries} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <SheetGrid />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={48} tick={AXIS_TICK} tickFormatter={dateTick} />
                  <YAxis domain={["auto", "auto"]} width={54} tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(v: number) => fmtCompact(v)} />
                  <RechartsTooltip
                    cursor={{ stroke: "rgba(161,161,170,0.35)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as { day: string; value: number };
                      return (
                        <TipPlate>
                          <p className="text-[10px] text-zinc-500">{d.day}</p>
                          <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {fmtCompact(d.value)} AVAX all-time
                          </p>
                        </TipPlate>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="value" stroke="currentColor" strokeWidth={1.5} fill="currentColor" fillOpacity={0.1} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPlate>
          ) : (
            <ChartEmpty failed={failed} />
          )}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <SiblingDoor href={`${base}/apy`} label="Reward Rate" sub="The rate behind the minting · est" />
          <SiblingDoor href={`${base}/expiry`} label="Stake Expiry" sub="When the payouts burst: terms ending" />
        </div>
      </div>
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* Expiry                                                            */
/* ---------------------------------------------------------------- */

function ExpirySheet({ base, network }: { base: string; network: string }) {
  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];
  // the unlock schedule reaches a year ahead at most: ALL clamps and says so
  const rangeLabel = clock === "all" ? `${RANGE_LABEL.year} · longest window` : RANGE_LABEL[clock];
  const { data: metrics } = usePrimaryMetrics();
  const { flow, failed } = useMoneyFlow(network, range);

  // the mirrored FUTURE window: the clock's span, ahead of now
  const days = Math.max(7, range);
  const series = useMemo(() => {
    if (!flow) return null;
    let cum = 0;
    return flow.unlocks.slice(0, days).map((d) => {
      cum += d.avax;
      return { ...d, cumulative: cum };
    });
  }, [flow, days]);

  const windowTotal = useMemo(
    () => flow?.unlocks.slice(0, range).reduce((s, d) => s + d.avax, 0) ?? null,
    [flow, range],
  );
  const windowEntries = useMemo(
    () => flow?.unlocks.slice(0, range).reduce((s, d) => s + d.stakers, 0) ?? null,
    [flow, range],
  );
  const biggestDay = useMemo(() => {
    const w = flow?.unlocks.slice(0, range) ?? [];
    return w.length ? w.reduce((a, b) => (b.avax > a.avax ? b : a)) : null;
  }, [flow, range]);

  const own = num(metrics?.validator_weight?.current_value);
  const delegated = num(metrics?.delegator_weight?.current_value);
  const totalStaked = own !== null && delegated !== null ? (own + delegated) / NANO : null;
  const shareOfStake =
    windowTotal !== null && totalStaked ? (windowTotal / totalStaked) * 100 : null;

  return (
    <MetricFrame base={base} metric="expiry">
      <div className="flex flex-col gap-10">
        <SheetStrip label="Stake Expiry" chip={`Next ${rangeLabel}`}>
          <Stat label="Expiring">
            {windowTotal !== null ? `${fmtCompact(windowTotal)} AVAX` : <StatDash />}
          </Stat>
          <Stat label="Of Total Stake">
            {shareOfStake !== null ? `${shareOfStake.toFixed(1)}%` : <StatDash />}
          </Stat>
          <Stat label="Entries Ending" sub="validators + delegators">
            {windowEntries !== null ? windowEntries.toLocaleString("en-US") : <StatDash />}
          </Stat>
          <Stat label="Biggest Day" sub={biggestDay ? biggestDay.date : undefined}>
            {biggestDay ? `${fmtCompact(biggestDay.avax)} AVAX` : <StatDash />}
          </Stat>
        </SheetStrip>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
              {range < 7 ? "Unlock Schedule · next 7 days" : "Unlock Schedule"}
            </p>
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
              <span className="h-0.5 w-4 bg-[#E6212F]" /> cumulative
            </span>
          </div>
          {series?.length ? (
            <ChartPlate name="stake-expiry">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <SheetGrid />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={48} tick={AXIS_TICK} tickFormatter={dateTick} />
                  <YAxis yAxisId="day" domain={[0, "dataMax"]} width={54} tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(v: number) => fmtCompact(v)} />
                  <YAxis yAxisId="cum" orientation="right" domain={[0, "dataMax"]} width={54} tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(v: number) => fmtCompact(v)} />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(161,161,170,0.08)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as {
                        date: string;
                        avax: number;
                        stakers: number;
                        cumulative: number;
                      };
                      return (
                        <TipPlate>
                          <p className="text-[10px] text-zinc-500">{d.date}</p>
                          <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {fmtCompact(d.avax)} AVAX unlocks
                          </p>
                          <p className="text-[10px] tabular-nums text-zinc-500">
                            {d.stakers.toLocaleString()} entries end · {fmtCompact(d.cumulative)} cumulative
                          </p>
                        </TipPlate>
                      );
                    }}
                  />
                  <Bar yAxisId="day" dataKey="avax" fill={QUIET_BAR} fillOpacity={0.8} minPointSize={1} isAnimationActive={false} />
                  <Line yAxisId="cum" type="monotone" dataKey="cumulative" stroke={DELEGATED_COLOR} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Brush dataKey="date" {...BRUSH_PROPS}>
                    <LineChart>
                      <Line dataKey="avax" stroke="#A2AFB2" strokeWidth={1} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </Brush>
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPlate>
          ) : (
            <ChartEmpty failed={failed} />
          )}
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            The maximum that can unlock, not a prediction of selling — most stake re-enters within
            days. Bars are per-day totals (left axis); the red line accumulates across the window
            (right axis).
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <SiblingDoor href={`${base}/total-stake`} label="Total Stake" sub="The pool this drains from" />
          <SiblingDoor href={`${base}/rewards`} label="Rewards" sub="What lands when terms end" />
        </div>
      </div>
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* Distribution                                                      */
/* ---------------------------------------------------------------- */

function DistributionSheet({ base, network }: { base: string; network: string }) {
  void network;
  const { data: sdkValidators, failed } = useSdkValidators();
  const [lens, setLens] = useState<Lens>("weight");

  const concentration = useMemo<ConcentrationPoint[]>(() => {
    if (!sdkValidators?.length) return [];
    const pick = (v: (typeof sdkValidators)[number]): number => {
      const own = num(v.amountStaked) ?? 0;
      const delegated = num(v.amountDelegated) ?? 0;
      return lens === "own" ? own : lens === "delegated" ? delegated : own + delegated;
    };
    const weights = sdkValidators.map((v) => pick(v) / NANO).sort((a, b) => b - a);
    const total = weights.reduce((s, w) => s + w, 0);
    if (total <= 0) return [];
    let cumulative = 0;
    return weights.map((weight, i) => {
      cumulative += weight;
      return { rank: i + 1, weight, cumulativePct: (cumulative / total) * 100 };
    });
  }, [sdkValidators, lens]);

  const halfClub = useMemo(() => {
    const hit = concentration.find((p) => p.cumulativePct >= 50);
    return hit?.rank ?? null;
  }, [concentration]);

  const feeBuckets = useMemo<FeeBucket[]>(() => {
    if (!sdkValidators?.length) return [];
    const buckets = new Map<number, { count: number; weight: number }>();
    for (const v of sdkValidators) {
      const fee = Math.round(num(v.delegationFee) ?? 0);
      const key = Math.min(fee, 16);
      const b = buckets.get(key) ?? { count: 0, weight: 0 };
      b.count += 1;
      b.weight += (num(v.amountStaked) ?? 0) / NANO;
      buckets.set(key, b);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([fee, b]) => ({ label: fee >= 16 ? "16%+" : `${fee}%`, ...b }));
  }, [sdkValidators]);

  const medianFee = useMemo(() => {
    if (!sdkValidators?.length) return null;
    const fees = sdkValidators
      .map((v) => num(v.delegationFee))
      .filter((f): f is number => f !== null)
      .sort((a, b) => a - b);
    return fees.length ? fees[Math.floor(fees.length / 2)] : null;
  }, [sdkValidators]);

  const largestShare = concentration.length
    ? (concentration[0].weight /
        concentration.reduce((s, p) => s + p.weight, 0)) *
      100
    : null;

  return (
    <MetricFrame base={base} metric="distribution">
      <div className="flex flex-col gap-10">
        <SheetStrip label="Stake Distribution" chip="Current set">
          <Stat label="Validators">
            {sdkValidators ? sdkValidators.length.toLocaleString("en-US") : <StatDash />}
          </Stat>
          <Stat label="Half the Stake" sub="smallest club controlling 50%">
            {halfClub !== null ? `top ${halfClub}` : <StatDash />}
          </Stat>
          <Stat label="Largest Validator">
            {largestShare !== null ? `${largestShare.toFixed(2)}%` : <StatDash />}
          </Stat>
          <Stat label="Median Fee">
            {medianFee !== null ? `${medianFee.toFixed(0)}%` : <StatDash />}
          </Stat>
        </SheetStrip>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
              Concentration by Rank · {LENS_LABEL[lens].toLowerCase()}
            </p>
            <LensToggle value={lens} onChange={setLens} />
          </div>
          {concentration.length ? (
            <ChartPlate name="stake-concentration">
              <ConcentrationChart data={thin(concentration, 400)} setSize={concentration.length} />
            </ChartPlate>
          ) : (
            <ChartEmpty failed={failed} />
          )}
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Bars: each validator&apos;s {LENS_LABEL[lens].toLowerCase()} by rank (right axis). Red
            line: the cumulative share the top N hold (left axis)
            {halfClub !== null && <> — the top {halfClub} together control half of it</>}. The
            flatter the climb, the more evenly the network&apos;s security is spread.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
              Delegation Fees · weighted by stake
            </p>
            {medianFee !== null && (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                median {medianFee.toFixed(0)}%
              </span>
            )}
          </div>
          {feeBuckets.length ? (
            <ChartPlate name="delegation-fees">
              <FeeChart data={feeBuckets} />
            </ChartPlate>
          ) : (
            <ChartEmpty failed={failed} />
          )}
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Red bars: own stake sitting at each fee (left axis) — where the capital actually lives.
            Dashed line: validator count at that fee (right axis). The cut is what delegating there
            costs.
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <SiblingDoor href={`${base}/total-stake`} label="Total Stake" sub="The capital being distributed" />
          <SiblingDoor href={`${base}/apy`} label="Reward Rate" sub="The estimated rate behind each slice" />
        </div>
      </div>
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* entry                                                             */
/* ---------------------------------------------------------------- */

export function StakingMetricContent({
  base,
  network,
  metric,
}: {
  /** the staking tab's own path — the sheet's breadcrumb and siblings */
  base: string;
  network: string;
  metric: StakingMetricKey;
}) {
  switch (metric) {
    case "total-stake":
      return <TotalStakeSheet base={base} network={network} />;
    case "apy":
      return <ApySheet base={base} network={network} />;
    case "rewards":
      return <RewardsSheet base={base} network={network} />;
    case "expiry":
      return <ExpirySheet base={base} network={network} />;
    case "distribution":
      return <DistributionSheet base={base} network={network} />;
  }
}
