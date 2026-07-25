"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, BoardHeader, ChartBoard, StatDash } from "@/components/explorer-v2/ui";
import { ChartEmpty, Stat, TipPlate } from "./bits";
import { timeAgo } from "@/components/explorer-v2/format";
import { RANGE_DAYS, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { PRIMARY_NETWORK_ID, useValidatorStats } from "@/components/explorer-v2/validator-stats";
import { usePchainData } from "@/components/explorer-v2/pchain/hooks";
import { hasRealChainLogo, type Stats } from "@/lib/pchain-explorer";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";
import {
  fmtCompact,
  thin,
  toSeries,
  useEcosystemSeats,
  useValidatorFeePrice,
  windowSeries,
} from "./data";

/* The network's OTHER validator economy, post-ACP-77: L1 seats don't stake
   AVAX or earn rewards — each one prepays a continuous fee from a balance,
   burned per second. Staking mints; seats burn. This section puts the two
   side by side: how many seats, what a seat costs, what the whole set
   burns, and where the seats actually run. L1s wear the subnet blue
   throughout, against the Primary Network's ink. */

const L1_COLOR = "#0061E2";
const NANO = 1e9;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_MONTH = 30 * SECONDS_PER_DAY;

interface SeatPoint {
  day: string;
  primary: number;
  l1: number;
}

/* stacked Primary + L1 seats — the Avalanche9000 growth story in one shape */
function SeatsChart({ data }: { data: SeatPoint[] }) {
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
              const d = payload[0].payload as SeatPoint;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.day}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {(d.primary + d.l1).toLocaleString("en-US")} seats
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    primary {d.primary.toLocaleString("en-US")} · L1{" "}
                    {d.l1.toLocaleString("en-US")}
                  </p>
                </TipPlate>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="primary"
            stackId="seats"
            stroke="currentColor"
            strokeWidth={1.5}
            fill="currentColor"
            fillOpacity={0.1}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="l1"
            stackId="seats"
            stroke={L1_COLOR}
            strokeWidth={1.5}
            fill={L1_COLOR}
            fillOpacity={0.14}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function SeatsKey() {
  return (
    <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 bg-zinc-900/15 dark:bg-zinc-100/15" /> primary
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 bg-[#0061E2]/25" /> L1
      </span>
    </span>
  );
}

/* Most L1s never uploaded artwork — a blank circle row after row reads
   as broken. Deterministic letter tiles instead: hue hashed from the
   subnet id (stable across renders and sessions), initial from the name. */
export function ChainBadge({
  name,
  logo,
  id,
  className = "h-4 w-4 text-[8px]",
}: {
  name: string;
  logo?: string;
  id: string;
  className?: string;
}) {
  if (logo && hasRealChainLogo(logo)) {
    return <img src={logo} alt="" className={`${className} shrink-0 rounded-full object-contain`} />;
  }
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return (
    <span
      aria-hidden
      className={`${className} inline-flex shrink-0 items-center justify-center rounded-full font-mono font-bold text-white`}
      style={{ backgroundColor: `hsl(${h} 40% 42%)` }}
    >
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* the build-out registry: every subnet/chain the P-Chain ever created  */

interface L1Registry {
  totals: { subnets: number; l1s: number; blockchains: number; evmChains: number };
  series: { month: string; blockchains: number; subnets: number }[];
  recent: {
    name: string;
    blockchainId: string;
    subnetId: string;
    isL1: boolean;
    evmChainId?: number;
    createdAt: number;
  }[];
}

function useL1Registry(network: string) {
  const [data, setData] = useState<L1Registry | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/l1-registry/${network}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: L1Registry) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [network]);
  return { data, failed };
}

/* cumulative creations — blockchains as the filled story, subnets dashed */
function BuildOutChart({ data }: { data: L1Registry["series"] }) {
  return (
    <div className="h-56 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <XAxis dataKey="month" hide />
          <YAxis hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as L1Registry["series"][number];
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.month}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.blockchains.toLocaleString("en-US")} blockchains
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    {d.subnets.toLocaleString("en-US")} subnets created
                  </p>
                </TipPlate>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="blockchains"
            stroke={L1_COLOR}
            strokeWidth={1.5}
            fill={L1_COLOR}
            fillOpacity={0.12}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="subnets"
            stroke="currentColor"
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

const LEADERBOARD_CAP = 12;

interface LiveL1 {
  id: string;
  name: string;
  logo?: string;
  slug?: string;
  seats: number;
}

/* where the seats actually run — proportional bars over the live sets */
function SeatsByL1({ sets, network }: { sets: LiveL1[]; network: string }) {
  const max = sets[0]?.seats ?? 1;
  const total = sets.reduce((s, l) => s + l.seats, 0);
  const visible = sets.slice(0, LEADERBOARD_CAP);
  return (
    <div className="flex flex-col">
      {visible.map((l) => {
        const row = (
          <>
            <span className="flex min-w-0 items-center gap-2">
              <ChainBadge name={l.name} logo={l.logo} id={l.id} />
              <span className="truncate text-[12.5px] font-medium text-zinc-900 dark:text-zinc-100">
                {l.name}
              </span>
            </span>
            <span className="relative h-2 min-w-0 flex-1 bg-zinc-100 dark:bg-zinc-900">
              <span
                className="absolute inset-y-0 left-0 bg-[#0061E2]/60"
                style={{ width: `${(l.seats / max) * 100}%` }}
              />
            </span>
            <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-zinc-700 dark:text-zinc-300">
              {l.seats.toLocaleString("en-US")}
              <span className="ml-1 text-zinc-400 dark:text-zinc-600">
                {total > 0 ? `${Math.round((l.seats / total) * 100)}%` : ""}
              </span>
            </span>
          </>
        );
        const cls = "grid grid-cols-[minmax(7rem,11rem)_1fr_5rem] items-center gap-3 py-2";
        return l.slug ? (
          <Link
            key={l.id}
            href={`/explorer/${network}/${l.slug}/validators`}
            className={`${cls} -mx-2 px-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900`}
          >
            {row}
          </Link>
        ) : (
          <div key={l.id} className={cls}>
            {row}
          </div>
        );
      })}
      {sets.length > LEADERBOARD_CAP && (
        <Link
          href={`/explorer/${network}/validators`}
          className="group mt-2 inline-flex items-center gap-1.5 self-start font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
        >
          {sets.length - LEADERBOARD_CAP} more sets
          <ArrowRight className="h-3 w-3 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F]" />
        </Link>
      )}
    </div>
  );
}

/* The P-Chain's L1s tab: the seat economy as its own page. Lived inside
   the Staking page briefly — but staking and seats are different economies
   (one mints, one burns), and each deserves its own door in the subnav. */
export function PchainL1s({ chain, network }: { chain: string; network: string }) {
  return (
    <ExplorerShell chain={chain} network={network}>
      <L1Economy network={network} />
    </ExplorerShell>
  );
}

export function L1Economy({ network = "mainnet" }: { network?: string }) {
  const { data: seats, failed: seatsFailed } = useEcosystemSeats();
  const feePrice = useValidatorFeePrice(network); // nAVAX/s per seat
  const { subnets, error: setsFailed } = useValidatorStats(network);
  const { data: registry, failed: registryFailed } = useL1Registry(network);
  // one indexer snapshot carries both counts, so the share can't skew:
  // l1ValidatorCount is the ACTIVE (fee-paying) seats registered on the
  // P-Chain — the number the burn math is honest against
  const { data: chainStats } = usePchainData<Stats>(network, "stats");

  const clock = useExplorerTimeRange();
  const chartDays = Math.max(7, RANGE_DAYS[clock]);
  const weekFloor = RANGE_DAYS[clock] < 7 ? " · 7 days" : "";

  const seatSeries = useMemo<SeatPoint[]>(() => {
    const l1 = toSeries(seats?.l1);
    const primary = new Map(toSeries(seats?.primary).map((p) => [p.day, p.value]));
    const joined = l1.map((p) => ({
      day: p.day,
      l1: p.value,
      primary: primary.get(p.day) ?? 0,
    }));
    return thin(windowSeries(joined, chartDays));
  }, [seats, chartDays]);

  // headline figures: the indexer snapshot when it's up (live, and the
  // fee-paying definition), the metrics series' newest point as fallback
  const l1Seats = useMemo(() => {
    if (chainStats?.l1ValidatorCount !== undefined) return chainStats.l1ValidatorCount;
    const s = toSeries(seats?.l1);
    return s.length ? s[s.length - 1].value : null;
  }, [chainStats, seats]);
  const primarySeats = useMemo(() => {
    if (chainStats?.validatorCount !== undefined) return chainStats.validatorCount;
    const s = toSeries(seats?.primary);
    return s.length ? s[s.length - 1].value : null;
  }, [chainStats, seats]);
  const l1Share =
    l1Seats !== null && primarySeats !== null && l1Seats + primarySeats > 0
      ? (l1Seats / (l1Seats + primarySeats)) * 100
      : null;

  // live L1 sets: fee-paying seats per subnet from the validator-stats
  // aggregate. Node-verified since the upstream fixes (stats-api PR #8:
  // removal semantics; PR #9: balances net of continuous-fee burn, drained
  // seats excluded) — the sum here now matches the fee-paying headline,
  // and the "of N registered active" sub renders only if they ever drift.
  const liveSets = useMemo<LiveL1[] | null>(() => {
    if (!subnets) return null;
    const slugBySubnet = new Map<string, string>();
    for (const c of l1ChainsData as L1Chain[]) {
      if (c.isTestnet !== true && c.subnetId && c.slug) slugBySubnet.set(c.subnetId, c.slug);
    }
    return subnets
      .filter((s) => s.isL1 && s.id !== PRIMARY_NETWORK_ID)
      .map((s) => ({
        id: s.id,
        name: s.name,
        logo: s.chainLogoURI,
        slug: slugBySubnet.get(s.id),
        seats: Object.values(s.byClientVersion ?? {}).reduce((sum, v) => sum + v.nodes, 0),
      }))
      .filter((s) => s.seats > 0)
      .sort((a, b) => b.seats - a.seats);
  }, [subnets]);

  const perSeatMonth = feePrice !== null ? (feePrice * SECONDS_PER_MONTH) / NANO : null;
  const burnPerDay =
    feePrice !== null && l1Seats !== null ? (feePrice * l1Seats * SECONDS_PER_DAY) / NANO : null;

  // registered-active seats across all live sets — the fee-paying headline's
  // wider circle (drained seats stay registered until removed)
  const registeredSeats = useMemo(
    () => (liveSets ? liveSets.reduce((s, l) => s + l.seats, 0) : null),
    [liveSets],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <Board divide={false} className="border">
          <BoardHeader
            label="The L1 Validator Economy"
            display
            action={
              <Link
                href={`/explorer/${network}/validators`}
                className="group flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
              >
                All validator sets
                <ArrowRight className="h-3 w-3 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F]" />
              </Link>
            }
          />
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
            <Stat
              label="L1 Validator Seats"
              sub={
                registeredSeats !== null && l1Seats !== null && registeredSeats > l1Seats
                  ? `fee-paying · of ${registeredSeats.toLocaleString("en-US")} registered active`
                  : "fee-paying"
              }
            >
              {l1Seats !== null ? l1Seats.toLocaleString("en-US") : <StatDash />}
            </Stat>
            <Stat label="Share of All Seats" sub="vs the Primary Network">
              {l1Share !== null ? (
                <>
                  {l1Share.toFixed(1)}
                  <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
                </>
              ) : (
                <StatDash />
              )}
            </Stat>
            <Stat
              label="Fee Per Seat"
              sub={feePrice !== null ? `${feePrice.toLocaleString("en-US")} nAVAX/s, live` : undefined}
            >
              {perSeatMonth !== null ? (
                <>
                  {perSeatMonth.toFixed(2)}
                  <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">AVAX/mo</span>
                </>
              ) : (
                <StatDash />
              )}
            </Stat>
            <Stat label="Set Burn Rate" sub="at the current seat count">
              {burnPerDay !== null ? (
                <>
                  {fmtCompact(burnPerDay)}
                  <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">AVAX/day</span>
                </>
              ) : (
                <StatDash />
              )}
            </Stat>
          </div>
        </Board>
        <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          L1 validators don&apos;t stake AVAX or earn rewards. Each seat prepays a continuous fee
          from its own balance — burned per second at the network&apos;s current price (
          <Link
            href="/docs/acps/77-reinventing-subnets"
            className="text-[#0061E2] underline-offset-4 hover:underline dark:text-[#5f9dff]"
          >
            ACP-77
          </Link>
          ). A seat whose balance runs dry stays registered but goes inactive — no longer counted
          here — until topped back up. Staking mints; seats burn.
        </p>
      </div>

      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard
          label={`Validator Seats${weekFloor}`}
          action={
            <span className="hidden sm:block">
              <SeatsKey />
            </span>
          }
        >
          {seatSeries.length ? <SeatsChart data={seatSeries} /> : <ChartEmpty failed={seatsFailed} />}
        </ChartBoard>

        <ChartBoard
          label="Active Seats by L1"
          action={
            liveSets && registeredSeats !== null ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {registeredSeats.toLocaleString("en-US")} seats · {liveSets.length} sets
              </span>
            ) : undefined
          }
        >
          {liveSets === null ? (
            <ChartEmpty failed={setsFailed} />
          ) : liveSets.length === 0 ? (
            <ChartEmpty failed={false} label="No live L1 sets" />
          ) : (
            <SeatsByL1 sets={liveSets} network={network} />
          )}
        </ChartBoard>
      </div>

      {/* the build-out: everything the P-Chain has ever created — the
          registry behind the seat market. Seats are the run-rate; this
          is the install base. */}
      <div className="flex flex-col gap-4 pt-2">
        <Board divide={false} className="border">
          <BoardHeader
            label="The Build-Out"
            display
            action={
              <Link
                href={`/explorer/${network}/chains`}
                className="group flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
              >
                Chains directory
                <ArrowRight className="h-3 w-3 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F]" />
              </Link>
            }
          />
          <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-zinc-800">
            <Stat label="Blockchains Created" sub="all-time, on the P-Chain">
              {registry ? registry.totals.blockchains.toLocaleString("en-US") : <StatDash />}
            </Stat>
            <Stat label="Subnets Created" sub="all-time">
              {registry ? registry.totals.subnets.toLocaleString("en-US") : <StatDash />}
            </Stat>
            <Stat label="Converted to L1" sub="ACP-77 sovereign sets">
              {registry ? registry.totals.l1s.toLocaleString("en-US") : <StatDash />}
            </Stat>
          </div>
        </Board>
      </div>

      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard
          label="Chains Created · cumulative"
          action={
            <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 bg-[#0061E2]/25" /> blockchains
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-b border-dashed border-[#A2AFB2]" /> subnets
              </span>
            </span>
          }
        >
          {registry?.series.length ? (
            <BuildOutChart data={registry.series} />
          ) : (
            <ChartEmpty failed={registryFailed} />
          )}
        </ChartBoard>

        <ChartBoard
          label="Newest Chains"
          action={
            registry?.recent.length ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                latest {registry.recent.length}
              </span>
            ) : undefined
          }
        >
          {registry === null ? (
            <ChartEmpty failed={registryFailed} />
          ) : (
            <div className="flex flex-col">
              {registry.recent.map((c) => (
                <Link
                  key={c.blockchainId}
                  href={`/explorer/${network}/p-chain/chain/${c.blockchainId}`}
                  className="-mx-2 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-2 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <ChainBadge
                      name={c.name}
                      id={c.subnetId}
                      className="h-5 w-5 text-[9px]"
                    />
                    <span className="truncate text-[12.5px] font-medium text-zinc-900 dark:text-zinc-100">
                      {c.name}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                    {c.isL1 ? "L1" : c.evmChainId ? "EVM" : "subnet"}
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                    {timeAgo(c.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </ChartBoard>
      </div>
    </section>
  );
}
