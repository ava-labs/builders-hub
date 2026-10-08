"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePolledJson, useRememberedJson } from "@/components/explorer-v2/page-data";
import { SectionHeader } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { NetworkStatsBody } from "@/components/explorer-v2/network/NetworkStats";
import { useExplorerTimeRange, RANGE_DAYS, RANGE_LABEL, type ExplorerRange } from "@/components/explorer-v2/time-range";
import { pchainApiPath, type PchainNetwork, type Stats } from "@/lib/pchain-explorer";
import { getPrimaryTotalStake } from "@/lib/pchain-node";
import type { DAppsMetrics } from "@/types/dapps";
import { OverviewLiveBoards } from "./overview-live";
import { DAPPS_URL, SUPPLY_URL, overviewStatsUrl, overviewWindow, rosterOf, type LiveChain } from "./network-reads";
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
   picked in the subnav. Mainnet and Fuji each read their own chains. */

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

function overviewWindowLabel(range: ExplorerRange): string {
  return range === "all" ? `${RANGE_LABEL.year} · longest window` : RANGE_LABEL[range];
}

const num = (v: string | undefined) => {
  const n = v ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/* a figure no feed has on this network: zinc-500, which reads on white (zinc-400 does not) and on the dark ground */
const NO_DATA = <span className="text-zinc-500">No data</span>;

export function NetworkOverview({ network = "mainnet" }: { network?: PchainNetwork }) {
  // the shared clock: registers this page as a consumer, so the subnav
  // surfaces its range control and every reading below tracks the one pick
  const range = useExplorerTimeRange();
  const days = RANGE_DAYS[overviewWindow(range)];
  // each feed opens from memory (a range seen before, a hovered link's read) while it is read again
  const { data, error } = usePolledJson<OverviewData>(overviewStatsUrl(range, network));

  // the figures' pasts: sparks and moves against the previous window
  const series = useNetworkSeries(days, network);

  const agg = data?.aggregated;

  /* throughput now, over every chain the server's pulse reads: the live
     feed rates the chains it watches once it covers 15 seconds of each,
     and the pulse rates the rest. True from the first paint, and it moves
     as the network does, instead of a window average sitting still */
  const pulse = useChainPulse(network);
  const [liveRates, setLiveRates] = useState<Map<string, number> | null>(null);
  // a chain no RPC reads counts at its average over the window
  const averages = useMemo(
    () => new Map((data?.chains ?? []).flatMap((c) => (c.tps !== null ? [[String(c.chainId), c.tps] as const] : []))),
    [data],
  );
  const liveTps = useMemo(() => networkTps(pulse, liveRates, averages), [pulse, liveRates, averages]);


  /* the live boards' roster: the busiest RPC-backed chains, latched to the
     first load so flipping the range doesn't reset a live feed. null until
     the feed answers */
  const liveChainsRef = useRef<{ network: PchainNetwork; chains: LiveChain[] } | null>(null);
  const liveChains = useMemo<LiveChain[] | null>(() => {
    const held = liveChainsRef.current;
    if (held?.network === network) return held.chains;
    if (!data) return null;
    const roster = rosterOf(data.chains ?? [], network);
    if (roster.length > 0) liveChainsRef.current = { network, chains: roster };
    return roster;
  }, [data, network]);


  // throughput by day: each day's transactions over its seconds
  const tpsSpark = series && days >= SPARK_MIN_DAYS ? series.txCount.slice(-days).map((p) => p.v / 86_400) : undefined;

  // coverage, stated once above the figures it limits
  const coverage =
    data?.coverage && data.coverage.indexed < data.coverage.total
      ? `activity from ${data.coverage.indexed} of ${data.coverage.total} chains`
      : undefined;
  const tps = liveTps ?? (agg && agg.contributors?.txCount !== 0 ? agg.totalTps : null);

  return (
    <NetworkShell network={network}>
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
          {network === "fuji" ? <FujiReadouts /> : <MainnetReadouts days={days} />}
        </ReadoutRow>

        {/* below lg the city is a district browser with no Versions lens:
            each set's AvalancheGo versions stand here instead, one tap in */}
        <L1Versions className="lg:hidden" network={network} />

        {/* the C-Chain home's live boards, merged across the busiest
            chains: each row wears the logo of the chain it came from.
            If the feed fails, there is no roster and the boards do not show. */}
        {(liveChains || !error) && (
          <OverviewLiveBoards key={network} chains={liveChains} network={network} onRates={setLiveRates} />
        )}

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
          <NetworkStatsBody network={network} />
        </section>
      </div>
    </NetworkShell>
  );
}

/* Mainnet's other figures: the C-Chain's DeFi, the stake and the burn,
   each from its own feed, the last two with their pasts */
function MainnetReadouts({ days }: { days: number }) {
  const supply = useRememberedJson<SupplyData>(SUPPLY_URL);
  // DeFi on the C-Chain
  const { data: dapps, loading: defiLoading } = usePolledJson<{ metrics?: DAppsMetrics }>(DAPPS_URL);
  const defi = dapps?.metrics;
  const stake = useStakeHistory();
  const burn = useBurnHistory();

  const staked = num(supply?.totalStaked);
  const circulating = num(supply?.circulatingSupply);
  const burned = supply
    ? (num(supply.totalCBurned) ?? 0) + (num(supply.totalPBurned) ?? 0) + (num(supply.totalXBurned) ?? 0) || null
    : null;

  const stakeWin = levelWindow(stake, days);
  const burnWin = levelWindow(burn, days);

  return (
    <>
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
    </>
  );
}

/* the Primary Network's stake now, in nAVAX, from the network's P-Chain
   node: undefined while the node is asked, null when it gives no answer */
function usePrimaryStake(network: PchainNetwork): number | null | undefined {
  const [stake, setStake] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void getPrimaryTotalStake(network).then((n) => {
      if (!cancelled) setStake(n);
    });
    return () => {
      cancelled = true;
    };
  }, [network]);
  return stake;
}

/* Fuji's other figures. Test tokens have no price and no feed counts
   Fuji's burns, so TVL and Burned say so in place. The stake is the
   P-Chain's own figure now: Fuji keeps no stake history, so it has no
   move and no spark */
function FujiReadouts() {
  const stake = usePrimaryStake("fuji");
  // the P-Chain's supply, in nAVAX like the stake
  const stats = useRememberedJson<Stats>(pchainApiPath("fuji", "stats"));
  const supply = num(stats?.currentSupply);

  return (
    <>
      <Readout label="TVL" value={NO_DATA} sub="Test tokens have no price" />
      <Readout
        label="Staked"
        href="/explorer/fuji/p-chain/validators"
        value={stake === undefined ? null : stake !== null ? fmtCompact(stake / 1e9) : NO_DATA}
        // the unit only follows a number: a failed read says "No data", with no unit
        unit={typeof stake === "number" ? "AVAX" : undefined}
        sub={stake && supply ? `${((stake / supply) * 100).toFixed(1)}% of supply` : undefined}
      />
      <Readout label="Burned" value={NO_DATA} sub="No feed counts Fuji burns" />
    </>
  );
}
