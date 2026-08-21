"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { Board, BoardHeader, ChartBoard, StatDash } from "@/components/explorer-v2/ui";
import {
  VersionBarChart,
  VersionBreakdownInline,
  calculateVersionStats,
  compareVersions,
  type VersionBreakdownData,
} from "@/components/stats/VersionBreakdown";
import { PRIMARY_NETWORK_ID, useValidatorStats } from "@/components/explorer-v2/validator-stats";
import { ChartEmpty, Stat, TipPlate } from "./bits";
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

const TH =
  "px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500 md:px-5";
const TD = "px-4 py-3 font-mono text-[12px] tabular-nums md:px-5";

const QUIET_BAR = "#A2AFB2";
const SEATS_COLOR = "#0061E2";
const ETNA_DAY = "2024-12-16";

interface MergedValidator extends SdkValidator {
  p2p?: P2pValidator;
}

type SortKey = "stake" | "delegators" | "fee" | "uptime" | "daysLeft" | "missRate";

function sortValue(v: MergedValidator, key: SortKey): number {
  switch (key) {
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
  if (pct >= 99) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 90) return "text-amber-600 dark:text-amber-400";
  return "text-[#E6212F]";
}

function daysLeftTone(days: number): string {
  if (days < 7) return "font-medium text-[#E6212F]";
  if (days < 30) return "text-amber-600 dark:text-amber-400";
  return "text-zinc-700 dark:text-zinc-300";
}

function missRateTone(pct: number): string {
  if (pct === 0) return "text-emerald-600 dark:text-emerald-400";
  if (pct < 5) return "text-amber-600 dark:text-amber-400";
  return "text-[#E6212F]";
}

/* simple bucket bars shared by the two health charts */
function BucketBars({
  data,
  tint,
}: {
  data: { label: string; count: number }[];
  /** per-bucket bar color; defaults to the quiet steel */
  tint?: (bucket: { label: string; count: number }, index: number) => string;
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
                </TipPlate>
              );
            }}
          />
          <Bar dataKey="count" minPointSize={1} isAnimationActive={false}>
            {data.map((bucket, i) => (
              <Cell key={bucket.label} fill={tint ? tint(bucket, i) : QUIET_BAR} />
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

export function PrimaryValidatorsContent({ stakingHref }: { stakingHref: string }) {
  const { data: metrics, failed: metricsFailed } = usePrimaryMetrics();
  const { data: sdkValidators, failed: sdkFailed } = useSdkValidators();
  const { data: p2p } = useP2pValidators();
  const { data: totalSeats } = useTotalSeats();
  const { subnets } = useValidatorStats("mainnet");

  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(50);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "stake", dir: -1 });
  const [minVersion, setMinVersion] = useState("");

  /* ---------------------------------------------------------------- */
  /* versions — the Primary Network's slice of the shared stats feed   */
  /* ---------------------------------------------------------------- */

  const versions = useMemo<VersionBreakdownData | null>(() => {
    const primary = subnets?.find((s) => s.id === PRIMARY_NETWORK_ID);
    return primary?.byClientVersion
      ? { byClientVersion: primary.byClientVersion, totalStakeString: primary.totalStakeString }
      : null;
  }, [subnets]);

  const availableVersions = useMemo(
    () =>
      versions
        ? Object.keys(versions.byClientVersion)
            .filter((v) => v !== "Unknown")
            .sort()
            .reverse()
        : [],
    [versions],
  );

  // default the target to the newest release once the feed lands
  useEffect(() => {
    if (!minVersion && availableVersions.length > 0) setMinVersion(availableVersions[0]);
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

  const merged = useMemo<MergedValidator[]>(
    () => (sdkValidators ?? []).map((v) => ({ ...v, p2p: p2p?.get(v.nodeId) })),
    [sdkValidators, p2p],
  );

  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const filtered = q
      ? merged.filter(
          (v) =>
            v.nodeId.toLowerCase().includes(q) ||
            (v.p2p?.version ?? v.version ?? "").toLowerCase().includes(q),
        )
      : merged;
    return [...filtered].sort((a, b) => (sortValue(a, sort.key) - sortValue(b, sort.key)) * sort.dir);
  }, [merged, q, sort]);

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
          "uppercase tracking-[0.16em] transition-colors hover:text-zinc-900 dark:hover:text-zinc-100",
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
    const edges = [
      { label: "0%", min: 0, max: 0 },
      { label: "0–1%", min: 0.001, max: 1 },
      { label: "1–5%", min: 1, max: 5 },
      { label: "5–10%", min: 5, max: 10 },
      { label: "10–25%", min: 10, max: 25 },
      { label: "25–50%", min: 25, max: 50 },
      { label: "50%+", min: 50, max: Infinity },
    ];
    const counts = edges.map((e) => ({ ...e, count: 0 }));
    p2p.forEach((v) => {
      const rate = v.miss_rate_14d;
      if (rate === 0) {
        counts[0].count++;
        return;
      }
      for (let i = 1; i < counts.length; i++) {
        if (rate > counts[i].min && rate <= counts[i].max) {
          counts[i].count++;
          break;
        }
      }
    });
    return counts;
  }, [p2p]);

  const daysLeftBuckets = useMemo(() => {
    if (!p2p?.size) return [];
    const edges = [
      { label: "< 7d", min: 0, max: 7 },
      { label: "7–30d", min: 7, max: 30 },
      { label: "30–90d", min: 30, max: 90 },
      { label: "90–180d", min: 90, max: 180 },
      { label: "180–365d", min: 180, max: 365 },
      { label: "365d+", min: 365, max: Infinity },
    ];
    const counts = edges.map((e) => ({ ...e, count: 0 }));
    p2p.forEach((v) => {
      for (const bucket of counts) {
        if (v.days_left >= bucket.min && v.days_left < bucket.max) {
          bucket.count++;
          break;
        }
      }
    });
    return counts;
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

  const nodeHref = (nodeId: string) =>
    `/explorer/mainnet/p-chain/node/${encodeURIComponent(nodeId)}`;

  return (
    <div className="flex flex-col gap-10">
      {/* the set at a glance */}
      <section className="flex flex-col gap-4">
        <Board divide={false} className="border">
          <BoardHeader
            label="Primary Network Validators"
            display
            action={
              <Link
                href={stakingHref}
                className="group flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
              >
                Staking economics
                <ArrowRight className="h-3 w-3 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F]" />
              </Link>
            }
          />
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
            <Stat label="Validators">
              {sdkValidators ? sdkValidators.length.toLocaleString("en-US") : <StatDash />}
            </Stat>
            <Stat
              label={`Up to Date${minVersion ? ` · ${minVersion}` : ""}`}
              sub={
                versionStats ? `${versionStats.stakePercentAbove.toFixed(1)}% by stake` : undefined
              }
            >
              {versionStats ? (
                <>
                  {versionStats.nodesPercentAbove.toFixed(1)}
                  <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
                </>
              ) : (
                <StatDash />
              )}
            </Stat>
            <Stat label="Total Weight" sub="own stake + delegations">
              {totalWeight !== null ? (
                <>
                  {fmtCompact(totalWeight)}
                  <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">AVAX</span>
                </>
              ) : (
                <StatDash />
              )}
            </Stat>
            <Stat
              label="Expiring · 30d"
              sub={
                expiringSoon ? (
                  expiringSoon.within7 > 0 ? (
                    <span className="text-[#E6212F]">{expiringSoon.within7} inside a week</span>
                  ) : (
                    "none inside a week"
                  )
                ) : undefined
              }
            >
              {expiringSoon ? expiringSoon.within30.toLocaleString("en-US") : <StatDash />}
            </Stat>
          </div>
        </Board>
      </section>

      {/* the roster itself — the page's reason to exist, so it comes first.
          the live count rides in the card's action slot as a quiet qualifier
          (rows / total while filtering) — no window chip, this IS the set */}
      <section className="flex flex-col gap-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(50);
            }}
            placeholder="Filter by NodeID or version"
            spellCheck={false}
            className="w-full border border-zinc-200 bg-white/80 py-2.5 pl-11 pr-10 font-mono text-[12px] text-zinc-900 outline-none backdrop-blur-sm transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setShown(50);
              }}
              aria-label="Clear filter"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <ChartBoard
          label="Validator Set"
          action={
            merged.length ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {q
                  ? `${rows.length.toLocaleString("en-US")} / ${merged.length.toLocaleString("en-US")}`
                  : `${merged.length.toLocaleString("en-US")} validators`}
              </span>
            ) : undefined
          }
          bodyClassName="p-0 overflow-x-auto"
        >
          <table className="w-full min-w-[62rem] border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className={TH}>#</th>
                <th className={TH}>Node</th>
                <th className={TH}>Version</th>
                <th className={cn(TH, "text-right")}>
                  <SortHeader label="Total Stake" k="stake" />
                </th>
                <th className={cn(TH, "text-right")}>
                  <SortHeader label="Delegators" k="delegators" />
                </th>
                <th className={cn(TH, "text-right")}>
                  <SortHeader label="Fee" k="fee" />
                </th>
                <th className={cn(TH, "text-right")}>
                  <SortHeader label="Uptime" k="uptime" />
                </th>
                <th className={cn(TH, "text-right whitespace-nowrap")}>
                  <SortHeader label="Days Left" k="daysLeft" />
                </th>
                <th className={cn(TH, "text-right whitespace-nowrap")}>
                  <SortHeader label="Miss · 14d" k="missRate" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sdkValidators === null && !sdkFailed
                ? Array.from({ length: 10 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={9} className="px-4 py-3 md:px-5">
                        <div className="h-4 w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                      </td>
                    </tr>
                  ))
                : rows.slice(0, shown).map((v, i) => {
                    const stake =
                      v.p2p?.total_stake ??
                      (num(v.amountStaked) ?? 0) + (num(v.amountDelegated) ?? 0);
                    return (
                      <tr
                        key={v.nodeId}
                        className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                      >
                        <td className={cn(TD, "text-zinc-400 dark:text-zinc-500")}>{i + 1}</td>
                        <td className={TD}>
                          <Link
                            href={nodeHref(v.nodeId)}
                            className="text-[#0061E2] hover:underline dark:text-[#5f9dff]"
                          >
                            {v.nodeId.slice(0, 12)}…{v.nodeId.slice(-8)}
                          </Link>
                        </td>
                        <td className={cn(TD, "text-zinc-500 dark:text-zinc-400")}>
                          {(v.p2p?.version ?? v.version)?.replace("avalanchego/", "") ?? "—"}
                        </td>
                        <td className={cn(TD, "text-right text-zinc-900 dark:text-zinc-100")}>
                          {fmtCompact(stake / NANO)} AVAX
                        </td>
                        <td className={cn(TD, "text-right text-zinc-500 dark:text-zinc-400")}>
                          {v.delegatorCount.toLocaleString("en-US")}
                        </td>
                        <td className={cn(TD, "text-right text-zinc-500 dark:text-zinc-400")}>
                          {num(v.delegationFee)?.toFixed(0) ?? "—"}%
                        </td>
                        <td className={cn(TD, "text-right")}>
                          {v.p2p ? (
                            <span className={uptimeTone(v.p2p.p50_uptime)}>
                              {v.p2p.p50_uptime.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-700">—</span>
                          )}
                        </td>
                        <td className={cn(TD, "text-right")}>
                          {v.p2p ? (
                            <span className={daysLeftTone(v.p2p.days_left)}>{v.p2p.days_left}</span>
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-700">—</span>
                          )}
                        </td>
                        <td className={cn(TD, "text-right")}>
                          {v.p2p ? (
                            <span className={missRateTone(v.p2p.miss_rate_14d)}>
                              {v.p2p.miss_rate_14d.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-700">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              {sdkValidators !== null && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 md:px-5 dark:text-zinc-500"
                  >
                    {q ? "No validators match" : "No validators found"}
                  </td>
                </tr>
              )}
              {sdkFailed && sdkValidators === null && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-[#E6212F] md:px-5"
                  >
                    Validator feed unavailable
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ChartBoard>
        {shown < rows.length && (
          <button
            onClick={() => setShown((s) => s + 50)}
            className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
          >
            Load more · {(rows.length - shown).toLocaleString("en-US")} remaining
          </button>
        )}
      </section>

      {/* what the fleet is running */}
      <ChartBoard
        label="Client Versions"
        action={
          availableVersions.length > 0 ? (
            <label className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                Target
              </span>
              <select
                value={minVersion}
                onChange={(e) => setMinVersion(e.target.value)}
                className="border border-zinc-200 bg-white/80 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-700 outline-none transition-colors focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:focus:border-zinc-100"
              >
                {availableVersions.map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined
        }
        bodyClassName="flex flex-col gap-4"
      >
        {versions && minVersion ? (
          <>
            <VersionBarChart
              versionBreakdown={versions}
              minVersion={minVersion}
              totalNodes={totalNodes}
              height="h-8"
            />
            <VersionBreakdownInline versions={versions.byClientVersion} minVersion={minVersion} limit={5} />
            {versionStats && (
              <p className="text-[13px] leading-relaxed tabular-nums text-zinc-500 dark:text-zinc-400">
                {versionStats.stakePercentAbove.toFixed(1)}% of stake runs {minVersion} or newer
              </p>
            )}
          </>
        ) : (
          <ChartEmpty failed={false} />
        )}
      </ChartBoard>

      {/* how the fleet is behaving */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard label="Block Miss Rate · 14d">
          {missBuckets.length ? (
            <BucketBars
              data={missBuckets}
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
