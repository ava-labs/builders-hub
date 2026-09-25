"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { Board, ChartBoard, LoadMore, SectionHeader, HEAD, ROW, EmptyRow, RowSkeleton, idInk } from "@/components/explorer-v2/ui";
import { StatSlab } from "@/components/explorer-v2/StatSlab";
import { VersionFleet, fleetOf, type FleetGrain } from "./VersionFleet";
import {
  calculateVersionStats,
  compareVersions,
  type VersionBreakdownData,
  defaultVersionTarget,
} from "@/components/stats/VersionBreakdown";
import { PRIMARY_NETWORK_ID, useValidatorStats } from "@/components/explorer-v2/validator-stats";
import { ChartEmpty, TipPlate } from "./bits";
import {
  NANO,
  fmtCompact,
  num,
  thin,
  toSeries,
  usePrimaryMetrics,
  useP2pValidators,
  useSdkValidators,
  useTotalSeats,
  type P2pValidator,
  type SdkValidator,
} from "./data";

/* The Primary Network's validator set, list first — the roster the old
   observatory buried under five chart sections. The economics (stake
   trends, rewards, APY, distribution) moved to the Staking tab; what
   stays here is the machines: who validates, on what version, with what
   uptime, and for how much longer.

   Same stats grammar as the gas market — outlined ChartBoards, mono titles
   fused into the border, legends/toggles in the action slot — but
   deliberately OFF the page clock: this is a roster plus all-time context,
   not a windowed trend. So there is no range chip; each card states its own
   basis instead (· current set, · 14d, · all-time). */


const QUIET_BAR = "#A2AFB2";
const SEATS_COLOR = "#0061E2";
const ETNA_DAY = "2024-12-16";

interface MergedValidator extends SdkValidator {
  p2p?: P2pValidator;
}

/* p2p crawler reports "" (not null) for nodes it never completed a handshake.
   empty strings fall through; a true unknown remains undefined. */
function resolveVersion(p2p: P2pValidator | undefined, sdk: SdkValidator): string | undefined {
  return p2p?.version || sdk.version || undefined;
}

type SortKey = "version" | "stake" | "delegators" | "fee" | "uptime" | "daysLeft" | "missRate";

/* Release order, not lexical */
function versionRank(v?: string): number {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(v ?? "");
  if (!m) return -1;
  return Number(m[1]) * 1_000_000 + Number(m[2]) * 1_000 + Number(m[3]);
}

function sortValue(v: MergedValidator, key: SortKey): number {
  switch (key) {
    case "version":
      return versionRank(v.version);
    case "stake":
      return v.p2p?.total_stake ?? (num(v.amountStaked) ?? 0) + (num(v.amountDelegated) ?? 0);
    case "delegators":
      return v.delegatorCount ?? 0;
    case "fee":
      return num(v.delegationFee) ?? 0;
    case "uptime":
      return v.p2p?.p50_uptime ?? -1;
    case "daysLeft":
      return v.p2p?.days_left ?? Number.MAX_SAFE_INTEGER;
    case "missRate":
      return v.p2p?.miss_rate_14d ?? -1;
  }
}

function uptimeTone(pct: number): string {
  if (pct >= 99) return "text-zinc-700 dark:text-zinc-300";
  if (pct >= 90) return "text-amber-600 dark:text-amber-400";
  return "text-[#E6212F]";
}

function daysLeftTone(days: number): string {
  if (days < 7) return "font-medium text-[#E6212F]";
  if (days < 30) return "text-amber-600 dark:text-amber-400";
  return "text-zinc-700 dark:text-zinc-300";
}

function missRateTone(pct: number): string {
  if (pct === 0) return "text-zinc-700 dark:text-zinc-300";
  if (pct < 5) return "text-amber-600 dark:text-amber-400";
  return "text-[#E6212F]";
}

/* the health charts' buckets, shared by the charts and the roster filter */
const MISS_EDGES = [
  { label: "0%", min: 0, max: 0 },
  { label: "0–1%", min: 0.001, max: 1 },
  { label: "1–5%", min: 1, max: 5 },
  { label: "5–10%", min: 5, max: 10 },
  { label: "10–25%", min: 10, max: 25 },
  { label: "25–50%", min: 25, max: 50 },
  { label: "50%+", min: 50, max: Infinity },
];
const DAYS_EDGES = [
  { label: "< 7d", min: 0, max: 7 },
  { label: "7–30d", min: 7, max: 30 },
  { label: "30–90d", min: 30, max: 90 },
  { label: "90–180d", min: 90, max: 180 },
  { label: "180–365d", min: 180, max: 365 },
  { label: "365d+", min: 365, max: Infinity },
];
function missBucket(rate: number): string {
  if (rate === 0) return MISS_EDGES[0].label;
  return MISS_EDGES.slice(1).find((e) => rate > e.min && rate <= e.max)?.label ?? MISS_EDGES[MISS_EDGES.length - 1].label;
}
function daysBucket(days: number): string {
  return DAYS_EDGES.find((e) => days >= e.min && days < e.max)?.label ?? DAYS_EDGES[DAYS_EDGES.length - 1].label;
}
/** a node's minor line ("1.15"), the grain the version breakdown is cut at */
function minorOf(v?: string): string {
  const m = /(\d+)\.(\d+)/.exec(v ?? "");
  return m ? `${m[1]}.${m[2]}` : "Unknown";
}
/** a node's release ("1.15.1") */
function patchOf(v?: string): string {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(v ?? "");
  return m ? `${m[1]}.${m[2]}.${m[3]}` : minorOf(v);
}
/** the key a version pick matches on: a release pick has three parts */
function versionKey(v: string | undefined, pick: string): string {
  return pick.split(".").length === 3 ? patchOf(v) : minorOf(v);
}

/* what the roster is cut to: every figure and chart above it can set one
   part; the parts AND together, and each shows as a chip over the list */
interface Cut {
  version?: string;
  behind?: boolean;
  expiring?: boolean;
  miss?: string;
  days?: string;
  /** under the 80% uptime a validator needs to earn its reward */
  lowUptime?: boolean;
}

/* simple bucket bars shared by the two health charts */
function BucketBars({
  data,
  tint,
  picked,
  onPick,
}: {
  data: { label: string; count: number }[];
  /** per-bucket bar color; defaults to the quiet steel */
  tint?: (bucket: { label: string; count: number }, index: number) => string;
  /** the bucket the roster is cut to */
  picked?: string;
  onPick?: (label: string) => void;
}) {
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
              const d = payload[0].payload as { label: string; count: number };
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.label}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.count.toLocaleString()} validator{d.count === 1 ? "" : "s"}
                  </p>
                  {onPick && d.count > 0 && <p className="text-[10px] text-zinc-400">{picked === d.label ? "Click to show all" : "Click to list them"}</p>}
                </TipPlate>
              );
            }}
          />
          <Bar
            dataKey="count"
            minPointSize={1}
            isAnimationActive={false}
            radius={[2, 2, 0, 0]}
            className={onPick ? "cursor-pointer" : undefined}
            onClick={(d: { payload?: { label: string; count: number } }) => d.payload && d.payload.count > 0 && onPick?.(d.payload.label)}
          >
            {data.map((bucket, i) => (
              <Cell
                key={bucket.label}
                fill={tint ? tint(bucket, i) : QUIET_BAR}
                fillOpacity={picked && picked !== bucket.label ? 0.25 : 1}
                style={{ transition: "fill-opacity 250ms cubic-bezier(0.32,0.72,0,1)" }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface CountPoint {
  day: string;
  count: number;
  seats?: number;
}

/* validator count with the post-Etna total-seats overlay */
function CountChart({ data }: { data: CountPoint[] }) {
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
              const d = payload[0].payload as CountPoint;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.day}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {Math.round(d.count).toLocaleString()} Primary Network validators
                  </p>
                  {d.seats !== undefined && (
                    <p className="text-[10px] tabular-nums text-zinc-500">
                      {Math.round(d.seats).toLocaleString()} seats incl. L1s
                    </p>
                  )}
                </TipPlate>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="currentColor"
            strokeWidth={1.5}
            fill="currentColor"
            fillOpacity={0.1}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="seats"
            stroke={SEATS_COLOR}
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <ReferenceLine
            x={ETNA_DAY}
            stroke="#E6212F"
            strokeDasharray="4 3"
            label={{
              value: "ACP-77",
              position: "insideTopRight",
              fontSize: 10,
              fontFamily: "monospace",
              fill: "#E6212F",
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PrimaryValidatorsContent({ stakingHref, switched = false }: { stakingHref: string; switched?: boolean }) {
  const { data: metrics, failed: metricsFailed } = usePrimaryMetrics();
  const { data: sdkValidators, failed: sdkFailed } = useSdkValidators();
  const { data: p2p } = useP2pValidators();
  const { data: totalSeats } = useTotalSeats();
  const { subnets } = useValidatorStats("mainnet");

  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(50);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "stake", dir: -1 });
  const [minVersion, setMinVersion] = useState("");
  const [grain, setGrain] = useState<FleetGrain>("minor");

  /* ---------------------------------------------------------------- */
  /* versions — the Primary Network's slice of the shared stats feed   */
  /* ---------------------------------------------------------------- */

  const merged = useMemo<MergedValidator[]>(
    () =>
      (sdkValidators ?? []).map((v) => {
        const row = p2p?.get(v.nodeId);
        return { ...v, version: resolveVersion(row, v), p2p: row };
      }),
    [sdkValidators, p2p],
  );

  /* versions: counted from the roster itself once it loads, so the
     breakdown, the headline figures and the table's Version column read
     one source, and picking a version never lists zero rows. The shared
     stats feed (a different crawler) stands in until the roster arrives. */
  const versions = useMemo<VersionBreakdownData | null>(() => {
    if (merged.length > 0 && p2p) {
      const by: Record<string, { nodes: number; stake: number }> = {};
      let total = 0;
      for (const v of merged) {
        const k = grain === "patch" ? patchOf(v.version) : minorOf(v.version);
        const stake = v.p2p?.total_stake ?? (num(v.amountStaked) ?? 0) + (num(v.amountDelegated) ?? 0);
        by[k] = { nodes: (by[k]?.nodes ?? 0) + 1, stake: (by[k]?.stake ?? 0) + stake };
        total += stake;
      }
      return {
        byClientVersion: Object.fromEntries(
          Object.entries(by).map(([k, d]) => [k, { nodes: d.nodes, stakeString: BigInt(Math.round(d.stake)).toString() }]),
        ),
        totalStakeString: BigInt(Math.round(total)).toString(),
      } as VersionBreakdownData;
    }
    const primary = subnets?.find((s) => s.id === PRIMARY_NETWORK_ID);
    return primary?.byClientVersion
      ? { byClientVersion: primary.byClientVersion, totalStakeString: primary.totalStakeString }
      : null;
  }, [merged, p2p, subnets, grain]);

  const availableVersions = useMemo(
    () =>
      // targets stay minor lines whatever grain the breakdown is cut at
      versions
        ? [...new Set(Object.keys(versions.byClientVersion).filter((v) => v !== "Unknown").map((v) => minorOf(v)))].sort((a, b) =>
            compareVersions(b, a),
          )
        : [],
    [versions],
  );

  // default the target to the newest release with max adoption
  useEffect(() => {
    if (!minVersion && versions) {
      const target = defaultVersionTarget(versions.byClientVersion);
      if (target) setMinVersion(minorOf(target));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableVersions]);

  const versionStats =
    versions && minVersion ? calculateVersionStats(versions, minVersion) : null;
  const totalNodes = versions
    ? Object.values(versions.byClientVersion).reduce((sum, v) => sum + v.nodes, 0)
    : 0;

  /* ---------------------------------------------------------------- */
  /* the roster                                                        */
  /* ---------------------------------------------------------------- */

  const q = query.trim().toLowerCase();
  const [cut, setCut] = useState<Cut>({});
  const rosterRef = useRef<HTMLElement>(null);
  const cutting = Object.values(cut).some(Boolean);
  const rows = useMemo(() => {
    const filtered = merged.filter((v) => {
      if (q && !v.nodeId.toLowerCase().includes(q) && !(v.version ?? "").toLowerCase().includes(q)) return false;
      if (cut.version && versionKey(v.version, cut.version) !== cut.version) return false;
      if (cut.behind && (minorOf(v.version) === "Unknown" || compareVersions(minorOf(v.version), minVersion) >= 0)) return false;
      if (cut.expiring && !(v.p2p && v.p2p.days_left < 30)) return false;
      if (cut.lowUptime && !(v.p2p && v.p2p.p50_uptime < 80)) return false;
      if (cut.miss && !(v.p2p && missBucket(v.p2p.miss_rate_14d) === cut.miss)) return false;
      if (cut.days && !(v.p2p && daysBucket(v.p2p.days_left) === cut.days)) return false;
      return true;
    });
    return filtered.sort((a, b) => (sortValue(a, sort.key) - sortValue(b, sort.key)) * sort.dir);
  }, [merged, q, sort, cut, minVersion]);

  /** set or clear one part of the cut; a part turned on brings the roster into view */
  const cutBy = <K extends keyof Cut>(key: K, value: Cut[K]) => {
    const on = value !== undefined && value !== false && cut[key] !== value;
    setCut((c) => ({ ...c, [key]: on ? value : undefined }));
    setShown(50);
    if (on) requestAnimationFrame(() => rosterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const chips: { key: keyof Cut; label: string }[] = [
    cut.version ? { key: "version" as const, label: `on ${cut.version}` } : null,
    cut.behind ? { key: "behind" as const, label: `behind ${minVersion}` } : null,
    cut.expiring ? { key: "expiring" as const, label: "ends inside 30 days" } : null,
    cut.lowUptime ? { key: "lowUptime" as const, label: "uptime under 80%" } : null,
    cut.miss ? { key: "miss" as const, label: `miss rate ${cut.miss}` } : null,
    cut.days ? { key: "days" as const, label: `${cut.days} left` } : null,
  ].filter((c): c is { key: keyof Cut; label: string } => c !== null);

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === -1 ? 1 : -1 } : { key, dir: -1 }));
    setShown(50);
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => {
    const active = sort.key === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={cn(
          "uppercase tracking-[0.14em] transition-colors hover:text-zinc-900 dark:hover:text-zinc-100",
          active && "text-zinc-900 dark:text-zinc-100",
        )}
      >
        {label}
        {active ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
      </button>
    );
  };

  /* ---------------------------------------------------------------- */
  /* health aggregates from the p2p feed                                */
  /* ---------------------------------------------------------------- */

  const missBuckets = useMemo(() => {
    if (!p2p?.size) return [];
    const counts = new Map(MISS_EDGES.map((e) => [e.label, 0]));
    p2p.forEach((v) => counts.set(missBucket(v.miss_rate_14d), (counts.get(missBucket(v.miss_rate_14d)) ?? 0) + 1));
    return MISS_EDGES.map((e) => ({ label: e.label, count: counts.get(e.label) ?? 0 }));
  }, [p2p]);

  const daysLeftBuckets = useMemo(() => {
    if (!p2p?.size) return [];
    const counts = new Map(DAYS_EDGES.map((e) => [e.label, 0]));
    p2p.forEach((v) => counts.set(daysBucket(v.days_left), (counts.get(daysBucket(v.days_left)) ?? 0) + 1));
    return DAYS_EDGES.map((e) => ({ label: e.label, count: counts.get(e.label) ?? 0 }));
  }, [p2p]);

  const expiringSoon = useMemo(() => {
    if (!p2p?.size) return null;
    let within30 = 0;
    let within7 = 0;
    p2p.forEach((v) => {
      if (v.days_left < 30) within30++;
      if (v.days_left < 7) within7++;
    });
    return { within30, within7 };
  }, [p2p]);

  const topProducers = useMemo(() => {
    if (!p2p?.size) return [];
    return Array.from(p2p.values())
      .filter((v) => v.block_count_14d > 0)
      .sort((a, b) => b.block_count_14d - a.block_count_14d)
      .slice(0, 15);
  }, [p2p]);
  const maxBlocks = topProducers[0]?.block_count_14d ?? 0;

  /* ---------------------------------------------------------------- */
  /* validator count trend + the total-seats overlay                   */
  /* ---------------------------------------------------------------- */

  const countSeries = useMemo<CountPoint[]>(() => {
    const counts = toSeries(metrics?.validator_count);
    if (!counts.length) return [];
    const seats = new Map(toSeries(totalSeats).map((p) => [p.day, p.value]));
    return thin(
      counts.map((p) => ({
        day: p.day,
        count: p.value,
        // the seats series only means something after Etna split the roles
        seats: p.day >= ETNA_DAY ? seats.get(p.day) : undefined,
      })),
    );
  }, [metrics, totalSeats]);

  const ownStake = num(metrics?.validator_weight?.current_value);
  const delegatedStake = num(metrics?.delegator_weight?.current_value);
  const totalWeight =
    ownStake !== null && delegatedStake !== null ? (ownStake + delegatedStake) / NANO : null;

  /* the slabs' strips: the last 60 days of each figure */
  const countSpark = useMemo(() => toSeries(metrics?.validator_count).slice(-60).map((p) => p.value), [metrics]);
  const countDelta = countSpark.length > 30 ? countSpark[countSpark.length - 1] - countSpark[countSpark.length - 31] : null;
  const weightSpark = useMemo(() => {
    const own = toSeries(metrics?.validator_weight);
    const del = new Map(toSeries(metrics?.delegator_weight).map((p) => [p.day, p.value]));
    return own
      .filter((p) => del.has(p.day))
      .slice(-60)
      .map((p) => (p.value + (del.get(p.day) ?? 0)) / NANO);
  }, [metrics]);
  /* uptime across the set: the median, and who is under the reward line */
  const uptime = useMemo(() => {
    if (!p2p?.size) return null;
    const all = Array.from(p2p.values()).map((v) => v.p50_uptime).sort((a, b) => a - b);
    return { median: all[Math.floor(all.length / 2)], under: all.filter((u) => u < 80).length };
  }, [p2p]);
  const fleet = useMemo(() => (versions && minVersion ? fleetOf(versions, minVersion) : null), [versions, minVersion]);
  const behindCount = fleet ? fleet.filter((f) => !f.current && f.version !== "Unknown").reduce((sum, f) => sum + f.nodes, 0) : null;

  const nodeHref = (nodeId: string) =>
    `/explorer/mainnet/p-chain/node/${encodeURIComponent(nodeId)}`;

  return (
    <div className="flex flex-col gap-10">
      {/* the set at a glance: each figure a solid; the ones that can cut
          the roster do, and wear the selection blue while they do */}
      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-4 lg:gap-x-4">
          <StatSlab
            label="Validators"
            value={sdkValidators ? sdkValidators.length : null}
            format={(n) => n.toLocaleString("en-US")}
            sub={countDelta !== null ? `${countDelta >= 0 ? "+" : ""}${Math.round(countDelta)} in 30 days` : undefined}
            spark={countSpark}
            active={false}
            onClick={cutting ? () => setCut({}) : undefined}
            title={cutting ? "Show every validator" : undefined}
          />
          <StatSlab
            label="Median Uptime"
            value={uptime ? uptime.median : null}
            format={(n) => n.toFixed(2)}
            unit="%"
            fill={uptime ? uptime.median / 100 : undefined}
            sub={uptime ? (uptime.under > 0 ? `${uptime.under} under 80%` : "every node over 80%") : undefined}
            alert={!!uptime && uptime.under > 0 && !!cut.lowUptime}
            active={!!cut.lowUptime}
            onClick={uptime?.under ? () => cutBy("lowUptime", true) : undefined}
            title="A validator needs 80% uptime to earn its reward. Click to list the ones under it."
          />
          <StatSlab
            label="Total Weight"
            value={totalWeight}
            format={fmtCompact}
            unit="AVAX"
            sub="own stake + delegations"
            spark={weightSpark}
            href={switched ? undefined : stakingHref}
            title="Staking economics"
          />
          <StatSlab
            label="Ending · 30d"
            value={expiringSoon ? expiringSoon.within30 : null}
            format={(n) => n.toLocaleString("en-US")}
            alert={!!expiringSoon && expiringSoon.within7 > 0}
            sub={
              expiringSoon ? (
                expiringSoon.within7 > 0 ? (
                  <span className="text-[#E6212F]">{expiringSoon.within7} inside a week</span>
                ) : (
                  "none inside a week"
                )
              ) : undefined
            }
            active={!!cut.expiring}
            onClick={expiringSoon?.within30 ? () => cutBy("expiring", true) : undefined}
            title="List the validators whose stake ends inside 30 days"
          />
        </div>
      </section>

      {/* what the fleet runs */}
      <section>
        {fleet && versionStats ? (
          <VersionFleet
            fleet={fleet}
            target={minVersion}
            targets={availableVersions}
            onTarget={setMinVersion}
            stakePct={versionStats.stakePercentAbove}
            nodePct={versionStats.nodesPercentAbove}
            reporting={totalNodes}
            picked={cut.version ?? null}
            onPick={(v) => cutBy("version", v ?? undefined)}
            grain={grain}
            onGrain={setGrain}
          />
        ) : (
          <Board divide={false} className="border">
            <RowSkeleton n={5} />
          </Board>
        )}
      </section>

      {/* the roster: every figure above can cut it; the cut shows as chips */}
      <section ref={rosterRef} className="flex scroll-mt-24 flex-col gap-4">
        <SectionHeader
          label="Validator Set"
          action={
            merged.length ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {q || cutting
                  ? `${rows.length.toLocaleString("en-US")} / ${merged.length.toLocaleString("en-US")}`
                  : `${merged.length.toLocaleString("en-US")} validators`}
              </span>
            ) : undefined
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-full items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2 transition-colors focus-within:border-zinc-900 sm:w-80 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-100">
            <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(50);
              }}
              placeholder="Filter by NodeID or version"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setShown(50);
                }}
                aria-label="Clear search"
                className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => cutBy(c.key, undefined)}
              className="group inline-flex items-center gap-1.5 rounded-full bg-[#0061E2]/[0.08] py-1.5 pl-3 pr-2 font-mono text-[11px] text-[#0061E2] transition-colors hover:bg-[#0061E2]/[0.14] dark:bg-[#5b9bff]/15 dark:text-[#8db8ff]"
            >
              {c.label}
              <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
          {chips.length > 1 && (
            <button type="button" onClick={() => setCut({})} className="px-1 font-mono text-[11px] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
              Clear
            </button>
          )}
        </div>
        <Board divide={false}>
          {/* a tablet scrolls the ledger sideways; phones stack, desktops fit */}
          <div className="overflow-x-auto">
          <div className="md:min-w-[62rem] xl:min-w-0">
          <div className={cn(HEAD, "md:grid-cols-[2.5rem_minmax(0,1fr)_7rem_9rem_6rem_4rem_6rem_6rem_6rem]", "border-b border-zinc-200 dark:border-zinc-800")}>
            <span>#</span>
            <span>Node</span>
            <span><SortHeader label="Version" k="version" /></span>
            <span className="text-right"><SortHeader label="Total Stake" k="stake" /></span>
            <span className="text-right"><SortHeader label="Delegators" k="delegators" /></span>
            <span className="text-right"><SortHeader label="Fee" k="fee" /></span>
            <span className="text-right"><SortHeader label="Uptime" k="uptime" /></span>
            <span className="text-right whitespace-nowrap"><SortHeader label="Days Left" k="daysLeft" /></span>
            <span className="text-right whitespace-nowrap"><SortHeader label="Miss · 14d" k="missRate" /></span>
          </div>
          {sdkValidators === null && !sdkFailed && <RowSkeleton n={12} />}
          {sdkValidators !== null &&
            rows.slice(0, shown).map((v, i) => {
              const stake = v.p2p?.total_stake ?? (num(v.amountStaked) ?? 0) + (num(v.amountDelegated) ?? 0);
              return (
                <Link key={v.nodeId} href={nodeHref(v.nodeId)} className={cn(ROW, "md:grid-cols-[2.5rem_minmax(0,1fr)_7rem_9rem_6rem_4rem_6rem_6rem_6rem]", "border-b border-zinc-100 last:border-b-0 dark:border-zinc-900")}>
                  <span className="font-mono text-[12px] tabular-nums text-zinc-400 dark:text-zinc-500">{i + 1}</span>
                  <span className={cn("min-w-0 truncate font-mono text-[12px]", idInk)} title={v.nodeId}>
                    {v.nodeId}
                  </span>
                  <span className="truncate font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
                    {v.version?.replace("avalanchego/", "") ?? "—"}
                  </span>
                  <span className="font-mono text-[12.5px] tabular-nums text-zinc-900 md:text-right dark:text-zinc-50">
                    {fmtCompact(stake / NANO)} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">AVAX</span>
                  </span>
                  <span className="font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                    {v.delegatorCount.toLocaleString("en-US")}
                  </span>
                  <span className="font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                    {num(v.delegationFee)?.toFixed(0) ?? "—"}%
                  </span>
                  <span className={cn("font-mono text-[12px] tabular-nums md:text-right", v.p2p ? uptimeTone(v.p2p.p50_uptime) : "text-zinc-300 dark:text-zinc-700")}>
                    {v.p2p ? `${v.p2p.p50_uptime.toFixed(2)}%` : "—"}
                  </span>
                  <span className={cn("font-mono text-[12px] tabular-nums md:text-right", v.p2p ? daysLeftTone(v.p2p.days_left) : "text-zinc-300 dark:text-zinc-700")}>
                    {v.p2p ? v.p2p.days_left : "—"}
                  </span>
                  <span className={cn("font-mono text-[12px] tabular-nums md:text-right", v.p2p ? missRateTone(v.p2p.miss_rate_14d) : "text-zinc-300 dark:text-zinc-700")}>
                    {v.p2p ? `${v.p2p.miss_rate_14d.toFixed(1)}%` : "—"}
                  </span>
                </Link>
              );
            })}
          {sdkValidators !== null && rows.length === 0 && <EmptyRow>{q || cutting ? "no validators match" : "no validators found"}</EmptyRow>}
          {sdkFailed && sdkValidators === null && <EmptyRow><span className="text-[#E6212F]">validator feed unavailable</span></EmptyRow>}
          </div>
          </div>
        </Board>
        {shown < rows.length && (
          <LoadMore onClick={() => setShown((s) => s + 50)} label={`Load more · ${(rows.length - shown).toLocaleString("en-US")} remaining`} />
        )}
      </section>


      {/* how the fleet is behaving */}
      <div className="grid grid-cols-1 items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard label="Block Miss Rate · 14d">
          {missBuckets.length ? (
            <BucketBars
              data={missBuckets}
              picked={cut.miss}
              onPick={(l) => cutBy("miss", l)}
              tint={(b) => (b.label === "0%" ? QUIET_BAR : b.label.startsWith("0–") ? QUIET_BAR : "#E6212F")}
            />
          ) : (
            <ChartEmpty failed={false} />
          )}
        </ChartBoard>

        <ChartBoard label="Time Remaining · current set">
          {daysLeftBuckets.length ? (
            <BucketBars
              data={daysLeftBuckets}
              picked={cut.days}
              onPick={(l) => cutBy("days", l)}
              tint={(b) =>
                b.label === "< 7d" ? "#E6212F" : b.label === "7–30d" ? "#d97706" : QUIET_BAR
              }
            />
          ) : (
            <ChartEmpty failed={false} />
          )}
        </ChartBoard>
      </div>

      {/* who is actually sealing the chain */}
      {topProducers.length > 0 && (
        <ChartBoard
          label="Top Block Producers · 14d"
          bodyClassName="p-0 divide-y divide-zinc-200 dark:divide-zinc-800"
        >
          {topProducers.map((v, i) => (
              <div
                key={v.node_id}
                className="grid grid-cols-[2rem_minmax(0,14rem)_1fr_auto] items-center gap-4 px-5 py-2.5 md:px-6"
              >
                <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Link
                  href={nodeHref(v.node_id)}
                  className="truncate font-mono text-[12px] text-[#0061E2] hover:underline dark:text-[#5f9dff]"
                >
                  {v.node_id.slice(7, 15)}…{v.node_id.slice(-6)}
                </Link>
                <span className="h-2 bg-zinc-100 dark:bg-zinc-900">
                  <span
                    className="block h-full bg-[#A2AFB2] dark:bg-zinc-600"
                    style={{ width: `${maxBlocks > 0 ? (v.block_count_14d / maxBlocks) * 100 : 0}%` }}
                  />
                </span>
                <span className="font-mono text-[11px] tabular-nums text-zinc-700 dark:text-zinc-300">
                  {v.block_count_14d.toLocaleString("en-US")}
                  <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                    miss {v.miss_rate_14d.toFixed(1)}%
                  </span>
                </span>
              </div>
            ))}
        </ChartBoard>
      )}

      {/* how the set got to this size */}
      <div className="flex flex-col gap-4">
        <ChartBoard
          label="Validator Count · All Time"
          action={
            <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 bg-zinc-900/15 dark:bg-zinc-100/15" /> primary network
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-[#0061E2]" /> seats incl. L1s
              </span>
            </span>
          }
        >
          {countSeries.length ? (
            <CountChart data={countSeries} />
          ) : (
            <ChartEmpty failed={metricsFailed} />
          )}
        </ChartBoard>
        <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          After the Etna upgrade (ACP-77), L1 validators no longer stake on the Primary Network —
          the blue line counts every validator seat across the ecosystem since then.
        </p>
      </div>
    </div>
  );
}
