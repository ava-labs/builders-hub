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
import { Board, BoardHeader, ChartBoard, DarkToggle, StatCell, StatDash } from "@/components/explorer-v2/ui";
import { useTokenUsd } from "@/components/explorer/GasMarketPage";
import { ChartEmpty, Stat, TipPlate } from "./bits";
import { RANGE_DAYS, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
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
                    {d.maxAPY.toFixed(2)}% · 1-year term
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    2-week {d.minAPY.toFixed(2)}%
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

/* staked share of the circulating supply — the auto domain magnifies the
   drift, which IS the signal here; the tooltip carries the absolutes */
function RatioChart({ data }: { data: RatioPoint[] }) {
  return (
    <div className="h-40 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <XAxis dataKey="day" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <RechartsTooltip
            cursor={{ stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as RatioPoint;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{fmtDay(d.day)}</p>
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
          <Area
            type="monotone"
            dataKey="pct"
            stroke={DELEGATED_COLOR}
            strokeWidth={1.5}
            fill={DELEGATED_COLOR}
            fillOpacity={0.08}
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

interface FlowDay {
  date: string;
  avax: number;
  count: number;
}

/* one day-bar shape for both money-flow cards — payouts landed (red, stake
   moving) and stake reaching term (block gray, value at rest) */
function MoneyBars({ data, color, noun }: { data: FlowDay[]; color: string; noun: string }) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ fill: "rgba(161,161,170,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as FlowDay;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{fmtDay(d.date)}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {fmtCompact(d.avax)} AVAX
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    {d.count.toLocaleString("en-US")} {noun}
                  </p>
                </TipPlate>
              );
            }}
          />
          <Bar dataKey="avax" fill={color} minPointSize={1} isAnimationActive={false} />
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

/* ------------------------------------------------------------------ */
/* The yield calculator — ONE hero rate instead of a strip of cells,
   and the inputs that make it yours: amount, duration, role. Mirrors
   /api/staking-apy's official formula exactly (same constants):
     reward = amount × (720M − supply)/supply × ECR(d) × d/365
     ECR(d) = 10% → 12%, linear in duration
   Delegators additionally hand the validator its fee cut.             */

const MAX_SUPPLY = 720_000_000; // AVAX supply cap — the emission source
const MIN_CONSUMPTION = 0.1;
const MAX_CONSUMPTION = 0.12;

const DURATIONS = [
  { key: "2w", label: "2W", days: 14 },
  { key: "1m", label: "1M", days: 30 },
  { key: "3m", label: "3M", days: 91 },
  { key: "6m", label: "6M", days: 182 },
  { key: "1y", label: "1Y", days: 365 },
] as const;

function effectiveConsumptionRate(days: number): number {
  const t = Math.min(1, Math.max(0, days / 365));
  return MIN_CONSUMPTION * (1 - t) + MAX_CONSUMPTION * t;
}

function YieldCalculator({
  supply,
  medianFee,
}: {
  /** circulating AVAX, the emission formula's denominator */
  supply: number | null;
  /** the current set's median delegation fee, % */
  medianFee: number | null;
}) {
  const [amountRaw, setAmountRaw] = useState("1,000");
  const [durationKey, setDurationKey] = useState<(typeof DURATIONS)[number]["key"]>("1y");
  const [role, setRole] = useState<"delegating" | "validating">("delegating");

  const amount = Number(amountRaw.replace(/[^0-9.]/g, "")) || 0;
  const days = DURATIONS.find((d) => d.key === durationKey)!.days;
  const fee = medianFee ?? 2; // protocol floor if the set hasn't loaded

  // the official emission math, then the delegator's haircut
  const calc = useMemo(() => {
    if (supply === null || supply <= 0 || supply >= MAX_SUPPLY) return null;
    const gross = ((MAX_SUPPLY - supply) / supply) * effectiveConsumptionRate(days);
    const net = role === "delegating" ? gross * (1 - fee / 100) : gross;
    return {
      annualPct: net * 100,
      reward: amount * net * (days / 365),
    };
  }, [supply, days, role, fee, amount]);

  return (
    <div className="flex flex-col gap-8 bg-[#1F1F1F] p-6 md:p-8">
      {/* headline left, the ONE number right — big enough to read from
          across the room. "Minting" is the factual verb: the protocol
          mints rewards on a public schedule; nothing here promises them
          to anyone. */}
      <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-8">
        <h3 className="v2-display text-3xl leading-[1.02] md:text-4xl">
          <span className="block text-[#EBF0FA]">What securing the network</span>
          <span className="block text-[#E6212F]">is minting right now.</span>
        </h3>
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#A2AFB2]">
            {role} · {DURATIONS.find((d) => d.key === durationKey)!.label} · est. rate
          </span>
          <span className="font-mono text-6xl tabular-nums tracking-tight text-[#EBF0FA] md:text-7xl">
            {calc ? calc.annualPct.toFixed(1) : "—"}
            <span className="ml-1 text-2xl text-[#A2AFB2]">%</span>
            <span className="ml-2 text-lg text-[#A2AFB2]">/ yr</span>
          </span>
        </div>
      </div>

      {/* the calculator: make the rate yours — inputs left, the estimate
          answering on the same rule */}
      <div className="flex flex-col gap-3 border-t border-white/10 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <label className="flex items-center gap-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#A2AFB2]">
                Stake
              </span>
              <span className="flex items-baseline gap-2 border-b border-white/25 focus-within:border-[#E6212F]">
                <input
                  value={amountRaw}
                  onChange={(e) => setAmountRaw(e.target.value)}
                  onBlur={() =>
                    setAmountRaw(amount > 0 ? amount.toLocaleString("en-US") : "1,000")
                  }
                  inputMode="decimal"
                  aria-label="AVAX amount to stake"
                  className="w-32 bg-transparent py-1 text-right font-mono text-xl tabular-nums text-[#EBF0FA] outline-none placeholder:text-[#A2AFB2]/50"
                />
                <span className="pb-0.5 font-mono text-xs text-[#A2AFB2]">AVAX</span>
              </span>
            </label>
            <label className="flex items-center gap-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#A2AFB2]">
                For
              </span>
              <DarkToggle
                options={DURATIONS.map((d) => ({ value: d.key, label: d.label }))}
                value={durationKey}
                onChange={setDurationKey}
              />
            </label>
            <DarkToggle
              options={[
                { value: "delegating" as const, label: "Delegating" },
                { value: "validating" as const, label: "Validating" },
              ]}
              value={role}
              onChange={setRole}
            />
          </div>
          <p className="font-mono text-base text-[#A2AFB2]">
            est. rewards{" "}
            <span className="mx-1 align-baseline text-4xl font-bold tabular-nums text-[#E6212F] md:text-5xl">
              {calc && amount > 0 ? fmtCompact(calc.reward) : "—"}
            </span>{" "}
            <span className="text-[#EBF0FA]">AVAX</span>
          </p>
        </div>
        <p className="font-mono text-[11px] text-[#A2AFB2]/80">
          {role === "delegating"
            ? `after the current median ${fee.toFixed(0)}% validator fee · min 25 AVAX to delegate`
            : "running your own node · min 2,000 AVAX to validate"}
        </p>
      </div>
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
  network = "mainnet",
}: {
  validatorsHref: string;
  /** the staking tab's own path — every ChartBoard doors into its metric
   *  sheet under it (base/total-stake, base/apy, …) */
  base?: string;
  /** the staking feeds watch mainnet; both mounts guard the route already */
  network?: string;
}) {
  const door = (metric: string) => (base ? `${base}/${metric}` : undefined);
  const { data: metrics, failed: metricsFailed } = usePrimaryMetrics();
  const { data: apy, failed: apyFailed } = useStakingApy();
  const { data: sdkValidators } = useSdkValidators();
  // AVAX's USD price via the C-Chain's cached explorer feed — the staking
  // feeds are mainnet-only, so the mainnet chain id is a constant here
  const { usd: avaxUsd } = useTokenUsd(43114);

  // the page clock in the subnav — one window for every trend below. The
  // subnav states the window once, so chart titles drop the range suffix.
  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];
  // the trend charts floor at a week — a one-point day chart renders as
  // a lone dot (same rule as the sheets); labels state the exception
  const chartDays = Math.max(7, range);
  const weekFloor = range < 7 ? " · 7 days" : "";

  /* -------------------------------------------------------------- */
  /* headline figures                                                */
  /* -------------------------------------------------------------- */

  const ownStake = num(metrics?.validator_weight?.current_value);
  const delegatedStake = num(metrics?.delegator_weight?.current_value);
  const totalStaked =
    ownStake !== null && delegatedStake !== null ? (ownStake + delegatedStake) / NANO : null;
  const delegators = num(metrics?.delegator_count?.current_value);
  const cumulativeRewards = num(metrics?.cumulative_rewards?.current_value);
  // the APY feed carries the live circulating supply (AVAX units) and the
  // all-time burn — the ratio is THE number behind the reward rate
  const supplyAvax = num(apy?.current?.supply);
  const totalBurned = num(apy?.current?.totalBurned);
  const stakingRatio =
    totalStaked !== null && supplyAvax !== null && supplyAvax > 0
      ? (totalStaked / supplyAvax) * 100
      : null;
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
    return thin(windowSeries(joined, chartDays));
  }, [metrics, chartDays]);

  const delegatorSeries = useMemo(
    () => thin(windowSeries(toSeries(metrics?.delegator_count), chartDays)),
    [metrics, chartDays],
  );

  const apySeries = useMemo<ApyPoint[]>(() => {
    if (!apy?.data) return [];
    const sorted = [...apy.data]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((p) => ({ day: p.date, maxAPY: p.maxAPY, minAPY: p.minAPY }));
    return thin(windowSeries(sorted, chartDays));
  }, [apy, chartDays]);

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
    return thin(windowSeries(withMa, chartDays), 180);
  }, [metrics, chartDays]);

  // the share of all circulating AVAX that is working — the same join the
  // total-stake sheet charts in full
  const ratioSeries = useMemo<RatioPoint[]>(
    () => thin(windowSeries(joinStakingRatio(metrics, apy), chartDays)),
    [metrics, apy, chartDays],
  );

  /* -------------------------------------------------------------- */
  /* the money actually moving — accrual is smooth, cash is lumpy    */
  /* -------------------------------------------------------------- */

  const { flow, failed: flowFailed, days: flowDays } = useMoneyFlow(network, range);
  const rewardsPaid = useMemo<FlowDay[]>(
    () => (flow?.rewards ?? []).map((r) => ({ date: r.date, avax: r.avax, count: r.payouts })),
    [flow],
  );
  const unlocking = useMemo<FlowDay[]>(
    () => (flow?.unlocks ?? []).map((u) => ({ date: u.date, avax: u.avax, count: u.stakers })),
    [flow],
  );
  const paidSum = useMemo(() => rewardsPaid.reduce((s, d) => s + d.avax, 0), [rewardsPaid]);
  const unlockSum = useMemo(() => unlocking.reduce((s, d) => s + d.avax, 0), [unlocking]);

  /* -------------------------------------------------------------- */
  /* the current set, sliced two ways                                */
  /* -------------------------------------------------------------- */

  // the distribution board's headline readings — the full rank-by-rank
  // instrument (and its lens toggle) lives on the distribution sheet
  const setStats = useMemo(() => {
    if (!sdkValidators?.length) return null;
    const weights = sdkValidators
      .map((v) => ((num(v.amountStaked) ?? 0) + (num(v.amountDelegated) ?? 0)) / NANO)
      .sort((a, b) => b - a);
    const total = weights.reduce((s, w) => s + w, 0);
    if (total <= 0) return null;
    let cumulative = 0;
    let halfClub: number | null = null;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (cumulative >= total / 2) {
        halfClub = i + 1;
        break;
      }
    }
    return { halfClub, largestPct: (weights[0] / total) * 100, avgStake: total / weights.length };
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
      {/* the answer first — ONE number and the calculator that makes it
          yours, in the homepage pillar panels' voice (#1F1F1F board,
          EBF0FA lead over the E6212F punch, steel spec labels) */}
      <section className="flex flex-col gap-3">
        <YieldCalculator supply={supplyAvax} medianFee={medianFee} />
        <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Estimates only, computed from the protocol&apos;s public emission formula at current
          network conditions — not a promise of any return and not financial advice. Actual
          rewards change as the staking ratio moves, and are paid only if the validator maintains
          the uptime requirement through the whole term. Rewards are newly minted AVAX.
          Auto-renewed staking (
          <Link
            href="/docs/acps/236-auto-renewed-staking"
            className="text-[#0061E2] underline-offset-4 hover:underline dark:text-[#5f9dff]"
          >
            ACP-236
          </Link>
          ) is rolling out: positions will renew and compound automatically.
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
                totalStaked !== null
                  ? [
                      avaxUsd !== null ? `≈ $${fmtCompact(totalStaked * avaxUsd)}` : null,
                      stakingRatio !== null ? `${stakingRatio.toFixed(1)}% of supply` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
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
              <CellFigure>
                {sdkValidators?.length ? sdkValidators.length.toLocaleString("en-US") : <StatDash />}
              </CellFigure>
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
              sub={
                dailyRewards !== null
                  ? totalBurned !== null
                    ? `≈ ${fmtCompact(dailyRewards)}/day · ${fmtCompact(totalBurned)} burned all-time`
                    : `≈ ${fmtCompact(dailyRewards)} AVAX/day`
                  : undefined
              }
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
        label={`Total Stake${weekFloor}`}
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

      {/* the capital's quality: how much of the supply is working, and
          what working pays */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard
          label={`Staking Ratio${weekFloor}`}
          href={door("total-stake")}
          action={
            stakingRatio !== null ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {stakingRatio.toFixed(1)}% today
              </span>
            ) : undefined
          }
        >
          {ratioSeries.length ? (
            <RatioChart data={ratioSeries} />
          ) : (
            <ChartEmpty failed={metricsFailed || apyFailed} />
          )}
        </ChartBoard>

        {/* max/min are DURATIONS (1-year vs 2-week terms), not a promise
            band — the legend says which is which */}
        <ChartBoard
          label={`Reward Rate · est${weekFloor}`}
          href={door("apy")}
          action={
            <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-zinc-900 dark:bg-zinc-100" /> 1-year term
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-b border-dashed border-[#A2AFB2]" /> 2-week
              </span>
            </span>
          }
        >
          {apySeries.length ? <ApyChart data={apySeries} /> : <ChartEmpty failed={apyFailed} />}
        </ChartBoard>
      </div>

      {/* what securing the network mints, and who shows up to earn it */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard
          label={`Daily Rewards${weekFloor}`}
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

        <ChartBoard label={`Delegators${weekFloor}`} href={door("total-stake")}>
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
      </div>

      {/* the cash view: accrual above is smooth, payouts and unlocks are
          lumpy — what actually landed in wallets behind us, what reaches
          term ahead. Past | future across one rule, like the P-Chain home,
          but on the page clock (the feed's computed windows) */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard
          label={`Rewards Paid · last ${flowDays} days`}
          href={door("rewards")}
          action={
            flow ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {fmtCompact(paidSum)} AVAX
              </span>
            ) : undefined
          }
        >
          {flow ? (
            <MoneyBars data={rewardsPaid} color={DELEGATED_COLOR} noun="payouts" />
          ) : (
            <ChartEmpty failed={flowFailed} />
          )}
        </ChartBoard>

        <ChartBoard
          label={`Stake Expiring · next ${flowDays} days`}
          href={door("expiry")}
          action={
            flow ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {fmtCompact(unlockSum)} AVAX
              </span>
            ) : undefined
          }
        >
          {flow ? (
            <MoneyBars data={unlocking} color={QUIET_BAR} noun="stake entries end" />
          ) : (
            <ChartEmpty failed={flowFailed} />
          )}
        </ChartBoard>
      </div>

      {/* how the stake spreads across the current set — the headline
          readings only; the rank-by-rank concentration and fee instruments
          live on the distribution sheet, one door away */}
      <section className="flex flex-col gap-3">
        <Board divide={false} className="border">
          <BoardHeader
            label="Stake Distribution"
            display
            action={
              door("distribution") ? (
                <Link
                  href={door("distribution")!}
                  className="group flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                >
                  Full breakdown
                  <ArrowRight className="h-3 w-3 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F]" />
                </Link>
              ) : undefined
            }
          />
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
            <StatCell
              label="Half the Stake"
              href={door("distribution")}
              sub="smallest club controlling 50%"
            >
              <CellFigure>
                {setStats?.halfClub != null ? `top ${setStats.halfClub}` : <StatDash />}
              </CellFigure>
            </StatCell>
            <StatCell label="Largest Validator" href={door("distribution")} sub="of total weight">
              <CellFigure>
                {setStats ? `${setStats.largestPct.toFixed(1)}%` : <StatDash />}
              </CellFigure>
            </StatCell>
            <StatCell
              label="Median Fee"
              href={door("distribution")}
              sub="the cut on delegation rewards"
            >
              <CellFigure>
                {medianFee !== null ? `${medianFee.toFixed(0)}%` : <StatDash />}
              </CellFigure>
            </StatCell>
            <StatCell
              label="Avg per Validator"
              href={door("distribution")}
              sub="mean weight across the set"
            >
              <CellFigure>
                {setStats ? (
                  <>
                    {fmtCompact(setStats.avgStake)}
                    <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">AVAX</span>
                  </>
                ) : (
                  <StatDash />
                )}
              </CellFigure>
            </StatCell>
          </div>
        </Board>
        <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          The current set, read for decentralization: the fewer validators it takes to reach half
          the stake, the more concentrated the network&apos;s security. The full rank-by-rank
          concentration curve and the delegation-fee market live in the breakdown.
        </p>
      </section>

      {/* the protocol's fixed terms — the orientation plate for anyone the
          numbers above just convinced */}
      <section className="flex flex-col gap-4">
        <Board divide={false} className="border">
          <BoardHeader
            label="Staking Parameters"
            action={
              <Link
                href="/docs/primary-network/validate/how-to-stake"
                className="group flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
              >
                How to stake
                <ArrowRight className="h-3 w-3 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F]" />
              </Link>
            }
          />
          {/* hairline mosaic: the gap paints the rules, so the grid can
              wrap 2 → 3 → 6 columns without divide-* bookkeeping */}
          <div className="grid grid-cols-2 gap-px bg-zinc-200 sm:grid-cols-3 lg:grid-cols-6 dark:bg-zinc-800">
            <ParamCell label="Min Validator Stake" value="2,000 AVAX" />
            <ParamCell label="Max Validator Weight" value="3M AVAX" sub="≤ 5× own stake" />
            <ParamCell label="Min Delegation" value="25 AVAX" />
            <ParamCell label="Staking Term" value="2 wk – 1 yr" />
            <ParamCell label="Uptime Required" value="≥ 80%" sub="or no reward" />
            <ParamCell label="Min Delegation Fee" value="2%" />
          </div>
        </Board>
      </section>
    </div>
  );
}

/* the stat strips' figure voice, for StatCell children (Stat styles its
   own; StatCell leaves the figure to the caller) */
function CellFigure({ children }: { children: React.ReactNode }) {
  return (
    <span className="min-w-0 truncate font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
      {children}
    </span>
  );
}

/* a quiet rules cell — smaller voice than the stat strips: these are
   constants, not readings */
function ParamCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-white px-4 py-3.5 dark:bg-zinc-950">
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      <span className="font-mono text-[13px] font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
        {value}
      </span>
      {sub && <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">{sub}</span>}
    </div>
  );
}
