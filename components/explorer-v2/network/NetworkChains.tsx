"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PRIMARY_NETWORK_ID, useValidatorStats } from "@/components/explorer-v2/validator-stats";
import { compareVersions, defaultVersionTarget, sortVersionsDesc } from "@/components/stats/VersionBreakdown";
import { ExplorerSubnav } from "@/components/explorer-v2/ExplorerSubnav";
import { useCityData, type SizeBy, type VersionMix } from "@/components/explorer-v2/network/icm-map";
import { CityApp, type Height, type Market } from "@/components/explorer-v2/network/city-app";
import { RANGE_LABEL, type ExplorerRange } from "@/components/explorer-v2/time-range";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

/* The chains tab is the city, and the explorer's front door: one app
   under the explorer's subnav, the network map as its canvas and the
   search, the directory, the figures and every chain's links and wallet
   setup inside it (city-app.tsx). On large screens it fills the window
   under the subnav, edge to edge, so a wide screen's margins are city
   too, and the subnav spans the same width; phones get the district
   browser in the page's column. The rest of the explorer stays one click
   away in the subnav. */

/* a set's nodes split by where they stand against the target minor line */
function mixOf(byVersion: Record<string, { nodes: number }>, target: string): VersionMix {
  const t = /^(\d+)\.(\d+)/.exec(target);
  const m: VersionMix = { on: 0, near: 0, stale: 0, unknown: 0 };
  for (const [v, d] of Object.entries(byVersion)) {
    if (v === "Unknown") m.unknown += d.nodes;
    else if (compareVersions(v, target) >= 0) m.on += d.nodes;
    else {
      const x = /^(\d+)\.(\d+)/.exec(v);
      if (x && t && x[1] === t[1] && Number(x[2]) === Number(t[2]) - 1) m.near += d.nodes;
      else m.stale += d.nodes;
    }
  }
  return m;
}

/* the city shows one day: its streets carry the last 24 hours of ICM, and
   its figures count the same day. The explorer's clock does not drive it */
const RANGE: ExplorerRange = "day";

/* each chain's transactions over the window, from the same aggregate the
   network overview reads. A failed feed leaves the figures dashed */
function useChainActivity(range: ExplorerRange) {
  const [byId, setById] = useState<Map<string, number | null> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setById(null);
    fetch(`/api/overview-stats?timeRange=${range}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { chains?: { chainId: string; txCount: number | null }[] }) => setById(new Map((d.chains ?? []).map((c) => [String(c.chainId), c.txCount]))))
      .catch(() => {});
    return () => controller.abort();
  }, [range]);
  return byId;
}

/* AVAX's price and market cap, as the token page reads them; a minute's
   refresh, while the tab is in view */
function useAvaxMarket(): Market | null {
  const [market, setMarket] = useState<Market | null>(null);
  useEffect(() => {
    let controller = new AbortController();
    const read = () => {
      if (document.visibilityState === "hidden") return;
      controller.abort();
      controller = new AbortController();
      fetch("/api/avax-supply", { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((d: { price?: number; priceChange24h?: number; marketCap?: number }) => {
          if (d.price && d.price > 0) setMarket({ price: d.price, change24h: d.priceChange24h ?? null, marketCap: d.marketCap && d.marketCap > 0 ? d.marketCap : null });
        })
        .catch(() => {});
    };
    read();
    const timer = window.setInterval(read, 60_000);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, []);
  return market;
}

/* a large screen gets the canvas; unknown until the page has mounted */
function useWide(): boolean | null {
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return wide;
}

export function NetworkChains({ indexedChainIds = null }: { indexedChainIds?: string[] | null } = {}) {
  const wide = useWide();
  const activity = useChainActivity(RANGE);
  const market = useAvaxMarket();
  const txOf = useCallback((id: string) => (activity ? activity.get(id) ?? null : null), [activity]);

  const [height, setHeight] = useState<Height>("validators");
  // the validator feed by client version: what the city's windows are lit by
  const { subnets } = useValidatorStats();
  const [pickedTarget, setTarget] = useState("");
  const fleet = useMemo(() => {
    const by: Record<string, { nodes: number }> = {};
    for (const sn of subnets ?? []) for (const [v, d] of Object.entries(sn.byClientVersion)) by[v] = { nodes: (by[v]?.nodes ?? 0) + d.nodes };
    return by;
  }, [subnets]);
  const targets = useMemo(() => sortVersionsDesc(Object.keys(fleet)), [fleet]);
  // the newest version with real adoption, not a canary's
  const target = pickedTarget || defaultVersionTarget(fleet);
  /* the city keys chains by EVM chain ID; the C-Chain is the Primary Network's */
  const versions = useMemo(() => {
    if (!subnets) return null;
    const bySubnet = new Map(subnets.map((sn) => [sn.id, mixOf(sn.byClientVersion, target)]));
    const m = new Map<string, VersionMix>();
    for (const c of l1ChainsData as L1Chain[]) {
      if (c.isTestnet || !c.subnetId) continue;
      const mix = bySubnet.get(c.subnetId);
      if (mix) m.set(String(c.chainId), mix);
    }
    const primary = bySubnet.get(PRIMARY_NETWORK_ID);
    if (primary) m.set("43114", primary);
    return m;
  }, [subnets, target]);
  // the heights count validators or messages; the windows are lit by version when the feed is in
  const view: SizeBy = height === "messages" ? "messages" : versions ? "versions" : "validators";
  const data = useCityData({ days: 1, sizeBy: view });

  const app = (isWide: boolean) => (
    <CityApp
      data={data}
      height={height}
      onHeight={setHeight}
      versions={versions}
      target={target}
      targets={targets}
      onTarget={setTarget}
      range={RANGE}
      windowLabel={RANGE_LABEL[RANGE]}
      windowShort="24H"
      market={market}
      txOf={txOf}
      catalog={l1ChainsData as L1Chain[]}
      indexedChainIds={indexedChainIds}
      wide={isWide}
    />
  );

  return (
    <main className="relative flex flex-col bg-white lg:h-[calc(100dvh-var(--fd-banner-height,0px)-3.5rem)] dark:bg-zinc-950">
      {/* on large screens the subnav sits on the app, as wide as the city, its edges on the panel's;
          the app's list switches networks, so the subnav names none */}
      <div className="mx-auto w-full max-w-[90rem] shrink-0 px-5 pt-5 md:px-6 lg:max-w-none lg:px-4 lg:pt-0">
        {/* the city reads one day, so the subnav shows no clock here */}
        <ExplorerSubnav network="mainnet" hideNetwork className="lg:-mx-4 lg:px-4" />
      </div>
      {wide === null ? (
        <div className="min-h-[60vh] flex-1 animate-pulse bg-zinc-50 dark:bg-zinc-900/40" />
      ) : wide ? (
        <div className="relative min-h-0 flex-1">{app(true)}</div>
      ) : (
        <div className="mx-auto w-full max-w-[90rem] px-5 md:px-6">{app(false)}</div>
      )}
    </main>
  );
}
