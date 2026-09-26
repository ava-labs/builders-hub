"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, CellLabel, EmptyRow, HEAD, LoadMore, ROW, RowSkeleton, SectionHeader } from "@/components/explorer-v2/ui";
import { ViewSwitch } from "@/components/explorer-v2/network/icm-parts";
import type { DefiProtocol, YieldPool } from "@/lib/defi/llama";
import { GROUPS, type GroupKey } from "@/lib/defi/taxonomy";
import { groupTone, usd } from "./palette";

/* Where Avalanche pays: DefiLlama's yield pools on the C-Chain, with the
   filters a depositor reaches for first. Stablecoins only, no exposure
   to impermanent loss, a single asset, a floor on pool size, and the
   outliers DefiLlama flags left out. The APY bar splits what the pool
   earns itself from the rewards paid on top. Figures are DefiLlama's,
   read as data, not advice. */

type SortKey = "apy" | "tvl" | "mean";
type Floor = "100k" | "1m" | "10m";

const FLOOR: Record<Floor, number> = { "100k": 1e5, "1m": 1e6, "10m": 1e7 };
const GRID = "md:grid-cols-[minmax(0,1fr)_6.5rem_minmax(0,11rem)_5.5rem_5rem_4.5rem_1.25rem]";
const PAGE = 25;
const CHIP =
  "inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10.5px] tabular-nums transition-colors disabled:cursor-default disabled:opacity-40";
const OFF =
  "border-zinc-200 bg-white/80 text-zinc-600 enabled:hover:border-zinc-400 enabled:hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:enabled:hover:border-zinc-500 dark:enabled:hover:text-zinc-100";
const ON = "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";

const pct = (v: number | null) => (v === null ? "n/a" : `${v >= 100 ? v.toFixed(0) : v.toFixed(2)}%`);

/** a DefiLlama slug the protocol list does not name, made readable: "cian-yield-layer" to "Cian Yield Layer" */
const titleOf = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function YieldBoard({ pools, failed, protocols }: { pools: YieldPool[] | null; failed: boolean; protocols: DefiProtocol[] | null }) {
  const [stable, setStable] = useState(false);
  const [noIl, setNoIl] = useState(false);
  const [single, setSingle] = useState(false);
  const [outliers, setOutliers] = useState(false);
  const [floor, setFloor] = useState<Floor>("1m");
  const [groups, setGroups] = useState<GroupKey[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("apy");
  const [shown, setShown] = useState(PAGE);

  // a pool's project is a DefiLlama slug; the protocol list names it and gives its group
  const bySlug = useMemo(() => new Map((protocols ?? []).map((p) => [p.slug, p])), [protocols]);
  const groupOfPool = (y: YieldPool): GroupKey => bySlug.get(y.project)?.group ?? "other";

  const rows = useMemo(() => {
    if (!pools) return null;
    const q = query.trim().toLowerCase();
    const out = pools.filter(
      (y) =>
        y.tvl >= FLOOR[floor] &&
        (!stable || y.stablecoin) &&
        (!noIl || !y.ilRisk) &&
        (!single || y.single) &&
        (outliers || !y.outlier) &&
        (groups.length === 0 || groups.includes(groupOfPool(y))) &&
        (!q || y.symbol.toLowerCase().includes(q) || y.project.includes(q) || (bySlug.get(y.project)?.name.toLowerCase().includes(q) ?? false)),
    );
    const key = (y: YieldPool) => (sort === "tvl" ? y.tvl : sort === "mean" ? y.apyMean30d : y.apy) ?? -1;
    return out.sort((a, b) => key(b) - key(a));
    // groupOfPool reads bySlug, which is a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pools, floor, stable, noIl, single, outliers, groups, query, sort, bySlug]);

  const present = useMemo(() => GROUPS.filter((g) => (pools ?? []).some((y) => y.tvl >= FLOOR[floor] && groupOfPool(y) === g.key)), [pools, floor, bySlug]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxApy = useMemo(() => Math.max(1, ...(rows ?? []).slice(0, shown).map((y) => y.apy ?? 0)), [rows, shown]);
  const reset = () => setShown(PAGE);

  const Toggle = ({ on, set, children, title }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode; title: string }) => (
    <button type="button" aria-pressed={on} title={title} onClick={() => {
        set(!on);
        reset();
      }} className={cn(CHIP, "uppercase tracking-[0.1em]", on ? ON : OFF)}>
      {children}
    </button>
  );

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label="Yields"
        action={
          rows ? (
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              {rows.length.toLocaleString("en-US")} of {(pools ?? []).length.toLocaleString("en-US")} pools
            </span>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-full items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2 transition-colors focus-within:border-zinc-900 sm:w-64 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-100">
          <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              reset();
            }}
            placeholder="Token or protocol"
            aria-label="Search pools"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
          {query && (
            <button type="button" onClick={() => {
                setQuery("");
                reset();
              }} aria-label="Clear search" className="shrink-0 text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Toggle on={stable} set={setStable} title="Pools of stablecoins only">
          Stablecoins
        </Toggle>
        <Toggle on={noIl} set={setNoIl} title="Pools that cannot lose value to impermanent loss">
          No IL risk
        </Toggle>
        <Toggle on={single} set={setSingle} title="Pools of one asset, not a pair">
          Single asset
        </Toggle>
        <Toggle on={outliers} set={setOutliers} title="Show the pools DefiLlama flags as APY outliers">
          Outliers
        </Toggle>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Min TVL</span>
          <ViewSwitch
            id="yield-floor"
            value={floor}
            onChange={(v) => {
              setFloor(v);
              reset();
            }}
            options={[
              { v: "100k", label: "$100K" },
              { v: "1m", label: "$1M" },
              { v: "10m", label: "$10M" },
            ]}
          />
        </div>
      </div>
      {present.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Category</span>
          {present.map((g) => {
            const on = groups.includes(g.key);
            return (
              <button
                key={g.key}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => {
                  setGroups((s) => (on ? s.filter((k) => k !== g.key) : [...s, g.key]));
                  reset();
                }}
                className={cn(CHIP, on ? ON : OFF)}
              >
                <span className="h-2 w-2 rounded-[1px]" style={{ background: groupTone(g.key) }} />
                {g.label}
              </button>
            );
          })}
        </div>
      )}

      <Board divide={false}>
        <div className="overflow-x-auto">
          <div className="md:min-w-[52rem]">
            <div className={cn(HEAD, GRID, "border-b border-zinc-200 dark:border-zinc-800")}>
              <span>Pool</span>
              <SortButton label="TVL" on={sort === "tvl"} onClick={() => {
                  setSort("tvl");
                  reset();
                }} />
              <SortButton label="APY · base + reward" on={sort === "apy"} onClick={() => {
                  setSort("apy");
                  reset();
                }} left />
              <SortButton label="30d avg" on={sort === "mean"} onClick={() => {
                  setSort("mean");
                  reset();
                }} />
              <span className="text-right" title="APY points gained or lost over 7 days">APY move 7d</span>
              <span className="text-right">IL risk</span>
              <span />
            </div>
            {!rows && !failed && <RowSkeleton n={8} />}
            {failed && !rows && (
              <EmptyRow>
                <span className="text-[#E6212F]">Yield feed unavailable</span>
              </EmptyRow>
            )}
            {rows?.slice(0, shown).map((y) => {
              const p = bySlug.get(y.project);
              const g = groupOfPool(y);
              const base = y.apyBase ?? (y.apyReward === null ? y.apy ?? 0 : 0);
              const reward = y.apyReward ?? 0;
              return (
                <a
                  key={y.id}
                  href={`https://defillama.com/yields/pool/${y.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(ROW, GRID, "border-b border-zinc-100 last:border-b-0 dark:border-zinc-900")}
                >
                  <span className="col-span-2 flex min-w-0 items-center gap-2.5 md:col-span-1">
                    {p?.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.logo} alt="" width={18} height={18} loading="lazy" className="h-[18px] w-[18px] shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                    ) : (
                      <span className="h-[18px] w-[18px] shrink-0 rounded-full" style={{ background: groupTone(g) }} />
                    )}
                    <span className="flex min-w-0 flex-col md:flex-row md:items-baseline md:gap-2">
                      <span className="truncate font-mono text-[12.5px] font-medium text-zinc-900 dark:text-zinc-50">{y.symbol}</span>
                      <span className="truncate font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">
                        {p?.name ?? titleOf(y.project)}
                        {y.meta ? ` · ${y.meta}` : ""}
                        {y.stablecoin ? " · stable" : ""}
                      </span>
                    </span>
                  </span>
                  <span className="md:text-right">
                    <CellLabel>TVL</CellLabel>
                    <span className="font-mono text-[12.5px] tabular-nums text-zinc-900 dark:text-zinc-50">{usd(y.tvl)}</span>
                  </span>
                  <span className="min-w-0">
                    <CellLabel>APY</CellLabel>
                    <span className="flex items-center gap-2">
                      <span className="flex h-2 w-24 shrink-0 overflow-hidden rounded-[2px] bg-zinc-100 dark:bg-zinc-900" title={`base ${pct(y.apyBase)} · reward ${pct(y.apyReward)}`}>
                        <span className="h-full" style={{ width: `${Math.min(100, (base / maxApy) * 100)}%`, background: groupTone(g) }} />
                        <span className="h-full border-l border-[color:var(--d-gap)] opacity-45" style={{ width: `${Math.min(100, (reward / maxApy) * 100)}%`, background: groupTone(g) }} />
                      </span>
                      <span className="font-mono text-[12.5px] tabular-nums text-zinc-900 dark:text-zinc-50">{pct(y.apy)}</span>
                    </span>
                  </span>
                  <span className="md:text-right">
                    <CellLabel>30d avg</CellLabel>
                    <span className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">{pct(y.apyMean30d)}</span>
                  </span>
                  <span className="md:text-right">
                    <CellLabel>APY move 7d</CellLabel>
                    <span className="whitespace-nowrap font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {y.apyChange7d === null ? "n/a" : `${y.apyChange7d > 0 ? "+" : y.apyChange7d < 0 ? "−" : ""}${Math.abs(y.apyChange7d).toFixed(2)} pts`}
                    </span>
                  </span>
                  <span className="md:text-right">
                    <CellLabel>IL risk</CellLabel>
                    <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{y.ilRisk ? "yes" : "no"}</span>
                  </span>
                  <ArrowUpRight className="hidden h-3.5 w-3.5 justify-self-end text-zinc-300 md:block dark:text-zinc-600" />
                </a>
              );
            })}
            {rows && rows.length === 0 && <EmptyRow>No pools match. Lower the TVL floor or turn a filter off.</EmptyRow>}
          </div>
        </div>
      </Board>
      {rows && shown < rows.length && <LoadMore onClick={() => setShown((s) => s + PAGE)} label={`Load more · ${(rows.length - shown).toLocaleString("en-US")} remaining`} />}
      <p className="font-mono text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
        APY and TVL from DefiLlama&apos;s yields feed. The lighter part of a bar is rewards paid in other tokens. These are data, not advice: rates move, and pools
        carry smart-contract and market risk.
      </p>
    </section>
  );
}

function SortButton({ label, on, onClick, left }: { label: string; on: boolean; onClick: () => void; left?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("uppercase tracking-[0.14em] transition-colors hover:text-zinc-900 dark:hover:text-zinc-100", !left && "text-right", on && "text-zinc-900 dark:text-zinc-100")}
    >
      {label}
      {on ? " ↓" : ""}
    </button>
  );
}

