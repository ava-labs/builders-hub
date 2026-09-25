"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { ChainCosmosData, ICMFlowRoute } from "@/components/stats/NetworkDiagram";
import { Board, SectionHeader } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { NetworkBlockTape, type TapeFeedChain } from "@/components/explorer-v2/network/NetworkBlockTape";
import { useExplorerTimeRange, RANGE_DAYS, RANGE_LABEL, type ExplorerRange } from "@/components/explorer-v2/time-range";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";
import { OverviewChains, type OverviewChain } from "./overview-chains";
import { OverviewApps } from "./overview-apps";
import {
  SPARK_MIN_DAYS,
  flowWindow,
  fmtCompact,
  levelWindow,
  useBurnHistory,
  useNetworkSeries,
  usePriceHistory,
  useSeatHistory,
  useStakeHistory,
} from "./overview-series";

/* The All Networks overview, in the C-Chain home's grammar: the pulse as
   a row of readouts, the live tape merged across chains, the window's
   figures with their moves, the network map, then the chains and apps as
   ranked lists the strips above them can cut. The page-level time range
   comes from the explorer's shared clock, picked in the subnav. */

interface ChainRow extends OverviewChain {
  tps: number | null;
}

const metricDesc = (a: number | null, b: number | null) => (b ?? -1) - (a ?? -1);

interface OverviewData {
  chains: ChainRow[];
  coverage?: { indexed: number; total: number };
  aggregated: {
    totalTxCount: number;
    totalTps: number;
    totalActiveAddresses: number;
    totalICMMessages: number;
    totalValidators: number;
    activeL1Count: number;
    contributors?: { txCount: number; activeAddresses: number; icmMessages: number };
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
  // when the figures landed: the anchor the live tx counter counts from
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

/* the cosmos map: a 1.6k-line canvas, so it only loads on the client
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

/* catalog lookups so activity rows link into each chain's own explorer */
const catalogByChainId = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true).map((c) => [String(c.chainId), c]),
);
function BoardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      {children}
      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

const num = (v: string | undefined) => {
  const n = v ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function NetworkOverview() {
  // the shared clock: registers this page as a consumer, so the subnav
  // surfaces its range control and every reading below tracks the one pick
  const range = useExplorerTimeRange();
  const clamped = overviewWindow(range);
  const days = RANGE_DAYS[clamped];
  const { data, fetchedAt, refreshing } = useOverviewStats(clamped);
  const supply = useAvaxSupply();

  // the figures' pasts: sparks and moves against the previous window
  const series = useNetworkSeries(days);
  const prices = usePriceHistory(days);
  const seats = useSeatHistory();
  const stake = useStakeHistory();
  const burn = useBurnHistory();

  const agg = data?.aggregated;

  /* the tx counter runs forward from its fetch anchor at the window's own
     rate: the count IS rising at ~tps/s, the API just snapshots it. A 2s
     tick re-renders so the figure keeps counting. */
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 2_000);
    return () => clearInterval(id);
  }, []);
  const liveTxCount =
    agg && fetchedAt
      ? Math.round(agg.totalTxCount + (agg.totalTps * (Date.now() - fetchedAt)) / 1000)
      : null;

  /* real throughput measured off the block tape's stream: moves as the
     network does, instead of a window average sitting still */
  const [liveTps, setLiveTps] = useState<number | null>(null);

  const { flows, failedChainIds } = useIcmFlowRoutes();

  /* the tape's roster: the busiest RPC-backed chains, latched to the first
     load so flipping the range doesn't reset a live feed */
  const tapeChainsRef = useRef<TapeFeedChain[]>([]);
  const tapeChains = useMemo<TapeFeedChain[]>(() => {
    if (tapeChainsRef.current.length > 0) return tapeChainsRef.current;
    const roster = (data?.chains ?? [])
      .slice()
      .sort((a, b) => metricDesc(a.txCount, b.txCount))
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
          activeAddresses: (c.activeAddresses ?? 0) > 0 ? c.activeAddresses! : undefined,
          txCount: (c.txCount ?? 0) > 0 ? Math.round(c.txCount!) : undefined,
          icmMessages: (c.icmMessages ?? 0) > 0 ? Math.round(c.icmMessages!) : undefined,
          tps: (c.tps ?? 0) > 0 ? parseFloat(c.tps!.toFixed(2)) : undefined,
          category: catalog?.category || "General",
        } as ChainCosmosData;
      })
      .filter((c): c is ChainCosmosData => c !== null)
      .sort((a, b) => b.validatorCount - a.validatorCount);
  }, [data]);

  const staked = num(supply?.totalStaked);
  const circulating = num(supply?.circulatingSupply);
  const burned = supply
    ? (num(supply.totalCBurned) ?? 0) + (num(supply.totalPBurned) ?? 0) + (num(supply.totalXBurned) ?? 0) || null
    : null;

  const txWin = flowWindow(series?.txCount, days);
  const addrWin = flowWindow(series?.activeAddresses, days);
  const icmWin = flowWindow(series?.icmMessages, days);
  const seatWin = levelWindow(seats, days);
  const stakeWin = levelWindow(stake, days);
  const burnWin = levelWindow(burn, days);
  // throughput by day: each day's transactions over its seconds
  const tpsSpark = series && days >= SPARK_MIN_DAYS ? series.txCount.slice(-days).map((p) => p.v / 86_400) : undefined;
  const priceSpark = prices ? prices.slice(-Math.max(days, SPARK_MIN_DAYS)) : undefined;
  const priceMove =
    days <= 1
      ? supply && Number.isFinite(supply.priceChange24h) ? supply.priceChange24h : null
      : supply?.price && priceSpark && priceSpark[0] > 0 ? (supply.price / priceSpark[0] - 1) * 100 : null;

  // coverage, stated once above the figures it limits
  const coverage =
    data?.coverage && data.coverage.indexed < data.coverage.total
      ? `activity from ${data.coverage.indexed} of ${data.coverage.total} chains`
      : undefined;
  const aggValue = (v: number | undefined, contributors: number | undefined) =>
    agg === undefined || v === undefined ? null : contributors === 0 ? "—" : fmtCompact(v);
  const tps = liveTps ?? (agg && agg.contributors?.txCount !== 0 ? agg.totalTps : null);

  return (
    <NetworkShell>
      <div className="flex flex-col gap-12">
        {/* the pulse: what is true this second */}
        <ReadoutRow>
          <Readout
            label="Throughput"
            live
            value={tps !== null ? (tps >= 100 ? Math.round(tps).toLocaleString("en-US") : tps.toFixed(1)) : agg ? "—" : null}
            unit="TPS"
            // live against the window: a quiet minute next to a busy month reads as normal
            sub={
              liveTps !== null && tpsSpark?.length
                ? `now · ${(tpsSpark.reduce((a, v) => a + v, 0) / tpsSpark.length).toFixed(1)} avg over ${tpsSpark.length}d`
                : agg
                  ? "window average"
                  : undefined
            }
            spark={tpsSpark}
          />
          <Readout
            label="AVAX Price"
            live
            href="/explorer/mainnet/token"
            value={supply ? (supply.price ? `$${supply.price.toFixed(2)}` : "—") : null}
            delta={priceMove}
            spark={priceSpark}
          />
          <Readout
            label="Staked"
            href="/explorer/mainnet/validators"
            value={supply ? (staked ? fmtCompact(staked) : "—") : null}
            unit="AVAX"
            sub={staked && circulating ? `${((staked / circulating) * 100).toFixed(1)}% of supply` : undefined}
            delta={stakeWin.delta}
            spark={stakeWin.spark}
          />
          <Readout
            label="Burned"
            href="/explorer/mainnet/token"
            value={supply ? (burned ? fmtCompact(burned) : "—") : null}
            unit="AVAX"
            sub="all chains, to date"
            delta={burnWin.delta}
            spark={burnWin.spark}
          />
        </ReadoutRow>

        {/* the live tape: the same instrument every chain page runs, here
            merged across the busiest chains, each block wearing the logo of
            the chain that sealed it */}
        <NetworkBlockTape chains={tapeChains} onTps={setLiveTps} />

        {/* the window's figures, each with its move against the window before */}
        <section className="flex flex-col gap-4">
          <SectionHeader
            label="Network Stats"
            action={
              <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                {overviewWindowLabel(range)}
                {coverage && <span className="hidden font-normal tracking-[0.08em] sm:inline"> · {coverage}</span>}
              </span>
            }
          />
          <div className={refreshing && data ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <ReadoutRow cols={5}>
              <Readout
                label="Transactions"
                live
                href="/stats/network-metrics"
                value={liveTxCount !== null ? aggValue(liveTxCount, agg?.contributors?.txCount) : null}
                delta={txWin.delta}
                spark={txWin.spark}
              />
              <Readout
                label="Active Addresses"
                href="/stats/network-metrics"
                value={aggValue(agg?.totalActiveAddresses, agg?.contributors?.activeAddresses)}
                delta={addrWin.delta}
                spark={addrWin.spark}
              />
              <Readout
                label="ICM Messages"
                href="/explorer/mainnet/icm"
                value={aggValue(agg?.totalICMMessages, agg?.contributors?.icmMessages)}
                delta={icmWin.delta}
                spark={icmWin.spark}
              />
              <Readout
                label="Validators"
                href="/explorer/mainnet/validators"
                value={agg ? agg.totalValidators.toLocaleString("en-US") : null}
                sub="Primary and L1 seats"
                delta={seatWin.delta}
                spark={seatWin.spark}
              />
              <Readout
                label="Active L1s"
                href="/explorer/mainnet/chains"
                value={agg ? String(agg.activeL1Count) : null}
                sub="per the P-Chain"
              />
            </ReadoutRow>
          </div>
        </section>

        {/* the network as a cosmos: every validator set a body, ICM traffic
            as arcs between them. The one dark surface on the sheet */}
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

        {/* the chains and the apps, each a ranked list its strip can cut */}
        <div className="grid grid-cols-1 items-start gap-x-8 gap-y-12 lg:grid-cols-2">
          <OverviewChains chains={data?.chains ?? null} windowLabel={overviewWindowLabel(range)} />
          <OverviewApps />
        </div>
      </div>
    </NetworkShell>
  );
}
