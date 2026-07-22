"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Board, SectionHeader, StatDash } from "@/components/explorer-v2/ui";
import {
  ChartEmpty,
  RANGE_LABEL,
  RangeToggle,
  Stat,
  TipPlate,
  type RangeDays,
} from "./bits";
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
   market: a headline strip, then trend boards on one shared clock. */

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

/* daily minted rewards as bars */
function RewardsBars({ data }: { data: { day: string; value: number }[] }) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="18%">
          <XAxis dataKey="day" hide />
          <YAxis hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ fill: "rgba(161,161,170,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as { day: string; value: number };
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{fmtDay(d.day)}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {fmtCompact(d.value)} AVAX minted
                  </p>
                </TipPlate>
              );
            }}
          />
          <Bar dataKey="value" fill={QUIET_BAR} minPointSize={1} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ConcentrationPoint {
  rank: number;
  /** AVAX */
  weight: number;
  cumulativePct: number;
}

/* how evenly the stake spreads across the set */
function ConcentrationChart({ data }: { data: ConcentrationPoint[] }) {
  return (
    <div className="h-40 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <XAxis dataKey="rank" hide />
          <YAxis hide domain={[0, 100]} />
          <RechartsTooltip
            cursor={{ stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as ConcentrationPoint;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">top {d.rank} validators</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.cumulativePct.toFixed(1)}% of all stake
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    #{d.rank} weighs {fmtCompact(d.weight)} AVAX
                  </p>
                </TipPlate>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="cumulativePct"
            stroke="currentColor"
            strokeWidth={2}
            fill="currentColor"
            fillOpacity={0.08}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

interface FeeBucket {
  label: string;
  count: number;
  /** AVAX */
  weight: number;
}

function FeeBars({ data }: { data: FeeBucket[] }) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="18%">
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "#a1a1aa", fontFamily: "monospace" }}
          />
          <YAxis hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ fill: "rgba(161,161,170,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as FeeBucket;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.label} delegation fee</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.count.toLocaleString()} validators
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    {fmtCompact(d.weight)} AVAX own stake
                  </p>
                </TipPlate>
              );
            }}
          />
          <Bar dataKey="count" fill={QUIET_BAR} minPointSize={1} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
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

export function PrimaryStakingContent({ validatorsHref }: { validatorsHref: string }) {
  const { data: metrics, failed: metricsFailed } = usePrimaryMetrics();
  const { data: apy, failed: apyFailed } = useStakingApy();
  const { data: sdkValidators, failed: sdkFailed } = useSdkValidators();

  const [range, setRange] = useState<RangeDays>(365);
  const rangeLabel = RANGE_LABEL[range];

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

  const dailyRewardSeries = useMemo(
    () => thin(windowSeries(toSeries(metrics?.daily_rewards), range), 180),
    [metrics, range],
  );

  const cumulativeRewardSeries = useMemo(
    () => thin(windowSeries(toSeries(metrics?.cumulative_rewards), range)),
    [metrics, range],
  );

  /* -------------------------------------------------------------- */
  /* the current set, sliced two ways                                */
  /* -------------------------------------------------------------- */

  const concentration = useMemo<ConcentrationPoint[]>(() => {
    if (!sdkValidators?.length) return [];
    const weights = sdkValidators
      .map((v) => ((num(v.amountStaked) ?? 0) + (num(v.amountDelegated) ?? 0)) / NANO)
      .sort((a, b) => b - a);
    const total = weights.reduce((s, w) => s + w, 0);
    if (total <= 0) return [];
    let cumulative = 0;
    return weights.map((weight, i) => {
      cumulative += weight;
      return { rank: i + 1, weight, cumulativePct: (cumulative / total) * 100 };
    });
  }, [sdkValidators]);

  // the smallest club of validators that already controls half the stake
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
      {/* the capital securing the network, right now */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Primary Network Staking"
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
        <Board divide={false}>
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
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
            <Stat label="Staking APY · Est" sub="varies with duration and delegation fees">
              {apy?.current ? (
                <>
                  {apy.current.minAPY.toFixed(1)}–{apy.current.maxAPY.toFixed(1)}
                  <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
                </>
              ) : (
                <StatDash />
              )}
            </Stat>
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
              label="Rewards · All Time"
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
      <section className="flex flex-col gap-4">
        <SectionHeader
          label={`Total Stake · ${rangeLabel}`}
          action={
            <span className="flex items-center gap-4">
              <span className="hidden sm:block">
                <StakeKey />
              </span>
              <RangeToggle value={range} onChange={setRange} />
            </span>
          }
        />
        <Board divide={false} className="px-5 py-5 md:px-6">
          {stakeSeries.length ? (
            <TotalStakeChart data={stakeSeries} />
          ) : (
            <ChartEmpty failed={metricsFailed} />
          )}
        </Board>
      </section>

      {/* who delegates, and what staking pays */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <SectionHeader label={`Delegators · ${rangeLabel}`} />
          <Board divide={false} className="px-5 py-5 md:px-6">
            {delegatorSeries.length ? (
              <AreaTrend
                data={delegatorSeries}
                format={(v) => Math.round(v).toLocaleString("en-US")}
                unit="delegators"
              />
            ) : (
              <ChartEmpty failed={metricsFailed} />
            )}
          </Board>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader
            label={`Staking APY · ${rangeLabel}`}
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
          />
          <Board divide={false} className="px-5 py-5 md:px-6">
            {apySeries.length ? <ApyChart data={apySeries} /> : <ChartEmpty failed={apyFailed} />}
          </Board>
        </section>
      </div>

      {/* what securing the network mints */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <SectionHeader label={`Daily Rewards · ${rangeLabel}`} />
          <Board divide={false} className="px-5 py-5 md:px-6">
            {dailyRewardSeries.length ? (
              <RewardsBars data={dailyRewardSeries} />
            ) : (
              <ChartEmpty failed={metricsFailed} />
            )}
          </Board>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader label={`Cumulative Rewards · ${rangeLabel}`} />
          <Board divide={false} className="px-5 py-5 md:px-6">
            {cumulativeRewardSeries.length ? (
              <AreaTrend data={cumulativeRewardSeries} format={fmtCompact} unit="AVAX" />
            ) : (
              <ChartEmpty failed={metricsFailed} />
            )}
          </Board>
        </section>
      </div>

      {/* how the stake spreads across the current set */}
      <section className="flex flex-col gap-4">
        <SectionHeader label="Stake Distribution · Current Set" />
        <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <SectionHeader
              label="Concentration"
              action={
                halfClub !== null ? (
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    {halfClub} validators hold half the stake
                  </span>
                ) : undefined
              }
            />
            <Board divide={false} className="px-5 py-5 md:px-6">
              {concentration.length ? (
                <ConcentrationChart data={thin(concentration, 240)} />
              ) : (
                <ChartEmpty failed={sdkFailed} />
              )}
            </Board>
            <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              Cumulative share of total stake (own + delegated) by validator rank. The flatter the
              curve, the more evenly the network&apos;s security is spread.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <SectionHeader
              label="Delegation Fees"
              action={
                medianFee !== null ? (
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    median {medianFee.toFixed(0)}%
                  </span>
                ) : undefined
              }
            />
            <Board divide={false} className="px-5 py-5 md:px-6">
              {feeBuckets.length ? <FeeBars data={feeBuckets} /> : <ChartEmpty failed={sdkFailed} />}
            </Board>
            <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              The cut each validator takes from its delegators&apos; rewards. Where the bars pile up
              is what delegating actually costs.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
