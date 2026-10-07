"use client";

import { useEffect, useMemo, useState } from "react";
import { usePchainPulse, type PchainPulse } from "@/components/explorer-v2/network/pchain-pulse";
import { useNewcomers, type Newcomer, type Site } from "@/components/explorer-v2/network/newcomers";
import { GUEST_LOGOS } from "@/components/explorer-v2/network/guest-logos";
import { HUB_PLINTH } from "@/components/explorer-v2/network/hub-tower";
import { HUB_W, TILT } from "@/components/explorer-v2/network/city-geometry";
import { planCity, streetRoute, turn, type City, type Stop, type Street } from "@/components/explorer-v2/network/city";
import { districtOf } from "@/components/explorer-v2/network/districts";
import { CITY_REACH, CX, CY, H_MAX, H_MIN, H_TOP_MIN, HUB_ID, validatorHeight, type Node, type Route, type SizeBy } from "@/components/explorer-v2/network/icm-map";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

/* The city's data, apart from the map that draws it (icm-map.tsx): the
   feeds, the catalog that names the chains, and the plan of lots and
   streets that the app and the canvas read. */

/** on the ICM messages scale height grows as the 0.4 power, so the busiest set does not dwarf the rest */
const H_POW = 0.4;

/* the AvaCloud tile stands in for a logo in the registry; the city shows none rather than a stand-in */
// Glacier's AvaCloud placeholders, by file name and by the Contentful asset the newer one is served from
const realLogo = (uri: string) => (uri && !uri.includes("AvaCloud-512x512") && !uri.includes("/62KzIedYATHGgRODAP5Py9/") ? uri : "");

export interface MapChain {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  validatorCount: number | string;
}
interface FlowRoute {
  sourceChainId: string;
  targetChainId: string;
  messageCount: number;
}

/** the Primary Network's subnet, whose set is downtown's */
const PRIMARY_SUBNET = "11111111111111111111111111111111LpoYY";

const catalogByChainId = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true).map((c) => [String(c.chainId), c]),
);

const catalogBySubnet = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true && c.subnetId).map((c) => [String(c.subnetId), c]),
);

/* the chain's ICM feed when it has an RPC, else its accounts */
function chainHref(chainId: string): string | null {
  const c = catalogByChainId.get(chainId);
  if (!c?.slug) return null;
  return c.rpcUrl ? `/explorer/mainnet/${c.slug}/txs/icm` : `/explorer/mainnet/${c.slug}/accounts`;
}

/* a street route on screen: its path, its length, and the point halfway along it */
function onScreen(s: Street): { d: string; length: number; mid: [number, number] } {
  const at = ([r, a]: [number, number]): [number, number] => [CX + r * Math.cos(a), CY + r * Math.sin(a) * TILT];
  const f = (n: number) => n.toFixed(1);
  let d = "";
  const trail: [number, number][] = [];
  s.pts.forEach((p, i) => {
    const [x, y] = at(p);
    if (!i) {
      d = `M${f(x)},${f(y)}`;
      trail.push([x, y]);
      return;
    }
    const prev = s.pts[i - 1];
    if (s.arcs[i - 1]) {
      const dt = turn(p[1] - prev[1]);
      d += ` A${f(p[0])},${f(p[0] * TILT)} 0 0 ${dt > 0 ? 1 : 0} ${f(x)},${f(y)}`;
      for (let k = 1; k <= 12; k++) trail.push(at([p[0], prev[1] + (dt * k) / 12]));
    } else {
      d += ` L${f(x)},${f(y)}`;
      trail.push([x, y]);
    }
  });
  const legs = trail.slice(1).map((p, i) => Math.hypot(p[0] - trail[i][0], p[1] - trail[i][1]));
  const length = legs.reduce((a, b) => a + b, 0);
  let left = length / 2;
  let mid: [number, number] = trail[0] ?? [CX, CY];
  for (let i = 0; i < legs.length; i++) {
    if (left <= legs[i]) {
      const t = legs[i] ? left / legs[i] : 0;
      mid = [trail[i][0] + (trail[i + 1][0] - trail[i][0]) * t, trail[i][1] + (trail[i + 1][1] - trail[i][1]) * t];
      break;
    }
    left -= legs[i];
  }
  return { d, length, mid };
}

export interface IcmSummary {
  /** 30-day messages each chain sent plus got, by EVM chain ID */
  byChain: Map<string, number>;
  /** 30-day messages across every mainnet route */
  total: number;
  /** chains that sent or got a message, the C-Chain included */
  talking: number;
}

/** the city, planned: the chains and their lots, the routes on the streets, the ground's ledger */
export interface CityData {
  /** the chain feed; null while it loads */
  chains: MapChain[] | null;
  failed: boolean;
  nodes: Node[];
  routes: Route[];
  byId: Map<string, Node>;
  city: City;
  summary: IcmSummary;
  pulse: PchainPulse;
  newcomers: Newcomer[];
  /** L1s the P-Chain has created that run no validators yet */
  sites: Site[];
}

/* the city's data: the chains and their validators, the window's ICM
   routes, the P-Chain's ledger and the week's new L1s, planned into lots
   and streets. The app reads it for its panels and lists; the canvas
   draws it. Phones read it without the canvas */
/* the city's feeds, kept for the tab: a return to the page stands the city from its first frame, and a feed that comes
   back as it was changes nothing, so the plan is not made again */
const FEEDS: { chains: { text: string; value: MapChain[] } | null; flows: Map<number, { text: string; value: FlowRoute[] }> } = { chains: null, flows: new Map() };

export function useCityData({ days, sizeBy }: { days: number; sizeBy: SizeBy }): CityData {
  const [chains, setChains] = useState<MapChain[] | null>(() => FEEDS.chains?.value ?? null);
  const [flows, setFlows] = useState<FlowRoute[]>(() => FEEDS.flows.get(days)?.value ?? []);
  const [failed, setFailed] = useState(false);
  // the ground: the P-Chain's latest txs and tip
  const pulse = usePchainPulse("mainnet");
  // the week's new L1s, and every set the P-Chain runs now, from the P-Chain
  const { newcomers, residents, sites } = useNewcomers(pulse.txs);

  useEffect(() => {
    const controller = new AbortController();
    // the chains and their validators; the window only moves the arcs
    fetch("/api/overview-stats?timeRange=month", { signal: controller.signal })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((text) => {
        if (FEEDS.chains?.text === text) return;
        const d = JSON.parse(text) as { chains?: MapChain[] };
        FEEDS.chains = { text, value: d.chains ?? [] };
        setChains(FEEDS.chains.value);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // a failed flow feed is not fatal: the chains still draw, without traffic. Both sides: each direction counted once,
    // when sent or when delivered, so a way into a chain the index does not hold still drives its street
    fetch(`/api/icm-flow?days=${days}&sides=both`, { signal: controller.signal })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((text) => {
        if (FEEDS.flows.get(days)?.text === text) return;
        const d = JSON.parse(text) as { flows?: FlowRoute[] };
        const value = Array.isArray(d.flows) ? d.flows : [];
        FEEDS.flows.set(days, { text, value });
        setFlows(value);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [days]);

  // the heights count messages or validators; the versions lens only paints the windows, so its coming makes no new plan
  const byMessages = sizeBy === "messages";
  const { nodes, routes, city } = useMemo(() => {
    const known = new Map((chains ?? []).map((c) => [String(c.chainId), c]));
    // only routes between mainnet chains the overview knows; the feed mixes in Fuji
    const merged = new Map<string, { from: string; to: string; messages: number }>();
    for (const f of flows) {
      const from = String(f.sourceChainId);
      const to = String(f.targetChainId);
      if (from === to || !known.has(from) || !known.has(to) || !(f.messageCount > 0)) continue;
      const k = `${from}>${to}`;
      const m = merged.get(k);
      if (m) m.messages += f.messageCount;
      else merged.set(k, { from, to, messages: f.messageCount });
    }
    const out = new Map<string, number>();
    const inn = new Map<string, number>();
    for (const r of merged.values()) {
      out.set(r.from, (out.get(r.from) ?? 0) + r.messages);
      inn.set(r.to, (inn.get(r.to) ?? 0) + r.messages);
    }

    // the registry counts every running set too, cached apart from the overview: it stands in when the overview's count is missing
    const residentCount = new Map(residents.map((r) => [r.subnetId, r.validators]));
    const chainOf = new Map(residents.map((r) => [r.subnetId, r.blockchainId]));
    const primary = residentCount.get(PRIMARY_SUBNET);
    const listed = [...known.values()]
      .map((c) => {
        const id = String(c.chainId);
        const subnet = id === HUB_ID ? null : catalogByChainId.get(id)?.subnetId;
        const counted = typeof c.validatorCount === "number" && c.validatorCount > 0 ? c.validatorCount : (id === HUB_ID ? primary : subnet ? residentCount.get(subnet) : undefined) ?? 0;
        return {
          id,
          name: c.chainName,
          // the feed leaves many logos blank; the catalog knows most of them
          logo: realLogo(c.chainLogoURI) || realLogo(catalogByChainId.get(id)?.chainLogoURI ?? ""),
          validators: counted,
          out: out.get(id) ?? 0,
          in: inn.get(id) ?? 0,
          href: chainHref(id),
          color: id === HUB_ID ? "#E6212F" : catalogByChainId.get(id)?.color ?? null,
          district: districtOf(catalogByChainId.get(id)?.category),
          newAt: null as number | null,
          guest: false,
          subnetId: (id === HUB_ID ? PRIMARY_SUBNET : subnet ?? null) as string | null,
          blockchainId: (subnet ? chainOf.get(subnet) ?? null : null) as string | null,
        };
      })
      .filter((c) => c.validators > 0 || c.out + c.in > 0);
    // the week's new L1s: one the map already stands wears the mark on its
    // own tower; the rest stand as guests, from what the P-Chain knows
    const listedIds = new Set(listed.map((c) => c.id));
    const freshAt = new Map<string, number>();
    const guests: typeof listed = [];
    for (const nc of newcomers) {
      const cat = catalogBySubnet.get(nc.subnetId);
      const id = cat ? String(cat.chainId) : null;
      if (id && listedIds.has(id)) {
        freshAt.set(id, nc.joinedAt);
        continue;
      }
      guests.push({
        id: `p:${nc.subnetId}`,
        name: nc.name,
        logo: realLogo(cat?.chainLogoURI ?? "") || (GUEST_LOGOS[nc.subnetId] ?? ""),
        // a join seen live stands on its first validator until the registry counts it
        validators: nc.validators ?? 1,
        out: 0,
        in: 0,
        href: nc.blockchainId ? `/explorer/mainnet/p-chain/chain/${nc.blockchainId}` : nc.tx ? `/explorer/mainnet/p-chain/tx/${nc.tx}` : null,
        color: null,
        // the catalog has not described it yet
        district: districtOf(cat?.category),
        newAt: nc.joinedAt,
        guest: true,
        subnetId: nc.subnetId,
        blockchainId: nc.blockchainId ?? chainOf.get(nc.subnetId) ?? null,
      });
    }
    // every other set the P-Chain runs now stands too, with no NEW mark: a
    // private L1 the catalog does not list stands on the Frontier
    const standing = new Set([...listed.map((c) => catalogByChainId.get(c.id)?.subnetId), ...guests.map((g) => g.id.slice(2))]);
    for (const r of residents) {
      if (standing.has(r.subnetId)) continue;
      const cat = catalogBySubnet.get(r.subnetId);
      guests.push({
        id: `p:${r.subnetId}`,
        name: r.name,
        logo: realLogo(cat?.chainLogoURI ?? "") || (GUEST_LOGOS[r.subnetId] ?? ""),
        validators: r.validators,
        out: 0,
        in: 0,
        href: `/explorer/mainnet/p-chain/chain/${r.blockchainId}`,
        color: null,
        district: districtOf(cat?.category),
        newAt: null,
        guest: true,
        subnetId: r.subnetId,
        blockchainId: r.blockchainId,
      });
    }
    const base = [...listed.map((c) => (freshAt.has(c.id) ? { ...c, newAt: freshAt.get(c.id)! } : c)), ...guests];

    const metric = (c: (typeof base)[number]) => (byMessages ? c.out + c.in : c.validators);
    const top = Math.max(byMessages ? 1 : H_TOP_MIN, ...base.map(metric));
    const height = (c: (typeof base)[number]) => (byMessages ? H_MIN + (H_MAX - H_MIN) * Math.pow(metric(c) / top, H_POW) : validatorHeight(metric(c), top));

    const hub = base.find((c) => c.id === HUB_ID);
    const hubH = hub ? height(hub) : 0;
    const others = base.filter((c) => c.id !== HUB_ID);
    const city = planCity(
      others.map((c) => ({ id: c.id, district: c.district, talks: c.out + c.in, validators: c.validators, newAt: c.newAt })),
      { cx: CX, cy: CY, tilt: TILT, reach: CITY_REACH, hub: { w: HUB_W, h: hubH } },
    );
    // the week's arrivals, newest first, for the order they rise in
    const newRank = new Map(
      others
        .filter((c) => c.newAt !== null)
        .sort((a, b) => b.newAt! - a.newAt!)
        .map((c, k) => [c.id, k]),
    );
    const placed: Node[] = [];
    if (hub) placed.push({ ...hub, x: CX, y: CY, w: HUB_W, h: hubH, role: "hub", district: null, order: 0, reach: 0, newRank: 0 });
    for (const c of others) {
      const lot = city.lots.get(c.id);
      if (!lot) continue;
      const talker = c.out + c.in > 0;
      // a set that talks takes four fifths of its lot, a quiet one three fifths
      placed.push({ ...c, x: lot.x, y: lot.y, w: city.lot * (talker ? 0.4 : 0.31), h: height(c), role: talker ? "talker" : "quiet", order: lot.rank, reach: lot.reach, newRank: newRank.get(c.id) ?? 0 });
    }

    // where each set's traffic starts and ends: its lot, or downtown's plaza
    const downtown: Stop = { r: 0, a: 0, road: city.core, span: null };
    const stopOf = (id: string): Stop | null => (id === HUB_ID ? downtown : city.lots.get(id) ?? null);
    const maxMsgs = Math.max(1, ...[...merged.values()].map((r) => r.messages));
    const drawn: Route[] = [...merged.values()]
      .sort((a, b) => a.messages - b.messages)
      .flatMap((r) => {
        const a = stopOf(r.from);
        const b = stopOf(r.to);
        if (!a || !b) return [];
        // the traffic drives the streets: out of the sender's lot, round and in, to the receiver's
        const street = onScreen(streetRoute(a, b, city.core, HUB_W * HUB_PLINTH[0]));
        const heat = Math.sqrt(r.messages / maxMsgs);
        return [{ key: `${r.from}>${r.to}`, from: r.from, to: r.to, messages: r.messages, d: street.d, width: 0.9 + 2.1 * heat, heat, crown: street.mid, length: street.length }];
      });
    return { nodes: placed, routes: drawn, city };
  }, [chains, flows, byMessages, newcomers, residents]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const summary = useMemo<IcmSummary>(
    () => ({
      byChain: new Map(nodes.map((n) => [n.id, n.out + n.in])),
      total: routes.reduce((t, r) => t + r.messages, 0),
      talking: nodes.filter((n) => n.out + n.in > 0).length,
    }),
    [nodes, routes],
  );
  return { chains, failed, nodes, routes, byId, city, summary, pulse, newcomers, sites };
}
