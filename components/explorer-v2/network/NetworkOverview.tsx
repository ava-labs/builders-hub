"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { recall, remember, useRememberedJson } from "@/components/explorer-v2/page-data";
import { SectionHeader } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { NetworkStatsBody } from "@/components/explorer-v2/network/NetworkStats";
import { useExplorerTimeRange, RANGE_DAYS, RANGE_LABEL, type ExplorerRange } from "@/components/explorer-v2/time-range";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";
import { useDapps } from "@/app/(home)/stats/dapps/_hooks/useDapps";
import { OverviewLiveBoards, type LiveChain } from "./overview-live";
import { useChainPulse } from "./chain-pulse";
import { networkTps } from "./throughput";
import { L1Versions } from "./l1-versions";
import {
  SPARK_MIN_DAYS,
  fmtCompact,
  levelWindow,
  useBurnHistory,
  useNetworkSeries,
  useStakeHistory,
} from "./overview-series";

/* The All Networks overview, in the C-Chain home's grammar: the pulse as
   a row of readouts, the latest blocks and transactions merged across
   chains, the window's figures with their moves, and the network map.
   The page-level time range comes from the explorer's shared clock,
   picked in the subnav. */

/* one chain's row in the overview feed: it drives the live boards and the map */
interface ChainRow {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: number | null;
  activeAddresses: number | null;
  icmMessages: number | null;
  validatorCount: number | string;
  metricsOk?: boolean;
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
  const url = `/api/overview-stats?timeRange=${timeRange}`;
  // a range seen before opens from memory while it is read again
  const [data, setData] = useState<OverviewData | null>(() => recall<OverviewData>(url, false)?.data ?? null);
  // when the figures landed: the anchor the live tx counter counts from
  const [fetchedAt, setFetchedAt] = useState(() => recall<OverviewData>(url, false)?.at ?? 0);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const hit = recall<OverviewData>(url, false);
    if (hit) {
      setData(hit.data);
      setFetchedAt(hit.at);
    }
    setRefreshing(true);
    fetch(url, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: OverviewData) => {
        remember(url, d);
        setData(d);
        setFetchedAt(Date.now());
      })
      .catch(() => {
        /* the previous range's data stands */
      })
      .finally(() => setRefreshing(false));
    return () => controller.abort();
  }, [url]);
  return { data, fetchedAt, refreshing };
}

function useAvaxSupply() {
  return useRememberedJson<SupplyData>("/api/avax-supply");
}

/* catalog lookups so activity rows link into each chain's own explorer */
const catalogByChainId = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true).map((c) => [String(c.chainId), c]),
);

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
  const { data } = useOverviewStats(clamped);
  const supply = useAvaxSupply();
  // DeFi on the C-Chain: DefiLlama's chain TVL, the same feed the DeFi tab reads
  const { metrics: defi, loading: defiLoading } = useDapps();

  // the figures' pasts: sparks and moves against the previous window
  const series = useNetworkSeries(days);
  const stake = useStakeHistory();
  const burn = useBurnHistory();

  const agg = data?.aggregated;

  /* throughput now, over every chain the server's pulse reads: the live
     feed rates the chains it watches once it covers 15 seconds of each,
     and the pulse rates the rest. True from the first paint, and it moves
     as the network does, instead of a window average sitting still */
  const pulse = useChainPulse();
  const [liveRates, setLiveRates] = useState<Map<string, number> | null>(null);
  // a chain no RPC reads counts at its average over the window
  const averages = useMemo(
    () => new Map((data?.chains ?? []).flatMap((c) => (c.tps !== null ? [[String(c.chainId), c.tps] as const] : []))),
    [data],
  );
  const liveTps = useMemo(() => networkTps(pulse, liveRates, averages), [pulse, liveRates, averages]);


  /* the live boards' roster: the busiest RPC-backed chains, latched to the
     first load so flipping the range doesn't reset a live feed */
  const liveChainsRef = useRef<LiveChain[]>([]);
  const liveChains = useMemo<LiveChain[]>(() => {
    if (liveChainsRef.current.length > 0) return liveChainsRef.current;
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
            symbol: catalog.networkToken?.symbol || "",
          },
        ];
      })
      .slice(0, 8);
    if (roster.length > 0) liveChainsRef.current = roster;
    return roster;
  }, [data]);


  const staked = num(supply?.totalStaked);
  const circulating = num(supply?.circulatingSupply);
  const burned = supply
    ? (num(supply.totalCBurned) ?? 0) + (num(supply.totalPBurned) ?? 0) + (num(supply.totalXBurned) ?? 0) || null
    : null;

  const stakeWin = levelWindow(stake, days);
  const burnWin = levelWindow(burn, days);
  // throughput by day: each day's transactions over its seconds
  const tpsSpark = series && days >= SPARK_MIN_DAYS ? series.txCount.slice(-days).map((p) => p.v / 86_400) : undefined;

  // coverage, stated once above the figures it limits
  const coverage =
    data?.coverage && data.coverage.indexed < data.coverage.total
      ? `activity from ${data.coverage.indexed} of ${data.coverage.total} chains`
      : undefined;
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
          {/* no spark: the repo holds no chain-wide TVL history, only per protocol */}
          <Readout
            label="TVL"
            href="/explorer/mainnet/c-chain/defi"
            value={defi?.totalTVL ? `$${fmtCompact(defi.totalTVL)}` : defiLoading ? null : "—"}
            sub={defi?.totalProtocols ? `${defi.totalProtocols.toLocaleString("en-US")} protocols` : undefined}
          />
          <Readout
            label="Staked"
            href="/explorer/mainnet/p-chain/validators"
            value={supply ? (staked ? fmtCompact(staked) : "—") : null}
            unit="AVAX"
            sub={staked && circulating ? `${((staked / circulating) * 100).toFixed(1)}% of circulating` : undefined}
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

        {/* below lg the city is a district browser with no Versions lens:
            each set's AvalancheGo versions stand here instead, one tap in */}
        <L1Versions className="lg:hidden" />

        {/* the C-Chain home's live boards, merged across the busiest
            chains: each row wears the logo of the chain it came from */}
        <OverviewLiveBoards chains={liveChains} onRates={setLiveRates} />

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
          {/* the Stats tab folded in: each reading picks the chart below it */}
          <NetworkStatsBody />
        </section>
      </div>
    </NetworkShell>
  );
}
