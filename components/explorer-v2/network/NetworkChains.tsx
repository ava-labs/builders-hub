"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, EmptyRow, HEAD, INK, LoadMore, MUTED, ROW, RowSkeleton, SectionHeader } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { PRIMARY_NETWORK_ID, useLiveValidatorCounts, useValidatorStats } from "@/components/explorer-v2/validator-stats";
import { compareVersions, defaultVersionTarget, sortVersionsDesc } from "@/components/stats/VersionBreakdown";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { CutChip, FigureToggle, FilterInput } from "@/components/explorer-v2/network/chains-bucket-bars";
import { IcmNetworkMap, Tower, type IcmSummary, type VersionMix } from "@/components/explorer-v2/network/icm-map";
import { riseStyle, useReveal } from "@/components/explorer-v2/motion";
import { flowWindow, levelWindow, useNetworkSeries, useSeatHistory } from "@/components/explorer-v2/network/overview-series";
import { EXPLORER_RANGES, RANGE_DAYS, RANGE_LABEL, useExplorerTimeRange, type ExplorerRange } from "@/components/explorer-v2/time-range";
import { fmtCompact } from "@/components/explorer-v2/staking/data";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import l1ChainsData from "@/constants/l1-chains.json";
import { toStatsChainId } from "@/lib/dedicated-stats";
import type { L1Chain } from "@/types/stats";

/* The chains tab: the figures, the network map, and the directory. The map
   draws every validator set and the window's ICM between them; the directory
   carries what a builder needs from a list like this: where the explorer
   is, what the RPC is, and one click into a wallet. Each row leads with its
   tower from the map, to the same scale and painted the same way, and a
   row and its tower light together. A figure, a tower or a category cuts
   the list, and the cut shows as chips over it. */

const REQUEST_INDEXING_FORM_URL = "https://forms.gle/N4QkRo9UR45xeTTp9";
const PAGE = 25;

type NetFilter = "mainnet" | "testnet";
type SortKey = "validators" | "tx" | "msgs" | "name";

/* what the list is cut to; the parts AND together */
interface Cut {
  category?: string;
  /** one chain, picked on the map */
  chain?: string;
  /** chains that sent or got an ICM message in the window */
  talking?: boolean;
  /** chains with nodes on a version below the target */
  behind?: boolean;
  active?: boolean;
}

const UNCATEGORIZED = "Uncategorized";
const categoryOf = (c: L1Chain) => c.category || UNCATEGORIZED;

interface Activity {
  tx: number | null;
  addresses: number | null;
}

/* each chain's activity over the window, from the same aggregate the
   network overview reads. The aggregate stops at a year, so "all" reads
   the year. Mainnet only; a failed feed leaves the column dashed. */
function useChainActivity(range: ExplorerRange) {
  const [byId, setById] = useState<Map<string, Activity> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setById(null);
    setFailed(false);
    fetch(`/api/overview-stats?timeRange=${range === "all" ? "year" : range}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { chains?: { chainId: string; txCount: number | null; activeAddresses: number | null }[] }) => {
        setById(new Map((d.chains ?? []).map((c) => [String(c.chainId), { tx: c.txCount, addresses: c.activeAddresses }])));
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, [range]);
  return { byId, failed };
}

function RpcChip({ rpcUrl }: { rpcUrl: string }) {
  const { copiedId, copyToClipboard } = useCopyToClipboard();
  const isCopied = copiedId === rpcUrl;
  const shown = rpcUrl.replace(/^https?:\/\//, "");
  return (
    <button
      type="button"
      onClick={() => copyToClipboard(rpcUrl, rpcUrl)}
      title={rpcUrl}
      className="group/rpc inline-flex min-w-0 max-w-full items-center gap-1.5 font-mono text-[11px] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      <span className="truncate">{shown}</span>
      {isCopied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 text-zinc-300 transition-colors group-hover/rpc:text-zinc-500 dark:text-zinc-600" />
      )}
    </button>
  );
}

/* Logo with a monogram fallback: many catalog chains ship no logo URI,
   and a few ship dead URLs; both get the chain's initial. */
function ChainLogo({ uri, name }: { uri?: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!uri || broken) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-200 font-mono text-[9px] font-bold uppercase text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {name.charAt(0)}
      </span>
    );
  }
  return <img src={uri} alt="" onError={() => setBroken(true)} className="h-5 w-5 shrink-0 rounded-full object-contain" />;
}

/* ~145 catalog rows carry a base58 blockchain ID instead of an EVM
   number: shown clipped, full value on hover */
function ChainIdText({ id }: { id: string }) {
  if (/^\d+$/.test(id)) return <>{id}</>;
  return (
    <span title={id} className="text-zinc-400 dark:text-zinc-500">
      {id.slice(0, 6)}…{id.slice(-4)}
    </span>
  );
}

/* the square segmented control the directory has always used */
function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; label: string }[] }) {
  return (
    <div className="inline-flex shrink-0 border border-zinc-200 dark:border-zinc-800">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
            o.v === value
              ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Chain | Chain ID | Token | Validators | Tx 24h | RPC | Connect
// Chain | Chain ID | Validators | Version | Tx | ICM | RPC | Connect
const GRID = "md:grid-cols-[minmax(0,1fr)_8rem_5.5rem_7.5rem_5.5rem_5.5rem_minmax(0,13rem)_15rem]";

/* the version fleet's palette, per band */
const BAND_PAINT: Record<keyof VersionMix, string> = { on: "#16a34a", near: "#f59e0b", stale: "#E6212F", unknown: "#a1a1aa" };

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

/* the version share on a phone row: the bar and the figure, inline */
function PhoneVersion({ mix, target }: { mix: VersionMix | null; target: string }) {
  const total = mix ? mix.on + mix.near + mix.stale + mix.unknown : 0;
  if (!mix || !target || total === 0 || mix.unknown === total) return null;
  const pct = Math.round((mix.on / total) * 100);
  const ink = pct >= 80 ? "text-emerald-600 dark:text-emerald-400" : mix.stale > 0 ? "text-[#E6212F]" : "text-amber-600 dark:text-amber-400";
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span className="flex h-1.5 w-10 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {(Object.keys(BAND_PAINT) as (keyof VersionMix)[]).map((b) =>
          mix[b] > 0 ? <span key={b} className="h-full" style={{ width: `${(mix[b] / total) * 100}%`, background: BAND_PAINT[b] }} /> : null,
        )}
      </span>
      <span className={cn("whitespace-nowrap tabular-nums", ink)}>
        {pct}% on {target}
      </span>
    </span>
  );
}

/* the share of a chain's nodes on the target, with the split as a thin stacked bar */
function VersionCell({ mix }: { mix: VersionMix | null }) {
  const total = mix ? mix.on + mix.near + mix.stale + mix.unknown : 0;
  if (!mix || total === 0 || mix.unknown === total) {
    return <span className="hidden font-mono text-[12px] text-zinc-300 md:block dark:text-zinc-700">—</span>;
  }
  const pct = Math.round((mix.on / total) * 100);
  const ink = pct >= 80 ? "text-emerald-600 dark:text-emerald-400" : mix.stale > 0 ? "text-[#E6212F]" : "text-amber-600 dark:text-amber-400";
  return (
    <span className="hidden min-w-0 items-center gap-2 md:flex" title={`${mix.on} on target · ${mix.near + mix.stale} behind · ${mix.unknown} unknown`}>
      <span className="flex h-1.5 min-w-0 flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {(Object.keys(BAND_PAINT) as (keyof VersionMix)[]).map((b) =>
          mix[b] > 0 ? <span key={b} className="h-full" style={{ width: `${(mix[b] / total) * 100}%`, background: BAND_PAINT[b] }} /> : null,
        )}
      </span>
      <span className={cn("w-9 shrink-0 text-right font-mono text-[12px] tabular-nums", ink)}>{pct}%</span>
    </span>
  );
}

/* a row's tower: the map's tower in miniature, as tall as its validator
   set on the map's scale and painted by client version */
function MiniTower({ validators, max, mix, hub, shown, delay, lifted }: { validators: number; max: number; mix: VersionMix | null; hub: boolean; shown: boolean; delay: number; lifted: boolean }) {
  const w = 7;
  const box = 32;
  const d = w * 0.42;
  const h = validators > 0 ? 3 + 21 * Math.pow(validators / Math.max(1, max), 0.4) : 2;
  const y = box - d - 1;
  return (
    <svg width={18} height={box} viewBox={`0 0 18 ${box}`} className="shrink-0 overflow-visible" aria-hidden>
      <g style={{ transform: lifted ? "translateY(-3px)" : "translateY(0)", transition: "transform 220ms cubic-bezier(0.32,0.72,0,1)" }}>
        <g style={riseStyle(shown, delay, 680)}>
          <Tower x={9} y={y} w={w} h={h} tone={hub ? "red" : "gray"} mix={mix && mix.on + mix.near + mix.stale > 0 ? mix : null} />
        </g>
      </g>
    </svg>
  );
}

export function NetworkChains({
  indexedChainIds = null,
}: {
  indexedChainIds?: string[] | null;
} = {}) {
  const [q, setQ] = useState("");
  const [net, setNet] = useState<NetFilter>("mainnet");
  const [showInactive, setShowInactive] = useState(false);
  const [cut, setCut] = useState<Cut>({});
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "validators", dir: -1 });
  const [shown, setShown] = useState(PAGE);
  const [icm, setIcm] = useState<IcmSummary | null>(null);
  const listRef = useRef<HTMLElement>(null);
  // a row and its tower light together, whichever the cursor is on
  const [rowHover, setRowHover] = useState<string | null>(null);
  const [mapHover, setMapHover] = useState<string | null>(null);
  // the rows' towers rise in a wave the first time the list comes into view
  const [dirRef, dirShown] = useReveal<HTMLDivElement>();
  // a new sort or cut glides the rows to their places, unless the reader asked for less motion
  const reduced = useReducedMotion();
  // the liveness gate, same rule (and same request) as the chain switcher:
  // a mainnet chain earns a default row only if its subnet has stake-backed
  // validators right now. The feed failing open beats an empty directory.
  const { live, failed } = useLiveValidatorCounts();
  // the same feed, by client version: what the map paints and the Version column reads
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
  const mixBySubnet = useMemo(() => new Map((subnets ?? []).map((sn) => [sn.id, mixOf(sn.byClientVersion, target)])), [subnets, target]);
  const mixOfChain = (c: L1Chain) => (c.subnetId ? mixBySubnet.get(c.subnetId) ?? null : null);
  /* the map keys chains by EVM chain ID; the C-Chain is the Primary Network's */
  const mixByChainId = useMemo(() => {
    if (!subnets) return null;
    const m = new Map<string, VersionMix>();
    for (const c of l1ChainsData as L1Chain[]) {
      if (c.isTestnet || !c.subnetId) continue;
      const mix = mixBySubnet.get(c.subnetId);
      if (mix) m.set(String(c.chainId), mix);
    }
    const primary = mixBySubnet.get(PRIMARY_NETWORK_ID);
    if (primary) m.set("43114", primary);
    return m;
  }, [subnets, mixBySubnet]);
  const fleetMix = useMemo(() => mixOf(fleet, target), [fleet, target]);
  const fleetNodes = fleetMix.on + fleetMix.near + fleetMix.stale + fleetMix.unknown;
  // the page's clock: the subnav's 1D to ALL drives every window here
  const range = useExplorerTimeRange();
  const days = RANGE_DAYS[range];
  const short = EXPLORER_RANGES.find((r) => r.value === range)?.label ?? "1M";
  // the activity aggregate stops at a year
  const txShort = range === "all" ? "1Y" : short;
  const activity = useChainActivity(range);
  // the figures' pasts: the network's daily rollup and its validator seats
  const series = useNetworkSeries(days);
  const seats = useSeatHistory();
  const mainnet = net === "mainnet";
  const settled = Boolean(live || failed || showInactive);

  const indexedSet = useMemo(() => (indexedChainIds ? new Set(indexedChainIds) : null), [indexedChainIds]);
  const isIndexedByUs = (c: L1Chain) => (indexedSet ? indexedSet.has(toStatsChainId(String(c.chainId))) : c.isIndexed !== false);
  const validatorsOf = (c: L1Chain) => (c.subnetId && live?.get(c.subnetId)) || 0;
  const txOf = (c: L1Chain) => activity.byId?.get(String(c.chainId))?.tx ?? null;
  const msgsOf = (c: L1Chain) => (icm ? icm.byChain.get(String(c.chainId)) ?? 0 : null);

  /* the directory before any cut: network plus liveness */
  const listed = useMemo(
    () =>
      (l1ChainsData as L1Chain[])
        .filter((c) => (net === "testnet" ? c.isTestnet === true : c.isTestnet !== true))
        .filter((c) => {
          // liveness applies to the mainnet view only: Fuji sets are not in
          // the feed, so testnet rows just need a reachable RPC
          if (showInactive || failed || !live) return true;
          if (net === "testnet") return Boolean(c.rpcUrl);
          return validatorsOf(c) > 0;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [net, live, failed, showInactive],
  );

  const query = q.trim().toLowerCase();
  const cutting = Object.values(cut).some(Boolean);
  const rows = useMemo(() => {
    const value = (c: L1Chain): number | string =>
      sort.key === "name" ? c.chainName.toLowerCase() : sort.key === "tx" ? (txOf(c) ?? -1) : sort.key === "msgs" ? (msgsOf(c) ?? -1) : validatorsOf(c);
    return listed
      .filter((c) => {
        if (query && !(c.chainName.toLowerCase().includes(query) || c.slug.includes(query) || String(c.chainId).includes(query) || categoryOf(c).toLowerCase().includes(query))) return false;
        if (cut.category && categoryOf(c) !== cut.category) return false;
        if (cut.chain && c.chainName !== cut.chain) return false;
        if (cut.talking && !((msgsOf(c) ?? 0) > 0)) return false;
        if (cut.behind) {
          const mx = mixOfChain(c);
          if (!mx || mx.near + mx.stale === 0) return false;
        }
        if (cut.active && !((txOf(c) ?? 0) > 0)) return false;
        return true;
      })
      .sort((a, b) => {
        const va = value(a);
        const vb = value(b);
        const d = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
        return d * sort.dir || a.chainName.localeCompare(b.chainName);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listed, query, cut, sort, activity.byId, icm, mixBySubnet]);

  /** set or clear one part of the cut; a part turned on brings the list into view */
  const cutBy = <K extends keyof Cut>(key: K, value: Cut[K]) => {
    const on = value !== undefined && value !== false && cut[key] !== value;
    setCut((c) => ({ ...c, [key]: on ? value : undefined }));
    setShown(PAGE);
    // a pick on the map keeps the map in view; its chip shows the cut
    if (on && key !== "chain") requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  /* ---------------------------------------------------------------- */
  /* figures and buckets, all from the uncut directory                 */
  /* ---------------------------------------------------------------- */

  const figures = useMemo(() => {
    const counts = listed.map(validatorsOf).filter((n) => n > 0).sort((a, b) => a - b);
    const withTx = listed.filter((c) => txOf(c) !== null);
    return {
      categories: new Set(listed.map(categoryOf)).size,
      validators: counts.reduce((s, n) => s + n, 0),
      median: counts.length ? counts[Math.floor(counts.length / 2)] : null,
      tx: activity.byId ? withTx.reduce((s, c) => s + (txOf(c) ?? 0), 0) : null,
      addresses: activity.byId ? withTx.reduce((s, c) => s + (activity.byId?.get(String(c.chainId))?.addresses ?? 0), 0) : null,
      active: listed.filter((c) => (txOf(c) ?? 0) > 0).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listed, activity.byId, indexedSet]);

  // the rows' towers share the map's scale: the biggest set in the list
  const maxValidators = useMemo(() => Math.max(1, ...listed.map(validatorsOf)), [listed, live]);

  /* the category rail over the list; the catch-all goes last, whatever its size */
  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of listed) m.set(categoryOf(c), (m.get(categoryOf(c)) ?? 0) + 1);
    return [...m.entries()]
      .sort(([a, x], [b, y]) => Number(a === UNCATEGORIZED) - Number(b === UNCATEGORIZED) || y - x || a.localeCompare(b))
      .map(([key, count]) => ({ key, label: key, count }));
  }, [listed]);

  // a window too short to draw shows the fortnight behind it
  const sparkOf = (points: { v: number }[] | undefined) =>
    points && points.length >= 2 ? points.slice(-Math.max(days, 14)).map((p) => p.v) : undefined;
  const icmWin = flowWindow(series?.icmMessages, days);
  const seatWin = levelWindow(seats, days);
  const txWin = flowWindow(series?.txCount, range === "all" ? 365 : days);

  const chips: { key: keyof Cut; label: string }[] = [
    cut.category ? { key: "category" as const, label: cut.category } : null,
    cut.chain ? { key: "chain" as const, label: cut.chain } : null,
    cut.talking ? { key: "talking" as const, label: `sent or got ICM · ${short}` } : null,
    cut.behind ? { key: "behind" as const, label: `nodes behind ${target}` } : null,
    cut.active ? { key: "active" as const, label: `active · ${txShort}` } : null,
  ].filter((c): c is { key: keyof Cut; label: string } => c !== null);

  const switchNet = (n: NetFilter) => {
    setNet(n);
    setCut({});
    setShown(PAGE);
  };

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === -1 ? 1 : -1 } : { key, dir: key === "name" ? 1 : -1 }));
    setShown(PAGE);
  };
  const SortHeader = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => {
    const on = sort.key === k;
    return (
      <button type="button" onClick={() => toggleSort(k)} className={cn("whitespace-nowrap uppercase tracking-[0.14em] transition-colors hover:text-zinc-900 dark:hover:text-zinc-100", on && "text-zinc-900 dark:text-zinc-100", className)}>
        {label}
        {on ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
      </button>
    );
  };

  return (
    <NetworkShell>
      <div className="flex flex-col gap-10">
        {/* the network at a glance; the figures that can cut the list do */}
        <ReadoutRow>
          <FigureToggle active={false} onClick={cutting ? () => setCut({}) : undefined} title={cutting ? "Show every chain" : undefined}>
            <Readout label={mainnet ? "Chains" : "Fuji Chains"} value={settled ? listed.length.toLocaleString("en-US") : null} sub={`${figures.categories} ${figures.categories === 1 ? "category" : "categories"}`} />
          </FigureToggle>
          <FigureToggle
            active={!!cut.behind}
            onClick={mainnet && fleetMix.near + fleetMix.stale > 0 ? () => cutBy("behind", true) : undefined}
            title={`List the chains with nodes behind ${target}`}
          >
            <Readout
              label="Validators"
              value={!mainnet ? "—" : live ? fmtCompact(figures.validators) : failed ? "—" : null}
              sub={
                !mainnet || !target || !fleetNodes ? undefined : cut.behind ? (
                  <span className="text-[#0061E2] dark:text-[#5f9dff]">behind {target}, listed below</span>
                ) : (
                  `${((fleetMix.on / fleetNodes) * 100).toFixed(1)}% on ${target}+`
                )
              }
              delta={mainnet ? seatWin.delta : null}
              spark={mainnet ? seatWin.spark ?? sparkOf(seats ?? undefined) : undefined}
            />
          </FigureToggle>
          <FigureToggle active={!!cut.talking} onClick={mainnet && icm?.talking ? () => cutBy("talking", true) : undefined} title={`List the chains that sent or got an ICM message in ${RANGE_LABEL[range]}`}>
            <Readout
              label={`ICM · ${short}`}
              value={!mainnet ? "—" : icm ? fmtCompact(icm.total) : null}
              delta={mainnet ? icmWin.delta : null}
              spark={mainnet ? sparkOf(series?.icmMessages) : undefined}
              sub={
                mainnet && icm ? (
                  cut.talking ? <span className="text-[#0061E2] dark:text-[#5f9dff]">{icm.talking} chains, listed below</span> : `${icm.talking} chains talking`
                ) : undefined
              }
            />
          </FigureToggle>
          <FigureToggle active={!!cut.active} onClick={mainnet && figures.active ? () => cutBy("active", true) : undefined} title={`List the chains with transactions in ${RANGE_LABEL[range === "all" ? "year" : range]}`}>
            <Readout
              label={`Tx · ${txShort}`}
              value={!mainnet || activity.failed ? "—" : figures.tx === null ? null : fmtCompact(figures.tx)}
              delta={mainnet ? txWin.delta : null}
              spark={mainnet ? sparkOf(series?.txCount) : undefined}
              sub={
                mainnet && figures.tx !== null ? (
                  cut.active ? (
                    <span className="text-[#0061E2] dark:text-[#5f9dff]">{figures.active} active, listed below</span>
                  ) : (
                    `${figures.active} chains active`
                  )
                ) : undefined
              }
            />
          </FigureToggle>
        </ReadoutRow>

        {/* the network map is mainnet's: Fuji has no ICM aggregate */}
        {mainnet && (
          <IcmNetworkMap
            days={days}
            windowLabel={RANGE_LABEL[range]}
            picked={cut.chain ?? null}
            onPick={(name) => cutBy("chain", name)}
            onSummary={setIcm}
            versions={mixByChainId}
            target={target}
            targets={targets}
            onTarget={setTarget}
            hoveredName={rowHover}
            onHoverName={setMapHover}
          />
        )}

        {/* the list: every figure and tower above can cut it */}
        <section ref={listRef} className="flex scroll-mt-24 flex-col gap-4">
          <SectionHeader
            label="Directory"
            action={
              <div className="flex min-w-0 items-center gap-3">
                <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 sm:inline dark:text-zinc-500">
                  {!settled ? "…" : query || cutting ? `${rows.length} / ${listed.length}` : `${listed.length} chains`}
                </span>
                <a
                  href={REQUEST_INDEXING_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                >
                  Request a listing
                </a>
              </div>
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            <FilterInput
              value={q}
              onChange={(v) => {
                setQ(v);
                setShown(PAGE);
              }}
              placeholder="Filter by name, chain ID, or category"
            />
            <Segmented
              value={net}
              onChange={switchNet}
              options={[
                { v: "mainnet", label: "Mainnet" },
                { v: "testnet", label: "Fuji" },
              ]}
            />
            <button
              type="button"
              onClick={() => {
                setShowInactive((v) => !v);
                setShown(PAGE);
              }}
              aria-pressed={showInactive}
              className={cn(
                "shrink-0 border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
                showInactive
                  ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900",
              )}
            >
              {showInactive ? "Hiding nothing" : "Include inactive"}
            </button>
          </div>

          {/* categories as a rail: one tap cuts the list to one */}
          {categories.length > 1 && (
            <div className="-mx-5 flex items-center gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
              {categories.map((b) => {
                const on = cut.category === b.key;
                return (
                  <button
                    key={b.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => cutBy("category", b.key)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
                      on
                        ? "border-[#0061E2] bg-[#0061E2] text-white dark:border-[#5f9dff] dark:bg-[#5f9dff] dark:text-zinc-950"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100",
                    )}
                  >
                    {b.label}
                    <span className={cn("tabular-nums", on ? "opacity-80" : "text-zinc-400 dark:text-zinc-500")}>{b.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <CutChip key={c.key} label={c.label} onRemove={() => cutBy(c.key, undefined)} />
              ))}
              {chips.length > 1 && (
                <button type="button" onClick={() => setCut({})} className="px-1 font-mono text-[11px] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
                  Clear
                </button>
              )}
            </div>
          )}

          <div ref={dirRef}>
          <Board divide={false} className="border">
            {/* a tablet scrolls the ledger sideways; phones stack, desktops fit */}
            <div className="overflow-x-auto">
              <div className="md:min-w-[62rem] xl:min-w-0">
                <div className={cn(HEAD, GRID, "border-b border-zinc-200 dark:border-zinc-800")}>
                  <span><SortHeader label="Chain" k="name" /></span>
                  <span>Chain ID</span>
                  <span className="text-right"><SortHeader label="Validators" k="validators" /></span>
                  <span>{mainnet && target ? `On ${target}` : "Version"}</span>
                  <span className="text-right">{mainnet ? <SortHeader label={`Tx · ${txShort}`} k="tx" /> : `Tx · ${txShort}`}</span>
                  <span className="text-right">{mainnet ? <SortHeader label={`ICM · ${short}`} k="msgs" /> : `ICM · ${short}`}</span>
                  <span>Public RPC</span>
                  <span className="text-right">Connect</span>
                </div>
                {/* validating against the P-Chain: skeleton rows, never a
                    flash of dead chains that then snap away */}
                {!settled && <RowSkeleton n={10} />}
                {settled &&
                  rows.slice(0, shown).map((c, i) => {
                    const n = validatorsOf(c);
                    const lit = rowHover === c.chainName || mapHover === c.chainName;
                    const tx = txOf(c);
                    const msgs = mainnet ? msgsOf(c) : null;
                    const net = c.isTestnet ? "fuji" : "mainnet";
                    // link only where the explorer has something to show
                    const explorerHref = isIndexedByUs(c) ? `/explorer/${net}/${c.slug}` : null;
                    return (
                      <motion.div
                        key={`${c.slug}-${c.chainId}`}
                        layout={reduced ? false : "position"}
                        transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                        onMouseEnter={() => setRowHover(c.chainName)}
                        onMouseLeave={() => setRowHover(null)}
                        className={cn(
                          ROW,
                          GRID,
                          "grid-cols-[minmax(0,1fr)_auto] border-b border-zinc-100 transition-colors last:border-b-0 dark:border-zinc-900",
                          lit && "bg-[#0061E2]/[0.04] dark:bg-[#5b9bff]/[0.06]",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <MiniTower
                            validators={n}
                            max={maxValidators}
                            mix={mainnet ? mixOfChain(c) : null}
                            hub={String(c.chainId) === "43114"}
                            shown={dirShown}
                            delay={Math.min(i * 28, 900)}
                            lifted={lit}
                          />
                          <ChainLogo uri={c.chainLogoURI} name={c.chainName} />
                          <span className="flex min-w-0 flex-col md:flex-row md:items-center md:gap-2">
                            {explorerHref ? (
                              <Link href={explorerHref} className="truncate text-[13px] font-medium text-[#0061E2] hover:underline dark:text-[#5f9dff]">
                                {c.chainName}
                              </Link>
                            ) : (
                              <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{c.chainName}</span>
                            )}
                            {c.category && (
                              <span className="hidden shrink-0 border border-zinc-200 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400 lg:inline dark:border-zinc-800 dark:text-zinc-500">
                                {c.category}
                              </span>
                            )}
                            {/* phones: the columns md shows, wrapped rather than cut */}
                            <span className={cn(MUTED, "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] md:hidden")}>
                              <span className="truncate">
                                <ChainIdText id={String(c.chainId)} />
                                {c.networkToken?.symbol ? ` · ${c.networkToken.symbol}` : ""}
                              </span>
                              {tx ? <span className="tabular-nums">{fmtCompact(tx)} tx</span> : null}
                              {msgs ? <span className="tabular-nums">{fmtCompact(msgs)} ICM</span> : null}
                              <PhoneVersion mix={mainnet ? mixOfChain(c) : null} target={target} />
                            </span>
                          </span>
                        </span>
                        <span className={cn(INK, "hidden truncate text-[12px] text-zinc-700 md:block dark:text-zinc-300")}>
                          <ChainIdText id={String(c.chainId)} />
                          {c.networkToken?.symbol && <span className="text-zinc-400 dark:text-zinc-500"> · {c.networkToken.symbol}</span>}
                        </span>
                        <span className={cn(n > 0 ? INK : MUTED, "text-right", n === 0 && "text-zinc-300 dark:text-zinc-700")}>{n > 0 ? n.toLocaleString("en-US") : "—"}</span>
                        <VersionCell mix={mainnet ? mixOfChain(c) : null} />
                        <span className={cn(tx ? INK : MUTED, "hidden text-right md:block", !tx && "text-zinc-300 dark:text-zinc-700")}>{tx ? fmtCompact(tx) : tx === 0 ? "0" : "—"}</span>
                        <span className={cn(msgs ? INK : MUTED, "hidden text-right md:block", !msgs && "text-zinc-300 dark:text-zinc-700")}>{msgs ? fmtCompact(msgs) : "—"}</span>
                        <span className={cn("min-w-0", !c.rpcUrl && "max-md:hidden")}>
                          {c.rpcUrl ? <RpcChip rpcUrl={c.rpcUrl} /> : <span className="text-zinc-300 dark:text-zinc-700">—</span>}
                        </span>
                        <span className="flex items-center justify-end gap-3 whitespace-nowrap md:grid md:grid-cols-[4.5rem_8rem_0.875rem] md:justify-items-end">
                          <Link
                            href={`/explorer/${net}/${c.slug}/accounts`}
                            className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 sm:inline dark:text-zinc-500 dark:hover:text-zinc-100"
                          >
                            Accounts
                          </Link>
                          {c.rpcUrl ? (
                            <AddToWalletButton
                              rpcUrl={c.rpcUrl}
                              chainName={c.chainName}
                              chainId={Number.isFinite(Number(c.chainId)) ? Number(c.chainId) : undefined}
                              tokenSymbol={c.networkToken?.symbol}
                              variant="ghost"
                              className="gap-1.5! rounded-none! px-2! py-1! font-mono text-[11px]! font-medium!"
                            />
                          ) : (
                            <span className="hidden md:block" />
                          )}
                          {explorerHref ? (
                            <Link href={explorerHref} aria-label={`${c.chainName} explorer`} className="group/go hidden md:inline-flex">
                              <ArrowRight className="h-3.5 w-3.5 text-zinc-300 transition-all group-hover/go:translate-x-0.5 group-hover/go:text-zinc-900 dark:text-zinc-600 dark:group-hover/go:text-zinc-100" />
                            </Link>
                          ) : (
                            <span className="hidden md:block" />
                          )}
                        </span>
                      </motion.div>
                    );
                  })}
                {settled && rows.length === 0 && <EmptyRow>{query || cutting ? "no chains match" : "no chains found"}</EmptyRow>}
              </div>
            </div>
          </Board>
          </div>
          {settled && shown < rows.length && (
            <LoadMore onClick={() => setShown((s) => s + PAGE)} label={`Load more · ${rows.length - shown} remaining`} />
          )}
        </section>
      </div>
    </NetworkShell>
  );
}
