"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  Area,
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { Board, BoardHeader, ChartBoard, StatCell, StatDash } from "@/components/explorer-v2/ui";
import { ChartEmpty, Stat, TipPlate } from "./bits";
import { RANGE_DAYS, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import {
  NANO,
  fmtCompact,
  num,
  thin,
  toSeries,
  usePrimaryMetrics,
  useSdkValidators,
  useStakingApy,
  windowSeries,
} from "./data";

/* The Primary Network's staking economy as one instrument — what secures
   the network and what securing it pays. Split out of the old validators
   observatory: the set itself (nodes, uptime, versions) lives on the
   Validators tab; this page is the capital. Same grammar as the gas
   market: lead with the answer (a dark statement panel — what staking
   pays right now), then the capital strip, then outlined ChartBoards on
   one shared clock. */

const OWN_COLOR = "currentColor";
const DELEGATED_COLOR = "#E6212F";
const QUIET_BAR = "#A2AFB2";

interface StakePoint {
  day: string;
  /** AVAX */
  own: number;
  /** AVAX */
  delegated: number;
}

function fmtDay(day: string): string {
  return day;
}

/* stacked own + delegated stake, the page's centerpiece */
function TotalStakeChart({ data }: { data: StakePoint[] }) {
  return (
    <div className="h-56 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <XAxis dataKey="day" hide />
          <YAxis hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as StakePoint;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{fmtDay(d.day)}</p>
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
          <Area
            type="monotone"
            dataKey="own"
            stackId="stake"
            stroke={OWN_COLOR}
            strokeWidth={1.5}
            fill={OWN_COLOR}
            fillOpacity={0.1}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="delegated"
            stackId="stake"
            stroke={DELEGATED_COLOR}
            strokeWidth={1.5}
            fill={DELEGATED_COLOR}
            fillOpacity={0.12}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* one-series area — delegator count, cumulative rewards */
function AreaTrend({
  data,
  format,
  unit,
}: {
  data: { day: string; value: number }[];
  format: (v: number) => string;
  unit: string;
}) {
  return (
    <div className="h-40 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <XAxis dataKey="day" hide />
          <YAxis hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as { day: string; value: number };
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{fmtDay(d.day)}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {format(d.value)} {unit}
                  </p>
                </TipPlate>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="currentColor"
            strokeWidth={1.5}
            fill="currentColor"
            fillOpacity={0.1}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ApyPoint {
  day: string;
  maxAPY: number;
  minAPY: number;
}

/* validator (max) and delegator (min) yield curves */
function ApyChart({ data }: { data: ApyPoint[] }) {
  return (
    <div className="h-40 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <XAxis dataKey="day" hide />
          <YAxis hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as ApyPoint;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{fmtDay(d.day)}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.maxAPY.toFixed(2)}% max
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    min {d.minAPY.toFixed(2)}%
                  </p>
                </TipPlate>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="maxAPY"
            stroke="currentColor"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="minAPY"
            stroke={QUIET_BAR}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

interface RewardPoint {
  day: string;
  value: number;
  /** 30-day moving average */
  ma: number;
}

/* daily minted rewards as bars, the 30-day average riding over them */
function RewardsBars({ data }: { data: RewardPoint[] }) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <XAxis dataKey="day" hide />
          <YAxis hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ fill: "rgba(161,161,170,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as RewardPoint;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{fmtDay(d.day)}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {fmtCompact(d.value)} AVAX minted
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    30d average {fmtCompact(d.ma)}
                  </p>
                </TipPlate>
              );
            }}
          />
          <Bar dataKey="value" fill={QUIET_BAR} minPointSize={1} isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="ma"
            stroke={DELEGATED_COLOR}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface ConcentrationPoint {
  rank: number;
  /** AVAX */
  weight: number;
  cumulativePct: number;
}

const AXIS_TICK = { fontSize: 10, fill: "#a1a1aa", fontFamily: "monospace" } as const;

/* how evenly the stake spreads across the set — per-rank bars against the
   right axis, the cumulative share climbing the left one; the two shapes
   read together (steep bars + fast climb = concentrated) */
export function ConcentrationChart({ data, setSize }: { data: ConcentrationPoint[]; setSize: number }) {
  const rankTicks = [];
  for (let r = 100; r < setSize; r += 100) rankTicks.push(r);
  return (
    <div className="h-56 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="rank"
            type="number"
            domain={[1, setSize]}
            ticks={rankTicks}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
          />
          <YAxis
            yAxisId="pct"
            domain={[0, 100]}
            ticks={[25, 50, 75, 100]}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => `${v}%`}
            width={42}
          />
          <YAxis
            yAxisId="weight"
            orientation="right"
            domain={[0, "dataMax"]}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => fmtCompact(v)}
            width={48}
          />
          <RechartsTooltip
            cursor={{ stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as ConcentrationPoint;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">rank #{d.rank}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {fmtCompact(d.weight)} AVAX
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    top {d.rank} together hold {d.cumulativePct.toFixed(1)}%
                  </p>
                </TipPlate>
              );
            }}
          />
          <Bar
            yAxisId="weight"
            dataKey="weight"
            fill={QUIET_BAR}
            fillOpacity={0.75}
            minPointSize={1}
            isAnimationActive={false}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="cumulativePct"
            stroke={DELEGATED_COLOR}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface FeeBucket {
  label: string;
  count: number;
  /** AVAX */
  weight: number;
}

/* what delegating costs — stake-weighted bars (where the capital sits)
   with the validator count riding the right axis (where the nodes sit) */
export function FeeChart({ data }: { data: FeeBucket[] }) {
  return (
    <div className="h-56 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} />
          <YAxis
            yAxisId="weight"
            domain={[0, "dataMax"]}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => fmtCompact(v)}
            width={48}
          />
          <YAxis
            yAxisId="count"
            orientation="right"
            domain={[0, "dataMax"]}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            width={40}
          />
          <RechartsTooltip
            cursor={{ fill: "rgba(161,161,170,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as FeeBucket;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.label} delegation fee</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {fmtCompact(d.weight)} AVAX own stake
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    {d.count.toLocaleString()} validator{d.count === 1 ? "" : "s"}
                  </p>
                </TipPlate>
              );
            }}
          />
          <Bar
            yAxisId="weight"
            dataKey="weight"
            fill={DELEGATED_COLOR}
            fillOpacity={0.8}
            minPointSize={1}
            isAnimationActive={false}
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="count"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={{ r: 2, strokeWidth: 0, fill: "currentColor" }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export type Lens = "weight" | "own" | "delegated";

export const LENS_LABEL: Record<Lens, string> = {
  weight: "Weight",
  own: "Own stake",
  delegated: "Delegated",
};

/* the three old distribution charts folded into one instrument — same
   segmented-control idiom as the range toggle */
export function LensToggle({ value, onChange }: { value: Lens; onChange: (v: Lens) => void }) {
  return (
    <div className="inline-flex shrink-0 border border-zinc-200 dark:border-zinc-800">
      {(Object.keys(LENS_LABEL) as Lens[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={cn(
            "px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
            l === value
              ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
          )}
        >
          {LENS_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

/* a cell inside the dark statement panel — steel label, ink-white figure,
   muted sub. The homepage pillar voice, same as the gas page's lead panel. */
function StatementCell({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-5 md:px-6 lg:first:pl-0">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#A2AFB2]">
        {label}
      </span>
      <span className="min-w-0 truncate font-mono text-xl tabular-nums tracking-tight text-[#EBF0FA] sm:text-2xl md:text-[1.75rem]">
        {children}
      </span>
      {sub != null && <span className="text-xs tabular-nums text-[#A2AFB2]">{sub}</span>}
    </div>
  );
}

/* legend chips for the stacked stake chart */
function StakeKey() {
  return (
    <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 bg-zinc-900/15 dark:bg-zinc-100/15" /> own stake
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 bg-[#E6212F]/25" /> delegated
      </span>
    </span>
  );
}

export function PrimaryStakingContent({
  validatorsHref,
  base,
}: {
  validatorsHref: string;
  /** the staking tab's own path — every ChartBoard doors into its metric
   *  sheet under it (base/total-stake, base/apy, …) */
  base?: string;
}) {
  const door = (metric: string) => (base ? `${base}/${metric}` : undefined);
  const { data: metrics, failed: metricsFailed } = usePrimaryMetrics();
  const { data: apy, failed: apyFailed } = useStakingApy();
  const { data: sdkValidators, failed: sdkFailed } = useSdkValidators();

  // the page clock in the subnav — one window for every trend below. The
  // subnav states the window once, so chart titles drop the range suffix.
  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];

  /* -------------------------------------------------------------- */
  /* headline figures                                                */
  /* -------------------------------------------------------------- */

  const ownStake = num(metrics?.validator_weight?.current_value);
  const delegatedStake = num(metrics?.delegator_weight?.current_value);
  const totalStaked =
    ownStake !== null && delegatedStake !== null ? (ownStake + delegatedStake) / NANO : null;
  const delegators = num(metrics?.delegator_count?.current_value);
  const cumulativeRewards = num(metrics?.cumulative_rewards?.current_value);
  // today's row is partial — the last full day is the honest daily figure
  const dailyRewards = useMemo(() => {
    const series = toSeries(metrics?.daily_rewards);
    return series.length ? series[series.length - 1].value : null;
  }, [metrics]);

  /* -------------------------------------------------------------- */
  /* trend series, all on the page's one clock                       */
  /* -------------------------------------------------------------- */

  const stakeSeries = useMemo<StakePoint[]>(() => {
    const own = toSeries(metrics?.validator_weight);
    const delegated = new Map(toSeries(metrics?.delegator_weight).map((p) => [p.day, p.value]));
    const joined = own.map((p) => ({
      day: p.day,
      own: p.value / NANO,
      delegated: (delegated.get(p.day) ?? 0) / NANO,
    }));
    return thin(windowSeries(joined, range));
  }, [metrics, range]);

  const delegatorSeries = useMemo(
    () => thin(windowSeries(toSeries(metrics?.delegator_count), range)),
    [metrics, range],
  );

  const apySeries = useMemo<ApyPoint[]>(() => {
    if (!apy?.data) return [];
    const sorted = [...apy.data]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((p) => ({ day: p.date, maxAPY: p.maxAPY, minAPY: p.minAPY }));
    return thin(windowSeries(sorted, range));
  }, [apy, range]);

  const dailyRewardSeries = useMemo<RewardPoint[]>(() => {
    // the moving average runs over the FULL series so the window's left
    // edge doesn't start artificially low, then the window slices
    const full = toSeries(metrics?.daily_rewards);
    let rolling = 0;
    const withMa = full.map((p, i) => {
      rolling += p.value;
      if (i >= 30) rolling -= full[i - 30].value;
      return { ...p, ma: rolling / Math.min(i + 1, 30) };
    });
    return thin(windowSeries(withMa, range), 180);
  }, [metrics, range]);

  const cumulativeRewardSeries = useMemo(
    () => thin(windowSeries(toSeries(metrics?.cumulative_rewards), range)),
    [metrics, range],
  );

  /* -------------------------------------------------------------- */
  /* the current set, sliced two ways                                */
  /* -------------------------------------------------------------- */

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

  // the smallest club of validators that already controls half of the lens
  const halfClub = useMemo(() => {
    const hit = concentration.find((p) => p.cumulativePct >= 50);
    return hit?.rank ?? null;
  }, [concentration]);

  const feeBuckets = useMemo<FeeBucket[]>(() => {
    if (!sdkValidators?.length) return [];
    const buckets = new Map<number, { count: number; weight: number }>();
    for (const v of sdkValidators) {
      const fee = Math.round(num(v.delegationFee) ?? 0);
      // the long tail above 15% is a rounding drawer, not fifteen bars
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

  return (
    <div className="flex flex-col gap-10">
      {/* the answer first: what securing the network pays, in the homepage
          pillar panels' voice (#1F1F1F board, EBF0FA lead over the E6212F
          punch, steel spec labels) */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-8 bg-[#1F1F1F] p-6 md:p-8">
          <h3 className="v2-display text-3xl leading-[1.02] md:text-4xl">
            <span className="block text-[#EBF0FA]">What securing the network</span>
            <span className="block text-[#E6212F]">pays right now.</span>
          </h3>
          <div className="grid grid-cols-2 divide-x divide-y divide-white/10 border-t border-white/10 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0">
            <StatementCell label="Max APY · Est">
              {apy?.current ? (
                <>
                  {apy.current.maxAPY.toFixed(1)}
                  <span className="ml-1 text-sm text-[#A2AFB2]">%</span>
                </>
              ) : (
                "—"
              )}
            </StatementCell>
            <StatementCell label="Min APY · Est">
              {apy?.current ? (
                <>
                  {apy.current.minAPY.toFixed(1)}
                  <span className="ml-1 text-sm text-[#A2AFB2]">%</span>
                </>
              ) : (
                "—"
              )}
            </StatementCell>
            <StatementCell label="Median Delegation Fee" sub="across the current set">
              {medianFee !== null ? (
                <>
                  {medianFee.toFixed(0)}
                  <span className="ml-1 text-sm text-[#A2AFB2]">%</span>
                </>
              ) : (
                "—"
              )}
            </StatementCell>
            <StatementCell label="Minted Per Day" sub="last full day">
              {dailyRewards !== null ? (
                <>
                  {fmtCompact(dailyRewards)}
                  <span className="ml-1.5 text-sm text-[#A2AFB2]">AVAX</span>
                </>
              ) : (
                "—"
              )}
            </StatementCell>
          </div>
        </div>
        <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Estimated annual yield at current conditions; the exact rate varies with stake duration
          and the validator&apos;s delegation fee. Rewards are newly minted AVAX.
        </p>
      </section>

      {/* the capital securing the network — the lead board */}
      <section className="flex flex-col gap-4">
        <Board divide={false} className="border">
          <BoardHeader
            label="Primary Network Staking"
            display
            action={
              <Link
                href={validatorsHref}
                className="group flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
              >
                The validator set
                <ArrowRight className="h-3 w-3 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F]" />
              </Link>
            }
          />
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
            <Stat
              label="Total Staked"
              sub={
                ownStake !== null && delegatedStake !== null
                  ? `own ${fmtCompact(ownStake / NANO)} · delegated ${fmtCompact(delegatedStake / NANO)}`
                  : undefined
              }
            >
              {totalStaked !== null ? (
                <>
                  {fmtCompact(totalStaked)}
                  <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">AVAX</span>
                </>
              ) : (
                <StatDash />
              )}
            </Stat>
            {/* the count is a door into the set itself */}
            <StatCell label="Validators" href={validatorsHref} sub="current set">
              <span className="min-w-0 truncate font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
                {sdkValidators?.length ? sdkValidators.length.toLocaleString("en-US") : <StatDash />}
              </span>
            </StatCell>
            <Stat
              label="Delegators"
              sub={
                delegators !== null && delegatedStake !== null && delegators > 0
                  ? `≈ ${fmtCompact(delegatedStake / NANO / delegators)} AVAX each`
                  : undefined
              }
            >
              {delegators !== null ? delegators.toLocaleString("en-US") : <StatDash />}
            </Stat>
            <Stat
              label="Rewards · All-Time"
              sub={dailyRewards !== null ? `≈ ${fmtCompact(dailyRewards)} AVAX/day` : undefined}
            >
              {cumulativeRewards !== null ? (
                <>
                  {fmtCompact(cumulativeRewards)}
                  <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">AVAX</span>
                </>
              ) : (
                <StatDash />
              )}
            </Stat>
          </div>
        </Board>
      </section>

      {/* the centerpiece: how the stake got here */}
      <ChartBoard
        label="Total Stake"
        href={door("total-stake")}
        action={
          <span className="hidden sm:block">
            <StakeKey />
          </span>
        }
      >
        {stakeSeries.length ? (
          <TotalStakeChart data={stakeSeries} />
        ) : (
          <ChartEmpty failed={metricsFailed} />
        )}
      </ChartBoard>

      {/* who delegates, and what staking pays */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard label="Delegators" href={door("total-stake")}>
          {delegatorSeries.length ? (
            <AreaTrend
              data={delegatorSeries}
              format={(v) => Math.round(v).toLocaleString("en-US")}
              unit="delegators"
            />
          ) : (
            <ChartEmpty failed={metricsFailed} />
          )}
        </ChartBoard>

        <ChartBoard
          label="Staking APY"
          href={door("apy")}
          action={
            <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-zinc-900 dark:bg-zinc-100" /> max
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-b border-dashed border-[#A2AFB2]" /> min
              </span>
            </span>
          }
        >
          {apySeries.length ? <ApyChart data={apySeries} /> : <ChartEmpty failed={apyFailed} />}
        </ChartBoard>
      </div>

      {/* what securing the network mints */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard
          label="Daily Rewards"
          href={door("rewards")}
          action={
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
              <span className="h-0.5 w-4 bg-[#E6212F]" /> 30d avg
            </span>
          }
        >
          {dailyRewardSeries.length ? (
            <RewardsBars data={dailyRewardSeries} />
          ) : (
            <ChartEmpty failed={metricsFailed} />
          )}
        </ChartBoard>

        <ChartBoard label="Cumulative Rewards" href={door("rewards")}>
          {cumulativeRewardSeries.length ? (
            <AreaTrend data={cumulativeRewardSeries} format={fmtCompact} unit="AVAX" />
          ) : (
            <ChartEmpty failed={metricsFailed} />
          )}
        </ChartBoard>
      </div>

      {/* how the stake spreads across the current set — two snapshots of the
          live set, each with its reading below (· current set is the honest
          qualifier: these don't follow the page clock) */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {/* no door here: the lens toggle in the title bar is interactive,
              and a card-wide Link would swallow its clicks — the fees card
              and the sheet siblings carry the way in */}
          <ChartBoard
            label="Concentration by Rank · current set"
            action={<LensToggle value={lens} onChange={setLens} />}
          >
            {concentration.length ? (
              <ConcentrationChart data={thin(concentration, 300)} setSize={concentration.length} />
            ) : (
              <ChartEmpty failed={sdkFailed} />
            )}
          </ChartBoard>
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Bars: each validator&apos;s {LENS_LABEL[lens].toLowerCase()} by rank (right axis). Red
            line: the cumulative share the top N hold (left axis)
            {halfClub !== null && <> — the top {halfClub} together control half of it</>}. The
            flatter the climb, the more evenly the network&apos;s security is spread.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <ChartBoard
            label="Delegation Fees · current set"
            href={door("distribution")}
            action={
              medianFee !== null ? (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  median {medianFee.toFixed(0)}%
                </span>
              ) : undefined
            }
          >
            {feeBuckets.length ? <FeeChart data={feeBuckets} /> : <ChartEmpty failed={sdkFailed} />}
          </ChartBoard>
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Red bars: own stake sitting at each fee (left axis) — where the capital actually lives.
            Dashed line: validator count at that fee (right axis). The cut is what delegating there
            costs.
          </p>
        </div>
      </div>
    </div>
  );
}
