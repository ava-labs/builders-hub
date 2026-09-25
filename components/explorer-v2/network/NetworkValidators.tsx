"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, ChartBoard, EmptyRow, HEAD, INK, LoadMore, MUTED, ROW, RowSkeleton, SectionHeader } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { VersionFleet, fleetOf } from "@/components/explorer-v2/staking/VersionFleet";
import { BucketBars, CutChip, FigureToggle, FilterInput, type Bucket } from "@/components/explorer-v2/network/chains-bucket-bars";
import { fmtCompact } from "@/components/explorer-v2/staking/data";
import { compareVersions, defaultVersionTarget, sortVersionsDesc, type VersionBreakdownData } from "@/components/stats/VersionBreakdown";
import { type SubnetStats } from "@/types/validator-stats";
import { PRIMARY_NETWORK_ID, useValidatorStats } from "@/components/explorer-v2/validator-stats";
import type { L1Chain } from "@/types/stats";
import l1ChainsData from "@/constants/l1-chains.json";

/* Every validator set on Mainnet, from the Primary Network down to each
   L1: node counts, and how far each set has caught up to a target client
   version. The figures, the version fleet and the two charts each cut the
   sets table; the cut shows as chips over it. Rows link into each chain's
   own Validators tab. */

const PAGE = 25;

type SortKey = "name" | "nodes" | "nodePct" | "stakePct";

/* what the table is cut to; the parts AND together */
interface Cut {
  version?: string;
  behind?: boolean;
  size?: string;
  adoption?: string;
}

const SIZE_EDGES = [
  { key: "1", label: "1 validator", min: 1, max: 1 },
  { key: "2-4", label: "2–4", min: 2, max: 4 },
  { key: "5-9", label: "5–9", min: 5, max: 9 },
  { key: "10-24", label: "10–24", min: 10, max: 24 },
  { key: "25-99", label: "25–99", min: 25, max: 99 },
  { key: "100+", label: "100+", min: 100, max: Infinity },
];
const sizeOf = (n: number) => SIZE_EDGES.find((e) => n >= e.min && n <= e.max)?.key ?? "1";

/* share of a set's nodes on the target, in the fleet's colors: green at
   or near all, amber partway or none, gray when no node reports. Red
   stays with the versions themselves (older than one minor behind). */
const ADOPTION_EDGES = [
  { key: "all", label: "All on target", paint: "#16a34a" },
  { key: "most", label: "80–99%", paint: "#4ade80" },
  { key: "half", label: "50–79%", paint: "#fcd34d" },
  { key: "some", label: "1–49%", paint: "#fbbf24" },
  { key: "none", label: "None on target", paint: "#f59e0b" },
  { key: "unknown", label: "Not reported", paint: "#a1a1aa" },
];
const labelOf = (edges: { key: string; label: string }[], key: string) => edges.find((e) => e.key === key)?.label ?? key;

interface SetRow {
  subnet: SubnetStats;
  nodes: number;
  /** percent of nodes on the target */
  nodePct: number;
  /** percent of stake on the target */
  stakePct: number;
  /** nodes on a known version below the target */
  behind: number;
  adoption: string;
}

function measure(subnet: SubnetStats, target: string): SetRow {
  let nodes = 0;
  let on = 0;
  let behind = 0;
  let known = 0;
  let onStake = 0n;
  for (const [v, d] of Object.entries(subnet.byClientVersion)) {
    nodes += d.nodes;
    if (v !== "Unknown") known += d.nodes;
    if (v !== "Unknown" && compareVersions(v, target) >= 0) {
      on += d.nodes;
      onStake += BigInt(d.stakeString || "0");
    } else if (v !== "Unknown") {
      behind += d.nodes;
    }
  }
  const total = BigInt(subnet.totalStakeString || "0");
  const nodePct = nodes > 0 ? (on / nodes) * 100 : 0;
  const stakePct = total > 0n ? Number((onStake * 10000n) / total) / 100 : 0;
  const adoption =
    known === 0 ? "unknown" : nodePct >= 100 ? "all" : nodePct >= 80 ? "most" : nodePct >= 50 ? "half" : nodePct > 0 ? "some" : "none";
  return { subnet, nodes, nodePct, stakePct, behind, adoption };
}

/* green at 80% and up, amber below; red only when the set runs a
   version older than one minor behind the target */
function healthInk(pct: number, stale: boolean): string {
  if (pct >= 80) return "text-emerald-600 dark:text-emerald-400";
  return stale ? "text-[#E6212F]" : "text-amber-600 dark:text-amber-400";
}

// Chain | Validators | Nodes on target | Stake on target | Versions | door
const GRID = "md:grid-cols-[minmax(0,1fr)_6rem_6.5rem_6.5rem_minmax(0,14rem)_1.5rem]";

export function NetworkValidators() {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [target, setTarget] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "nodes", dir: -1 });
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [cut, setCut] = useState<Cut>({});
  const listRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const themedLogo = (logoUrl: string): string => {
    if (!isMounted || !logoUrl) return logoUrl;
    // handle both light and dark mode logo variants
    return resolvedTheme === "dark" ? logoUrl.replace(/Light/g, "Dark") : logoUrl.replace(/Dark/g, "Light");
  };

  // the row's per-chain detail target, or null when there's nowhere to go.
  // Primary Network staking lives on the C-Chain's Validators tab.
  const rowHref = (subnet: SubnetStats): string | null => {
    if (subnet.id === PRIMARY_NETWORK_ID) return "/explorer/mainnet/c-chain/validators";
    if (subnet.isL1) {
      const chain = (l1ChainsData as L1Chain[]).find((c) => c.subnetId === subnet.id);
      if (chain && !chain.isTestnet && chain.slug) return `/explorer/mainnet/${chain.slug}/validators`;
    }
    return null;
  };

  // network scope is mainnet-only (the aggregate source doesn't cover Fuji)
  const { subnets, error, loading } = useValidatorStats();
  const data = useMemo(() => subnets ?? [], [subnets]);

  /* the network's fleet. Nodes add up across sets; stake does not (each
     L1 weighs in its own unit), so every set's stake split counts once,
     as a share, and the stake solid reads as the mean set. */
  const network = useMemo<VersionBreakdownData>(() => {
    const by: Record<string, { nodes: number; stake: number }> = {};
    let weighted = 0;
    for (const s of data) {
      const total = Number(BigInt(s.totalStakeString || "0"));
      if (total > 0) weighted++;
      for (const [v, d] of Object.entries(s.byClientVersion)) {
        const share = total > 0 ? Number(BigInt(d.stakeString || "0")) / total : 0;
        by[v] = { nodes: (by[v]?.nodes ?? 0) + d.nodes, stake: (by[v]?.stake ?? 0) + share };
      }
    }
    const SCALE = 1e12;
    return {
      byClientVersion: Object.fromEntries(
        Object.entries(by).map(([v, d]) => [v, { nodes: d.nodes, stakeString: BigInt(Math.round(d.stake * SCALE)).toString() }]),
      ),
      totalStakeString: BigInt(Math.round(weighted * SCALE)).toString(),
    };
  }, [data]);

  const targets = useMemo(() => sortVersionsDesc(Object.keys(network.byClientVersion)), [network]);

  // newest version with real adoption, not the highest one present
  useEffect(() => {
    if (!target && targets.length) {
      const t = defaultVersionTarget(network.byClientVersion);
      if (t) setTarget(t);
    }
  }, [target, targets, network]);

  const fleet = useMemo(() => (target ? fleetOf(network, target) : null), [network, target]);
  const paintOf = useMemo(() => new Map((fleet ?? []).map((f) => [f.version, f.paint])), [fleet]);
  const totalNodes = useMemo(() => (fleet ?? []).reduce((s, f) => s + f.nodes, 0), [fleet]);
  const onNodePct = (fleet ?? []).filter((f) => f.current).reduce((s, f) => s + f.nodePct, 0);
  const onStakePct = (fleet ?? []).filter((f) => f.current).reduce((s, f) => s + (f.stakePct ?? 0), 0);

  // versions older than one minor behind the target: the fleet paints them red
  const stale = useMemo(() => {
    const t = /(\d+)\.(\d+)/.exec(target);
    return new Set(
      (fleet ?? [])
        .filter((f) => {
          const m = /(\d+)\.(\d+)/.exec(f.version);
          if (f.current || !m || !t) return false;
          return !(m[1] === t[1] && Number(m[2]) === Number(t[2]) - 1);
        })
        .map((f) => f.version),
    );
  }, [fleet, target]);
  const sets = useMemo(() => (target ? data.map((s) => measure(s, target)) : []), [data, target]);
  const behindSets = sets.filter((r) => r.behind > 0);
  const behindNodes = behindSets.reduce((s, r) => s + r.behind, 0);
  const l1Nodes = sets.filter((r) => r.subnet.isL1).reduce((s, r) => s + r.nodes, 0);

  const q = query.trim().toLowerCase();
  const cutting = Object.values(cut).some(Boolean);
  const rows = useMemo(() => {
    const value = (r: SetRow): number | string =>
      sort.key === "name" ? r.subnet.name.toLowerCase() : sort.key === "nodePct" ? r.nodePct : sort.key === "stakePct" ? r.stakePct : r.nodes;
    return sets
      .filter((r) => {
        if (q && !r.subnet.name.toLowerCase().includes(q) && !r.subnet.id.toLowerCase().includes(q)) return false;
        if (cut.version && !((r.subnet.byClientVersion[cut.version]?.nodes ?? 0) > 0)) return false;
        if (cut.behind && r.behind === 0) return false;
        if (cut.size && sizeOf(r.nodes) !== cut.size) return false;
        if (cut.adoption && r.adoption !== cut.adoption) return false;
        return true;
      })
      .sort((a, b) => {
        const va = value(a);
        const vb = value(b);
        const d = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
        return d * sort.dir || b.nodes - a.nodes;
      });
  }, [sets, q, cut, sort]);

  /** set or clear one part of the cut; a part turned on brings the table into view */
  const cutBy = <K extends keyof Cut>(key: K, value: Cut[K]) => {
    const on = value !== undefined && value !== false && cut[key] !== value;
    setCut((c) => ({ ...c, [key]: on ? value : undefined }));
    setShown(PAGE);
    if (on) requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const chips: { key: keyof Cut; label: string }[] = [
    cut.version ? { key: "version" as const, label: `runs ${cut.version}` } : null,
    cut.behind ? { key: "behind" as const, label: `nodes behind ${target}` } : null,
    cut.size ? { key: "size" as const, label: cut.size === "1" ? "1 validator" : `${labelOf(SIZE_EDGES, cut.size)} validators` } : null,
    cut.adoption ? { key: "adoption" as const, label: labelOf(ADOPTION_EDGES, cut.adoption).toLowerCase() } : null,
  ].filter((c): c is { key: keyof Cut; label: string } => c !== null);

  const sizeBuckets = useMemo<Bucket[]>(
    () =>
      SIZE_EDGES.map((e) => {
        const members = sets.filter((r) => sizeOf(r.nodes) === e.key).sort((a, b) => b.nodes - a.nodes);
        return { key: e.key, label: e.label, count: members.length, names: members.map((r) => r.subnet.name) };
      }),
    [sets],
  );
  const adoptionBuckets = useMemo<Bucket[]>(
    () =>
      ADOPTION_EDGES.map((e) => {
        const members = sets.filter((r) => r.adoption === e.key).sort((a, b) => b.nodes - a.nodes);
        return { key: e.key, label: e.label, count: members.length, paint: e.paint, names: members.map((r) => r.subnet.name) };
      }),
    [sets],
  );

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === -1 ? 1 : -1 } : { key, dir: key === "name" ? 1 : -1 }));
    setShown(PAGE);
  };
  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => {
    const on = sort.key === k;
    return (
      <button type="button" onClick={() => toggleSort(k)} className={cn("uppercase tracking-[0.14em] transition-colors hover:text-zinc-900 dark:hover:text-zinc-100", on && "text-zinc-900 dark:text-zinc-100")}>
        {label}
        {on ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
      </button>
    );
  };

  const ready = !loading && !error && fleet !== null;

  let content: React.ReactNode;
  if (error) {
    content = (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#E6212F]">Failed to load validator stats</p>
      </div>
    );
  } else if (!loading && data.length === 0) {
    content = (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">No validator data available</p>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-10">
        {/* the sets at a glance; the ones that can cut the table do */}
        <ReadoutRow>
          <FigureToggle active={false} onClick={cutting ? () => setCut({}) : undefined} title={cutting ? "Show every set" : undefined}>
            <Readout label="Validator Sets" value={ready ? data.length.toLocaleString("en-US") : null} sub={ready ? `${data.filter((s) => s.isL1).length} L1s` : undefined} />
          </FigureToggle>
          <Readout
            label="Validators"
            value={ready ? fmtCompact(totalNodes) : null}
            sub={ready ? `${fmtCompact(l1Nodes)} on L1s` : undefined}
          />
          <Readout label="Up to Date" value={ready ? onNodePct.toFixed(1) : null} unit="%" sub={ready ? `of nodes on ${target}+` : undefined} />
          <FigureToggle active={!!cut.behind} onClick={behindSets.length ? () => cutBy("behind", true) : undefined} title={`List the sets with nodes behind ${target}`}>
            <Readout
              label="Sets Behind"
              value={ready ? behindSets.length.toLocaleString("en-US") : null}
              sub={
                ready ? (
                  <span className={cn(cut.behind ? "text-[#0061E2] dark:text-[#5f9dff]" : behindNodes > 0 && "text-amber-600 dark:text-amber-400")}>
                    {behindNodes.toLocaleString("en-US")} nodes behind {target}
                  </span>
                ) : undefined
              }
            />
          </FigureToggle>
        </ReadoutRow>

        {/* what the whole network runs; a version cuts the table to the sets running it */}
        <section>
          {ready && fleet ? (
            <VersionFleet
              fleet={fleet}
              target={target}
              targets={targets}
              onTarget={setTarget}
              stakePct={onStakePct}
              nodePct={onNodePct}
              reporting={totalNodes}
              picked={cut.version ?? null}
              onPick={(v) => cutBy("version", v ?? undefined)}
              // no onGrain: the feed buckets versions to minor lines. Stake is a mean of per-set shares
              stakeLabel="Stake · per set"
            />
          ) : (
            <Board divide={false} className="border">
              <RowSkeleton n={5} />
            </Board>
          )}
        </section>

        {/* the sets by shape: how big, how current */}
        <div className="grid grid-cols-1 items-start gap-x-8 gap-y-10 lg:grid-cols-2">
          <ChartBoard label="Sets by Size">
            {ready ? <BucketBars buckets={sizeBuckets} unit="sets" picked={cut.size} onPick={(k) => cutBy("size", k)} /> : <RowSkeleton n={5} />}
          </ChartBoard>
          <ChartBoard label={`Sets by Adoption · ${target || "…"}`}>
            {ready ? <BucketBars buckets={adoptionBuckets} unit="sets" picked={cut.adoption} onPick={(k) => cutBy("adoption", k)} /> : <RowSkeleton n={5} />}
          </ChartBoard>
        </div>

        {/* the sets: every figure and chart above can cut it */}
        <section ref={listRef} className="flex scroll-mt-24 flex-col gap-4">
          <SectionHeader
            label="Validator Sets"
            action={
              ready ? (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  {q || cutting ? `${rows.length} / ${sets.length}` : `${sets.length} sets`}
                </span>
              ) : undefined
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <FilterInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                setShown(PAGE);
              }}
              placeholder="Filter by name or subnet ID"
            />
            {chips.map((c) => (
              <CutChip key={c.key} label={c.label} onRemove={() => cutBy(c.key, undefined)} />
            ))}
            {chips.length > 1 && (
              <button type="button" onClick={() => setCut({})} className="px-1 font-mono text-[11px] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
                Clear
              </button>
            )}
          </div>

          <Board divide={false} className="border">
            <div className="overflow-x-auto">
              <div className="md:min-w-[52rem] lg:min-w-0">
                <div className={cn(HEAD, GRID, "border-b border-zinc-200 dark:border-zinc-800")}>
                  <span><SortHeader label="Chain" k="name" /></span>
                  <span className="text-right"><SortHeader label="Validators" k="nodes" /></span>
                  <span className="whitespace-nowrap text-right"><SortHeader label="Nodes %" k="nodePct" /></span>
                  <span className="whitespace-nowrap text-right"><SortHeader label="Stake %" k="stakePct" /></span>
                  <span>Versions</span>
                  <span aria-hidden />
                </div>
                {!ready && <RowSkeleton n={10} />}
                {ready &&
                  rows.slice(0, shown).map((r) => {
                    const { subnet } = r;
                    const href = rowHref(subnet);
                    const old = Object.entries(subnet.byClientVersion).some(([v, d]) => d.nodes > 0 && stale.has(v));
                    const kind = subnet.id === PRIMARY_NETWORK_ID ? "Primary Network" : subnet.isL1 ? "L1" : "Subnet";
                    const parts = Object.entries(subnet.byClientVersion)
                      .filter(([, d]) => d.nodes > 0)
                      .sort(([a], [b]) => compareVersions(b, a));
                    const body = (
                      <>
                        <span className="flex min-w-0 items-center gap-3">
                          {subnet.chainLogoURI ? (
                            <Image
                              src={themedLogo(subnet.chainLogoURI)}
                              alt=""
                              width={24}
                              height={24}
                              className="h-6 w-6 shrink-0 rounded-full object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-200 font-mono text-[10px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                              {subnet.name.charAt(0)}
                            </span>
                          )}
                          <span className="flex min-w-0 flex-col md:flex-row md:items-center md:gap-2">
                            <span className={cn("truncate text-[13px] font-medium", href ? "text-[#0061E2] group-hover:underline dark:text-[#5f9dff]" : "text-zinc-900 dark:text-zinc-100")}>
                              {subnet.name}
                            </span>
                            <span className="hidden shrink-0 border border-zinc-200 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400 lg:inline dark:border-zinc-800 dark:text-zinc-500">
                              {kind}
                            </span>
                            {/* phones: the two shares md shows as columns */}
                            <span className={cn(MUTED, "text-[11px] md:hidden")}>
                              <span className={healthInk(r.nodePct, old)}>{r.nodePct.toFixed(0)}%</span> nodes ·{" "}
                              <span className={healthInk(r.stakePct, old)}>{r.stakePct.toFixed(0)}%</span> stake on {target}+
                            </span>
                          </span>
                        </span>
                        <span className={cn(INK, "text-right")}>{r.nodes.toLocaleString("en-US")}</span>
                        <span className={cn(INK, "hidden text-right md:block", healthInk(r.nodePct, old))}>{r.nodePct.toFixed(1)}%</span>
                        <span className={cn(INK, "hidden text-right md:block", healthInk(r.stakePct, old))}>{r.stakePct.toFixed(1)}%</span>
                        {/* the set's split in the fleet's colors; a picked version stays lit */}
                        <span className="col-span-2 flex h-2 w-full overflow-hidden bg-zinc-100 md:col-span-1 dark:bg-zinc-900">
                          {parts.map(([v, d]) => (
                            <span
                              key={v}
                              title={`${v}: ${d.nodes} node${d.nodes === 1 ? "" : "s"}`}
                              className={cn("h-full border-r border-white/60 transition-opacity duration-200 last:border-r-0 dark:border-black/40", cut.version && cut.version !== v && "opacity-30")}
                              style={{ width: `${(d.nodes / r.nodes) * 100}%`, background: paintOf.get(v) ?? "#a1a1aa" }}
                            />
                          ))}
                        </span>
                        <span className="hidden justify-end md:flex">
                          {href ? (
                            <ArrowRight className="h-3.5 w-3.5 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-600 dark:group-hover:text-zinc-100" />
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-700">—</span>
                          )}
                        </span>
                      </>
                    );
                    const rowClass = cn(ROW, GRID, "group grid-cols-[minmax(0,1fr)_auto] gap-y-2 border-b border-zinc-100 last:border-b-0 dark:border-zinc-900");
                    return href ? (
                      <Link key={subnet.id} href={href} className={rowClass}>
                        {body}
                      </Link>
                    ) : (
                      <div key={subnet.id} className={rowClass}>
                        {body}
                      </div>
                    );
                  })}
                {ready && rows.length === 0 && <EmptyRow>{q || cutting ? "no sets match" : "no sets found"}</EmptyRow>}
              </div>
            </div>
          </Board>
          {ready && shown < rows.length && (
            <LoadMore onClick={() => setShown((s) => s + PAGE)} label={`Load more · ${rows.length - shown} remaining`} />
          )}
        </section>
      </div>
    );
  }

  return <NetworkShell>{content}</NetworkShell>;
}
