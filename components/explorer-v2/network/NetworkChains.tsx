"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, ChartBoard, EmptyRow, HEAD, INK, LoadMore, MUTED, ROW, RowSkeleton, SectionHeader } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { useLiveValidatorCounts } from "@/components/explorer-v2/validator-stats";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { BucketBars, CutChip, FigureToggle, FilterInput, ViewSwitch, type Bucket } from "@/components/explorer-v2/network/chains-bucket-bars";
import { fmtCompact } from "@/components/explorer-v2/staking/data";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import l1ChainsData from "@/constants/l1-chains.json";
import { toStatsChainId } from "@/lib/dedicated-stats";
import type { L1Chain } from "@/types/stats";

/* The chain directory: every catalog chain with the three things a builder
   needs from a list like this: where the explorer is, what the RPC is, and
   one click into a wallet. The figures and the chart lead so the list has a
   way in: each one cuts the list, and the cut shows as chips over it. */

const REQUEST_INDEXING_FORM_URL = "https://forms.gle/N4QkRo9UR45xeTTp9";
const PAGE = 25;

type NetFilter = "mainnet" | "testnet";
type View = "category" | "size" | "activity";
type SortKey = "validators" | "tx" | "name";

/* what the list is cut to; the parts AND together */
interface Cut {
  category?: string;
  size?: string;
  activity?: string;
  explorer?: boolean;
  active?: boolean;
}

const UNCATEGORIZED = "Uncategorized";
const categoryOf = (c: L1Chain) => c.category || UNCATEGORIZED;

/* validator-count buckets; the inactive one only shows with inactive chains */
const SIZE_EDGES = [
  { key: "0", label: "No validators", min: 0, max: 0 },
  { key: "1", label: "1", min: 1, max: 1 },
  { key: "2-4", label: "2–4", min: 2, max: 4 },
  { key: "5-9", label: "5–9", min: 5, max: 9 },
  { key: "10-49", label: "10–49", min: 10, max: 49 },
  { key: "50+", label: "50+", min: 50, max: Infinity },
];
const sizeOf = (n: number) => SIZE_EDGES.find((e) => n >= e.min && n <= e.max)?.key ?? "0";

/* 24h transaction buckets; a chain we do not index has no reading */
const ACTIVITY_EDGES = [
  { key: "none", label: "Not indexed" },
  { key: "idle", label: "Idle" },
  { key: "low", label: "1–99 tx" },
  { key: "mid", label: "100–10K tx" },
  { key: "high", label: "10K+ tx" },
];
function activityOf(tx: number | null | undefined): string {
  if (tx === null || tx === undefined) return "none";
  if (tx === 0) return "idle";
  if (tx < 100) return "low";
  if (tx < 10_000) return "mid";
  return "high";
}
const labelOf = (edges: { key: string; label: string }[], key: string) => edges.find((e) => e.key === key)?.label ?? key;

interface Activity {
  tx: number | null;
  addresses: number | null;
}

/* each chain's last 24 hours, from the same aggregate the network
   overview reads. Mainnet only; a failed feed leaves the column dashed. */
function useChainActivity() {
  const [byId, setById] = useState<Map<string, Activity> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/overview-stats?timeRange=day", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { chains?: { chainId: string; txCount: number | null; activeAddresses: number | null }[] }) => {
        setById(new Map((d.chains ?? []).map((c) => [String(c.chainId), { tx: c.txCount, addresses: c.activeAddresses }])));
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, []);
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
const GRID = "md:grid-cols-[minmax(0,1fr)_7rem_4.5rem_5.5rem_5.5rem_minmax(0,13rem)_15rem]";

export function NetworkChains({
  indexedChainIds = null,
}: {
  indexedChainIds?: string[] | null;
} = {}) {
  const [q, setQ] = useState("");
  const [net, setNet] = useState<NetFilter>("mainnet");
  const [showInactive, setShowInactive] = useState(false);
  const [view, setView] = useState<View>("category");
  const [cut, setCut] = useState<Cut>({});
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "validators", dir: -1 });
  const [shown, setShown] = useState(PAGE);
  const listRef = useRef<HTMLElement>(null);
  // the liveness gate, same rule (and same request) as the chain switcher:
  // a mainnet chain earns a default row only if its subnet has stake-backed
  // validators right now. The feed failing open beats an empty directory.
  const { live, failed } = useLiveValidatorCounts();
  const activity = useChainActivity();
  const mainnet = net === "mainnet";
  const settled = Boolean(live || failed || showInactive);

  const indexedSet = useMemo(() => (indexedChainIds ? new Set(indexedChainIds) : null), [indexedChainIds]);
  const isIndexedByUs = (c: L1Chain) => (indexedSet ? indexedSet.has(toStatsChainId(String(c.chainId))) : c.isIndexed !== false);
  const validatorsOf = (c: L1Chain) => (c.subnetId && live?.get(c.subnetId)) || 0;
  const txOf = (c: L1Chain) => activity.byId?.get(String(c.chainId))?.tx ?? null;

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
      sort.key === "name" ? c.chainName.toLowerCase() : sort.key === "tx" ? (txOf(c) ?? -1) : validatorsOf(c);
    return listed
      .filter((c) => {
        if (query && !(c.chainName.toLowerCase().includes(query) || c.slug.includes(query) || String(c.chainId).includes(query) || categoryOf(c).toLowerCase().includes(query))) return false;
        if (cut.category && categoryOf(c) !== cut.category) return false;
        if (cut.size && sizeOf(validatorsOf(c)) !== cut.size) return false;
        if (cut.activity && activityOf(txOf(c)) !== cut.activity) return false;
        if (cut.explorer && !isIndexedByUs(c)) return false;
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
  }, [listed, query, cut, sort, activity.byId]);

  /** set or clear one part of the cut; a part turned on brings the list into view */
  const cutBy = <K extends keyof Cut>(key: K, value: Cut[K]) => {
    const on = value !== undefined && value !== false && cut[key] !== value;
    setCut((c) => ({ ...c, [key]: on ? value : undefined }));
    setShown(PAGE);
    if (on) requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  /* ---------------------------------------------------------------- */
  /* figures and buckets, all from the uncut directory                 */
  /* ---------------------------------------------------------------- */

  const figures = useMemo(() => {
    const counts = listed.map(validatorsOf).filter((n) => n > 0).sort((a, b) => a - b);
    const withTx = listed.filter((c) => txOf(c) !== null);
    return {
      explorer: listed.filter(isIndexedByUs).length,
      categories: new Set(listed.map(categoryOf)).size,
      validators: counts.reduce((s, n) => s + n, 0),
      median: counts.length ? counts[Math.floor(counts.length / 2)] : null,
      tx: activity.byId ? withTx.reduce((s, c) => s + (txOf(c) ?? 0), 0) : null,
      addresses: activity.byId ? withTx.reduce((s, c) => s + (activity.byId?.get(String(c.chainId))?.addresses ?? 0), 0) : null,
      active: listed.filter((c) => (txOf(c) ?? 0) > 0).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listed, activity.byId, indexedSet]);

  const buckets = useMemo<Record<View, Bucket[]>>(() => {
    const group = (keyOf: (c: L1Chain) => string) => {
      const m = new Map<string, L1Chain[]>();
      for (const c of listed) m.set(keyOf(c), [...(m.get(keyOf(c)) ?? []), c]);
      return m;
    };
    const names = (cs: L1Chain[] = []) =>
      [...cs].sort((a, b) => validatorsOf(b) - validatorsOf(a)).map((c) => c.chainName);
    const cats = group(categoryOf);
    const sizes = group((c) => sizeOf(validatorsOf(c)));
    const acts = group((c) => activityOf(txOf(c)));
    return {
      // the catch-all bucket goes last, whatever its size
      category: [...cats.entries()]
        .sort(([a, x], [b, y]) => Number(a === UNCATEGORIZED) - Number(b === UNCATEGORIZED) || y.length - x.length || a.localeCompare(b))
        .map(([k, cs]) => ({ key: k, label: k, count: cs.length, names: names(cs) })),
      size: SIZE_EDGES.filter((e) => e.key !== "0" || (sizes.get("0")?.length ?? 0) > 0).map((e) => ({
        key: e.key,
        label: e.key === "0" ? e.label : `${e.label} validators`,
        count: sizes.get(e.key)?.length ?? 0,
        names: names(sizes.get(e.key)),
      })),
      activity: ACTIVITY_EDGES.map((e) => ({
        key: e.key,
        label: e.label,
        count: acts.get(e.key)?.length ?? 0,
        names: names(acts.get(e.key)),
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listed, activity.byId]);

  const topActive = useMemo(
    () =>
      listed
        .map((c) => ({ c, tx: txOf(c) ?? 0 }))
        .filter((r) => r.tx > 0)
        .sort((a, b) => b.tx - a.tx)
        .slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listed, activity.byId],
  );
  const maxTx = topActive[0]?.tx ?? 0;

  const chips: { key: keyof Cut; label: string }[] = [
    cut.category ? { key: "category" as const, label: cut.category } : null,
    cut.size ? { key: "size" as const, label: cut.size === "0" ? "no validators" : `${labelOf(SIZE_EDGES, cut.size)} validators` } : null,
    cut.activity ? { key: "activity" as const, label: labelOf(ACTIVITY_EDGES, cut.activity).toLowerCase() } : null,
    cut.explorer ? { key: "explorer" as const, label: "has an explorer" } : null,
    cut.active ? { key: "active" as const, label: "active in 24h" } : null,
  ].filter((c): c is { key: keyof Cut; label: string } => c !== null);

  const switchNet = (n: NetFilter) => {
    setNet(n);
    setCut({});
    setShown(PAGE);
    if (n === "testnet" && view !== "category") setView("category");
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

  const views: { v: View; label: string }[] = mainnet
    ? [
        { v: "category", label: "Category" },
        { v: "size", label: "Validators" },
        { v: "activity", label: "Activity" },
      ]
    : [{ v: "category", label: "Category" }];
  const pickOf: Record<View, keyof Cut> = { category: "category", size: "size", activity: "activity" };
  const viewPicked = cut[pickOf[view]] as string | undefined;
  // Fuji ships one uncategorized bucket and no validator feed: nothing to chart
  const charted = mainnet || buckets.category.length > 1;

  return (
    <NetworkShell>
      <div className="flex flex-col gap-10">
        {/* the directory at a glance; the figures that can cut the list do */}
        <ReadoutRow>
          <FigureToggle active={false} onClick={cutting ? () => setCut({}) : undefined} title={cutting ? "Show every chain" : undefined}>
            <Readout label={mainnet ? "Chains" : "Fuji Chains"} value={settled ? listed.length.toLocaleString("en-US") : null} sub={`${figures.categories} ${figures.categories === 1 ? "category" : "categories"}`} />
          </FigureToggle>
          <FigureToggle active={!!cut.explorer} onClick={figures.explorer ? () => cutBy("explorer", true) : undefined} title="List the chains this explorer indexes">
            <Readout
              label="With Explorer"
              value={settled ? figures.explorer.toLocaleString("en-US") : null}
              sub={cut.explorer ? <span className="text-[#0061E2] dark:text-[#5f9dff]">listed below</span> : `of ${listed.length.toLocaleString("en-US")}`}
            />
          </FigureToggle>
          <Readout
            label="Validators"
            value={!mainnet ? "—" : live ? fmtCompact(figures.validators) : failed ? "—" : null}
            sub={mainnet && figures.median !== null ? `median ${figures.median} a chain` : undefined}
            href="/explorer/mainnet/validators"
          />
          <FigureToggle active={!!cut.active} onClick={mainnet && figures.active ? () => cutBy("active", true) : undefined} title="List the chains with transactions in the last 24 hours">
            <Readout
              label="Tx · 24h"
              value={!mainnet || activity.failed ? "—" : figures.tx === null ? null : fmtCompact(figures.tx)}
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

        {/* a way into the list: what the chains are, how big, how busy */}
        {charted && (
          <div className={cn("grid grid-cols-1 items-start gap-x-8 gap-y-10", mainnet && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]")}>
            <ChartBoard
              label={view === "category" ? "Chains by Category" : view === "size" ? "Chains by Validators" : "Chains by Activity · 24h"}
              action={views.length > 1 ? <ViewSwitch id="chains-view" value={view} onChange={setView} options={views} /> : undefined}
            >
              {settled ? (
                <BucketBars buckets={buckets[view]} picked={viewPicked} onPick={(k) => cutBy(pickOf[view], k)} />
              ) : (
                <RowSkeleton n={5} />
              )}
            </ChartBoard>
            {mainnet && (
              <ChartBoard label="Most Active · 24h" bodyClassName="p-0">
                {topActive.length ? (
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {topActive.map(({ c, tx }) => (
                      <li key={c.slug}>
                        <Link
                          href={`/explorer/mainnet/${c.slug}`}
                          className="group grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3.5rem] items-center gap-3 px-5 py-2 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <ChainLogo uri={c.chainLogoURI} name={c.chainName} />
                            <span className="truncate text-[12.5px] text-zinc-900 group-hover:text-[#0061E2] dark:text-zinc-100 dark:group-hover:text-[#5f9dff]">{c.chainName}</span>
                          </span>
                          <span className="block h-2 bg-zinc-100 dark:bg-zinc-900">
                            <span className="block h-full border-r border-zinc-700 bg-[#A2AFB2] dark:border-zinc-300" style={{ width: `${Math.max(1, (tx / maxTx) * 100)}%` }} />
                          </span>
                          <span className="text-right font-mono text-[11.5px] tabular-nums text-zinc-700 dark:text-zinc-300">{fmtCompact(tx)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="flex h-40 items-center justify-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                    {activity.failed ? "Feed unavailable" : "Loading…"}
                  </p>
                )}
              </ChartBoard>
            )}
          </div>
        )}

        {/* the list: every figure and bar above can cut it */}
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
          {buckets.category.length > 1 && (
            <div className="-mx-5 flex items-center gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
              {buckets.category.map((b) => {
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

          <Board divide={false} className="border">
            {/* a tablet scrolls the ledger sideways; phones stack, desktops fit */}
            <div className="overflow-x-auto">
              <div className="md:min-w-[62rem] xl:min-w-0">
                <div className={cn(HEAD, GRID, "border-b border-zinc-200 dark:border-zinc-800")}>
                  <span><SortHeader label="Chain" k="name" /></span>
                  <span>Chain ID</span>
                  <span>Token</span>
                  <span className="text-right"><SortHeader label="Validators" k="validators" /></span>
                  <span className="text-right">{mainnet ? <SortHeader label="Tx · 24h" k="tx" /> : "Tx · 24h"}</span>
                  <span>Public RPC</span>
                  <span className="text-right">Connect</span>
                </div>
                {/* validating against the P-Chain: skeleton rows, never a
                    flash of dead chains that then snap away */}
                {!settled && <RowSkeleton n={10} />}
                {settled &&
                  rows.slice(0, shown).map((c) => {
                    const n = validatorsOf(c);
                    const tx = txOf(c);
                    const net = c.isTestnet ? "fuji" : "mainnet";
                    // link only where the explorer has something to show
                    const explorerHref = isIndexedByUs(c) ? `/explorer/${net}/${c.slug}` : null;
                    return (
                      <div
                        key={`${c.slug}-${c.chainId}`}
                        className={cn(ROW, GRID, "grid-cols-[minmax(0,1fr)_auto] border-b border-zinc-100 last:border-b-0 dark:border-zinc-900")}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
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
                            {/* phones: the columns md shows, as one line */}
                            <span className={cn(MUTED, "truncate text-[11px] md:hidden")}>
                              <ChainIdText id={String(c.chainId)} />
                              {c.networkToken?.symbol ? ` · ${c.networkToken.symbol}` : ""}
                              {tx ? ` · ${fmtCompact(tx)} tx` : ""}
                            </span>
                          </span>
                        </span>
                        <span className={cn(INK, "hidden truncate text-[12px] text-zinc-700 md:block dark:text-zinc-300")}>
                          <ChainIdText id={String(c.chainId)} />
                        </span>
                        <span className={cn(INK, "hidden truncate text-[12px] text-zinc-700 md:block dark:text-zinc-300")}>{c.networkToken?.symbol ?? "—"}</span>
                        <span className={cn(n > 0 ? INK : MUTED, "text-right", n === 0 && "text-zinc-300 dark:text-zinc-700")}>{n > 0 ? n.toLocaleString("en-US") : "—"}</span>
                        <span className={cn(tx ? INK : MUTED, "hidden text-right md:block", !tx && "text-zinc-300 dark:text-zinc-700")}>{tx ? fmtCompact(tx) : tx === 0 ? "0" : "—"}</span>
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
                      </div>
                    );
                  })}
                {settled && rows.length === 0 && <EmptyRow>{query || cutting ? "no chains match" : "no chains found"}</EmptyRow>}
              </div>
            </div>
          </Board>
          {settled && shown < rows.length && (
            <LoadMore onClick={() => setShown((s) => s + PAGE)} label={`Load more · ${rows.length - shown} remaining`} />
          )}
        </section>
      </div>
    </NetworkShell>
  );
}
