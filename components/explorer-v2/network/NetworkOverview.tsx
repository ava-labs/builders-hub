"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChainCosmosData, ICMFlowRoute } from "@/components/stats/NetworkDiagram";
import {
  Board,
  SectionHeader,
  StatCell,
  StatDash,
  StatFigure,
} from "@/components/explorer-v2/ui";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { NetworkBlockTape, type TapeFeedChain } from "@/components/explorer-v2/network/NetworkBlockTape";
import { useExplorerTimeRange, RANGE_LABEL, type ExplorerRange } from "@/components/explorer-v2/time-range";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

/* The All Networks overview — the explorer's widest lens. One ledger strip
   of ecosystem aggregates, the chains ranked by live activity, and the two
   network-level instruments (staking, the token) as teaser boards that
   link into their own facets. The page-level time range comes from the
   explorer's shared clock — picked in the subnav, not on this sheet. */

interface ChainRow {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: number;
  tps: number;
  activeAddresses: number;
  icmMessages: number;
  validatorCount: number | string;
}

/* compact dollar figures: $2.8B, $78.4M */
function fmtUsd(v: number | null | undefined): string {
  return typeof v === "number" && v > 0 ? `$${compact.format(v)}` : "—";
}

interface AppRow {
  slug: string;
  name: string;
  logo: string | null;
  tvl: number | null;
  change_1d: number | null;
}

/* the ecosystem's biggest apps by TVL — the same DefiLlama feed the Apps
   facet runs on, sliced to a leaderboard */
function useTopApps(limit: number) {
  const [apps, setApps] = useState<AppRow[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dapps", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { dapps?: AppRow[] }) => {
        const top = (d.dapps ?? [])
          .filter((a) => typeof a.tvl === "number" && a.tvl > 0)
          .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
          .slice(0, limit);
        setApps(top);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [limit]);
  return apps;
}

interface OverviewData {
  chains: ChainRow[];
  aggregated: {
    totalTxCount: number;
    totalTps: number;
    totalActiveAddresses: number;
    totalICMMessages: number;
    totalValidators: number;
    activeL1Count: number;
  };
}

interface SupplyData {
  circulatingSupply: string;
  totalStaked: string;
  totalPBurned: string;
  totalCBurned: string;
  totalXBurned: string;
  price: number;
  priceChange24h: number;
}

/* the overview aggregate's longest upstream window is a year: the ALL
   tick clamps to it, and the pulse labels say so */
function overviewWindow(range: ExplorerRange): Exclude<ExplorerRange, "all"> {
  return range === "all" ? "year" : range;
}

function overviewWindowLabel(range: ExplorerRange): string {
  return range === "all" ? `${RANGE_LABEL.year} · longest window` : RANGE_LABEL[range];
}

function useOverviewStats(timeRange: ExplorerRange) {
  const [data, setData] = useState<OverviewData | null>(null);
  // when the figures landed — the anchor the live tx counter counts from
  const [fetchedAt, setFetchedAt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setRefreshing(true);
    fetch(`/api/overview-stats?timeRange=${timeRange}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: OverviewData) => {
        setData(d);
        setFetchedAt(Date.now());
      })
      .catch(() => {
        /* the previous range's data stands */
      })
      .finally(() => setRefreshing(false));
    return () => controller.abort();
  }, [timeRange]);
  return { data, fetchedAt, refreshing };
}

/* the cosmos map — a 1.6k-line canvas, so it only loads on the client
   and never blocks the splash's first paint */
const NetworkDiagram = dynamic(() => import("@/components/stats/NetworkDiagram"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-900 dark:bg-black" />,
});

/* 30-day ICM flows drawn as arcs between chains. Failure is non-fatal:
   the diagram still renders its nodes, just without traffic. */
function useIcmFlowRoutes() {
  const [flows, setFlows] = useState<ICMFlowRoute[]>([]);
  const [failedChainIds, setFailedChainIds] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/icm-flow?days=30", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { flows?: ICMFlowRoute[]; failedChainIds?: string[] }) => {
        if (Array.isArray(d.flows)) setFlows(d.flows);
        if (Array.isArray(d.failedChainIds)) setFailedChainIds(d.failedChainIds);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return { flows, failedChainIds };
}

/* deterministic fallback tint for catalog chains without a brand color */
function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${hash % 360}, 70%, 50%)`;
}

function useAvaxSupply() {
  const [data, setData] = useState<SupplyData | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/avax-supply", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: SupplyData) => setData(d))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return data;
}

/* compact figures for table cells and AVAX quantities: 1.24M, 254.9M */
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
function fmtAvax(v: string | undefined): string | null {
  const n = v ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 ? `${compact.format(n)} AVAX` : null;
}

/* catalog lookups so activity rows link into each chain's own explorer */
const catalogByChainId = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true).map((c) => [String(c.chainId), c]),
);
function chainHref(chainId: string): string | null {
  const c = catalogByChainId.get(String(chainId));
  if (!c) return null;
  return c.rpcUrl ? `/explorer/mainnet/${c.slug}` : `/explorer/mainnet/${c.slug}/accounts`;
}

function BoardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      {children}
      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/* a facet door in the homepage pillar panels' color scheme: brand-dark
   #1F1F1F board, EBF0FA lead over the #E6212F punch, steel spec rows,
   red arrow chip. The figure IS the headline. */
function DoorPanel({
  href,
  lead,
  punch,
  specs,
}: {
  href: string;
  lead: string | null;
  punch: string;
  specs: { label: string; value: string | null }[];
}) {
  return (
    <Link
      href={href}
      className="group flex flex-1 flex-col justify-between gap-10 bg-[#1F1F1F] p-6 transition-colors hover:bg-[#262626] md:p-8"
    >
      <div className="flex items-start justify-between gap-6">
        <h3 className="v2-display text-3xl leading-[1.02] md:text-4xl">
          {lead ? (
            <span className="block text-[#EBF0FA]">{lead}</span>
          ) : (
            <span className="block h-8 w-48 animate-pulse bg-white/10 md:h-9" />
          )}
          <span className="block text-[#E6212F]">{punch}</span>
        </h3>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6212F] transition-transform group-hover:translate-x-0.5">
          <ArrowRight className="h-4 w-4 text-white" />
        </span>
      </div>
      <dl className="divide-y divide-white/10 border-t border-white/10">
        {specs.map((s) => (
          <div key={s.label} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#A2AFB2]">
              {s.label}
            </dt>
            <dd className="font-mono text-sm tabular-nums text-[#EBF0FA]">{s.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

const TH = "px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500 md:px-6";
const TD = "px-5 py-3 text-[13px] leading-5 tabular-nums md:px-6";

export function NetworkOverview() {
  // the shared clock: registers this page as a consumer, so the subnav
  // surfaces its range control and every reading below tracks the one pick
  const range = useExplorerTimeRange();
  const { data, fetchedAt, refreshing } = useOverviewStats(overviewWindow(range));
  const supply = useAvaxSupply();

  const agg = data?.aggregated;

  /* the tx counter runs forward from its fetch anchor at the window's own
     rate — the count IS rising at ~tps/s, the API just snapshots it. A 2s
     tick re-renders; StatFigure tweens each step, so it reads as a
     continuous count-up. */
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 2_000);
    return () => clearInterval(id);
  }, []);
  const liveTxCount =
    agg && fetchedAt
      ? Math.round(agg.totalTxCount + (agg.totalTps * (Date.now() - fetchedAt)) / 1000)
      : null;

  /* real throughput measured off the block tape's stream — moves as the
     network does, instead of a 24h average sitting still */
  const [liveTps, setLiveTps] = useState<number | null>(null);

  const topApps = useTopApps(12);
  const rows = useMemo(
    () => (data?.chains ?? []).slice().sort((a, b) => b.activeAddresses - a.activeAddresses).slice(0, 12),
    [data],
  );

  const { flows, failedChainIds } = useIcmFlowRoutes();

  /* the tape's roster: the busiest RPC-backed chains, latched to the first
     load so flipping the range doesn't reset a live feed */
  const tapeChainsRef = useRef<TapeFeedChain[]>([]);
  const tapeChains = useMemo<TapeFeedChain[]>(() => {
    if (tapeChainsRef.current.length > 0) return tapeChainsRef.current;
    const roster = (data?.chains ?? [])
      .slice()
      .sort((a, b) => b.txCount - a.txCount)
      .flatMap((c) => {
        const catalog = catalogByChainId.get(String(c.chainId));
        if (!catalog?.rpcUrl) return [];
        return [
          {
            chainId: String(c.chainId),
            slug: catalog.slug,
            name: c.chainName,
            logo: c.chainLogoURI || catalog.chainLogoURI || "",
          },
        ];
      })
      .slice(0, 8);
    if (roster.length > 0) tapeChainsRef.current = roster;
    return roster;
  }, [data]);

  /* the diagram's node list: validator-backed chains only (zero-validator
     chains render as orphan dots), largest sets first to anchor the layout */
  const cosmos = useMemo<ChainCosmosData[]>(() => {
    return (data?.chains ?? [])
      .map((c) => {
        const validatorCount = typeof c.validatorCount === "number" ? c.validatorCount : 0;
        if (validatorCount === 0) return null;
        const catalog = catalogByChainId.get(String(c.chainId));
        return {
          id: catalog?.subnetId || c.chainId,
          chainId: c.chainId,
          name: c.chainName,
          logo: c.chainLogoURI,
          color: catalog?.color || colorFromName(c.chainName),
          validatorCount,
          subnetId: catalog?.subnetId,
          activeAddresses: c.activeAddresses > 0 ? c.activeAddresses : undefined,
          txCount: c.txCount > 0 ? Math.round(c.txCount) : undefined,
          icmMessages: c.icmMessages > 0 ? Math.round(c.icmMessages) : undefined,
          tps: c.tps > 0 ? parseFloat(c.tps.toFixed(2)) : undefined,
          category: catalog?.category || "General",
        } as ChainCosmosData;
      })
      .filter((c): c is ChainCosmosData => c !== null)
      .sort((a, b) => b.validatorCount - a.validatorCount);
  }, [data]);

  const stakingRatio = useMemo(() => {
    const staked = parseFloat(supply?.totalStaked ?? "");
    const circ = parseFloat(supply?.circulatingSupply ?? "");
    return Number.isFinite(staked) && Number.isFinite(circ) && circ > 0
      ? `${((staked / circ) * 100).toFixed(1)}%`
      : null;
  }, [supply]);

  const feesBurned = useMemo(() => {
    if (!supply) return null;
    const total =
      parseFloat(supply.totalCBurned || "0") +
      parseFloat(supply.totalPBurned || "0") +
      parseFloat(supply.totalXBurned || "0");
    return Number.isFinite(total) && total > 0 ? total : null;
  }, [supply]);

  const priceAside = supply?.price ? (
    <div className="flex flex-col items-end gap-1">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        AVAX
      </span>
      <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
        ${supply.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        {Number.isFinite(supply.priceChange24h) && (
          <span
            className={cn(
              "ml-2 text-sm",
              supply.priceChange24h >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[#E6212F]",
            )}
          >
            {supply.priceChange24h >= 0 ? "+" : ""}
            {supply.priceChange24h.toFixed(2)}%
          </span>
        )}
      </span>
    </div>
  ) : undefined;

  return (
    <NetworkShell
      eyebrow="Avalanche Ecosystem · Mainnet"
      title="All Networks"
      intro="Every Avalanche chain on one sheet: live activity, interchain traffic, validators, and the token that secures it all."
      aside={priceAside}
    >
      <div className="flex flex-col gap-10">
        {/* the live tape — the same instrument every chain page runs, here
            merged across the busiest chains, each block wearing the logo of
            the chain that sealed it */}
        <NetworkBlockTape chains={tapeChains} onTps={setLiveTps} />

        {/* the ecosystem's ledger strip */}
        <section className="flex flex-col gap-4">
          <SectionHeader label={`Network pulse · ${overviewWindowLabel(range)}`} />
          <Board
            divide={false}
            className={cn("overflow-hidden transition-opacity", refreshing && data && "opacity-60")}
          >
            {/* -ml/-mt swallow the leading hairlines so every cell can carry
                border-l/border-t and the grid stays clean at any column count */}
            <div className="-ml-px -mt-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 [&>div]:border-l [&>div]:border-t [&>div]:border-zinc-200 dark:[&>div]:border-zinc-800">
              <div>
                <StatCell label="Transactions" live>
                  {liveTxCount !== null ? <StatFigure value={liveTxCount} /> : <StatDash />}
                </StatCell>
              </div>
              <div>
                <StatCell label={liveTps !== null ? "TPS" : "Avg TPS"} live={liveTps !== null}>
                  {liveTps !== null || agg ? (
                    <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
                      {(() => {
                        const tps = liveTps ?? agg!.totalTps;
                        return tps >= 100 ? Math.round(tps).toLocaleString("en-US") : tps.toFixed(1);
                      })()}
                    </span>
                  ) : (
                    <StatDash />
                  )}
                </StatCell>
              </div>
              <div>
                <StatCell label="Active addresses">
                  {agg ? <StatFigure value={agg.totalActiveAddresses} /> : <StatDash />}
                </StatCell>
              </div>
              <div>
                <StatCell label="ICM messages" href="/explorer/mainnet/icm">
                  {agg ? <StatFigure value={agg.totalICMMessages} /> : <StatDash />}
                </StatCell>
              </div>
              <div>
                <StatCell label="Validators" href="/explorer/mainnet/validators">
                  {agg ? <StatFigure value={agg.totalValidators} /> : <StatDash />}
                </StatCell>
              </div>
              <div>
                <StatCell label="Active L1s" href="/explorer/mainnet/chains">
                  {agg ? <StatFigure value={agg.activeL1Count} /> : <StatDash />}
                </StatCell>
              </div>
            </div>
          </Board>
        </section>

        {/* the network as a cosmos: every validator set a body, ICM traffic
            as arcs between them — the one dark surface on the sheet */}
        <section className="flex flex-col gap-4">
          <SectionHeader
            label="Network map"
            action={<BoardLink href="/explorer/mainnet/icm">ICM flows</BoardLink>}
          />
          <Board divide={false} className="overflow-hidden bg-zinc-900 p-0 dark:bg-black">
            <div className="h-[400px] sm:h-[500px] md:h-[560px]">
              {cosmos.length > 0 ? (
                <NetworkDiagram data={cosmos} icmFlows={flows} failedChainIds={failedChainIds} />
              ) : (
                <div className="h-full w-full animate-pulse bg-zinc-900 dark:bg-black" />
              )}
            </div>
          </Board>
        </section>

        {/* the chains, ranked by who's actually being used — with the
            ecosystem's biggest apps standing beside them */}
        <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
        <section className="flex min-w-0 flex-col gap-4">
          <SectionHeader
            label={`Top chains · ${overviewWindowLabel(range)}`}
            action={<BoardLink href="/explorer/mainnet/chains">All chains</BoardLink>}
          />
          <Board divide={false} className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                  <th className={TH}>Chain</th>
                  <th className={cn(TH, "text-right")}>Active addresses</th>
                  <th className={cn(TH, "text-right")}>Transactions</th>
                  <th className={cn(TH, "text-right")}>Validators</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.length === 0 &&
                  Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}>
                      <td className={TD} colSpan={4}>
                        <span className="block h-4 w-2/5 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                      </td>
                    </tr>
                  ))}
                {rows.map((c) => {
                  const href = chainHref(c.chainId);
                  const name = (
                    <span className="flex items-center gap-2.5">
                      {c.chainLogoURI ? (
                        <img src={c.chainLogoURI} alt="" className="h-5 w-5 shrink-0 rounded-full object-contain" />
                      ) : (
                        <span className="h-5 w-5 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800" />
                      )}
                      <span
                        className={cn(
                          "truncate text-[13px] font-medium",
                          href
                            ? "text-[#0061E2] group-hover:underline dark:text-[#5f9dff]"
                            : "text-zinc-900 dark:text-zinc-100",
                        )}
                      >
                        {c.chainName}
                      </span>
                    </span>
                  );
                  return (
                    <tr
                      key={c.chainId}
                      className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    >
                      <td className={cn(TD, "max-w-64")}>
                        {href ? (
                          <Link href={href} className="group block">
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                      </td>
                      <td className={cn(TD, "text-right font-mono text-zinc-900 dark:text-zinc-100")}>
                        {compact.format(c.activeAddresses)}
                      </td>
                      <td className={cn(TD, "text-right font-mono text-zinc-700 dark:text-zinc-300")}>
                        {compact.format(c.txCount)}
                      </td>
                      <td className={cn(TD, "text-right font-mono text-zinc-700 dark:text-zinc-300")}>
                        {typeof c.validatorCount === "number" ? c.validatorCount.toLocaleString("en-US") : c.validatorCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Board>
        </section>

        {/* the app leaderboard: DefiLlama TVL, same feed as the Apps facet */}
        <section className="flex min-w-0 flex-col gap-4">
          <SectionHeader
            label="Top apps · TVL"
            action={<BoardLink href="/explorer/mainnet/apps">Apps</BoardLink>}
          />
          <Board divide={false}>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {/* header strip matching the table's thead metrics, so the two
                  boards' hairlines register row for row */}
              <div className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                  App
                </span>
                <span className="w-12 text-right font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                  24h
                </span>
                <span className="w-16 text-right font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                  TVL
                </span>
              </div>
              {topApps === null &&
                Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="flex items-center px-5 py-3">
                    <span className="block h-5 w-3/4 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                  </div>
                ))}
              {topApps?.map((a, i) => (
                <Link
                  key={a.slug}
                  href={`/stats/dapps/${a.slug}`}
                  className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <span className="w-5 shrink-0 font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {a.logo ? (
                    <img src={a.logo} alt="" className="h-5 w-5 shrink-0 rounded-full object-contain" />
                  ) : (
                    <span className="h-5 w-5 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5 text-[#0061E2] group-hover:underline dark:text-[#5f9dff]">
                    {a.name}
                  </span>
                  <span
                    className={cn(
                      "w-12 shrink-0 text-right font-mono text-[11px] tabular-nums",
                      typeof a.change_1d !== "number"
                        ? "text-zinc-400 dark:text-zinc-600"
                        : a.change_1d >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-[#E6212F]",
                    )}
                  >
                    {typeof a.change_1d === "number"
                      ? `${a.change_1d >= 0 ? "+" : ""}${a.change_1d.toFixed(1)}%`
                      : "—"}
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-[12px] tabular-nums text-zinc-700 dark:text-zinc-300">
                    {fmtUsd(a.tvl)}
                  </span>
                </Link>
              ))}
            </div>
          </Board>
        </section>
        </div>

        {/* the two network-level instruments as doors into their facets —
            brand-dark panels in the homepage pillars' grammar: steel
            eyebrow, EBF0FA lead with the red punch, red arrow chip */}
        <div className="grid items-stretch gap-x-8 gap-y-10 lg:grid-cols-2">
          <section className="flex flex-col">
            <DoorPanel
              href="/explorer/mainnet/validators"
              lead={fmtAvax(supply?.totalStaked)}
              punch="at stake."
              specs={[
                {
                  label: "Validators",
                  value: agg ? agg.totalValidators.toLocaleString("en-US") : null,
                },
                { label: "Staked · of circulating", value: stakingRatio },
              ]}
            />
          </section>
          <section className="flex flex-col">
            <DoorPanel
              href="/explorer/mainnet/token"
              lead={feesBurned ? `${compact.format(feesBurned)} AVAX` : null}
              punch="burned forever."
              specs={[
                { label: "Circulating supply", value: fmtAvax(supply?.circulatingSupply) },
                {
                  label: "Price",
                  value: supply?.price
                    ? `$${supply.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : null,
                },
              ]}
            />
          </section>
        </div>
      </div>
    </NetworkShell>
  );
}
