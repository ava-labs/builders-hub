"use client";

import type React from "react";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, ChartBoard, EmptyRow, HEAD, INK, LoadMore, MUTED, ROW, SectionHeader } from "@/components/explorer-v2/ui";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { DAPP_CATEGORIES, type DAppStats } from "@/types/dapps";
import type { useDappsTable } from "@/app/(home)/stats/dapps/_hooks/useDappsTable";
import type { SortField } from "@/app/(home)/stats/dapps/_components/types";

/* The Apps page's instruments: the TVL split by category, the biggest
   protocols as a treemap, and the leaderboard both of them cut. A
   category picked in the split narrows the treemap and the table; the
   cut shows as a chip over the table. */

type Table = ReturnType<typeof useDappsTable>;

export const usd = (v: number) => `$${fmtCompact(v)}`;

export function categoryName(key: string): string {
  return DAPP_CATEGORIES[key as keyof typeof DAPP_CATEGORIES]?.name ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** where a protocol opens: its main C-Chain contract in the explorer when
    one is known, else its own site in a new tab, else nowhere */
export function appLink(d: { address?: string; url?: string }): { href: string; external: boolean } | null {
  if (d.address) return { href: `/explorer/mainnet/c-chain/address/${d.address}`, external: false };
  if (d.url) return { href: d.url, external: true };
  return null;
}
/* a protocol's tile or row: a link where it can open, a plain block where it cannot */
function AppAnchor({ d, children, ...rest }: { d: { address?: string; url?: string; name: string }; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  const l = appLink(d);
  if (!l) return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  if (l.external)
    return (
      <a href={l.href} target="_blank" rel="noopener noreferrer" title={`${d.name}: no C-Chain contract listed, opens its site`} {...rest}>
        {children}
      </a>
    );
  return (
    <Link href={l.href} title={`${d.name}: its main C-Chain contract`} {...rest}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* TVL by category: one bar split by share, the legend under it        */

interface CategoryShare {
  key: string;
  tvl: number;
  count: number;
}

export function useCategoryShares(dapps: DAppStats[]): CategoryShare[] {
  return useMemo(() => {
    const by = new Map<string, CategoryShare>();
    for (const d of dapps) {
      const c = by.get(d.category) ?? { key: d.category, tvl: 0, count: 0 };
      c.tvl += d.tvl || 0;
      c.count += 1;
      by.set(d.category, c);
    }
    return [...by.values()].sort((a, b) => b.tvl - a.tvl || b.count - a.count);
  }, [dapps]);
}

export function CategorySplit({
  shares,
  picked,
  onPick,
}: {
  shares: CategoryShare[];
  picked: string;
  onPick: (key: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = shares.reduce((s, c) => s + c.tvl, 0);
  const lit = hover ?? (picked !== "All" ? picked : null);
  const withTvl = shares.filter((c) => c.tvl > 0);
  const hovered = hover ? shares.find((c) => c.key === hover) : null;

  return (
    <ChartBoard
      label="TVL by Category"
      action={
        <span className="font-mono text-[10px] tabular-nums tracking-[0.08em] text-zinc-400 dark:text-zinc-500">
          {shares.reduce((s, c) => s + c.count, 0)} protocols · share of summed TVL
        </span>
      }
    >
      {/* the split: each category's share of the listed TVL */}
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <div className="flex h-10 w-full gap-px bg-white dark:bg-zinc-950">
          {withTvl.map((c, i) => (
            <button
              key={c.key}
              type="button"
              aria-label={`${categoryName(c.key)}: ${usd(c.tvl)}`}
              onMouseEnter={() => setHover(c.key)}
              onFocus={() => setHover(c.key)}
              onBlur={() => setHover(null)}
              onClick={() => onPick(picked === c.key ? "All" : c.key)}
              className={cn(
                "h-full min-w-px transition-[background-color,opacity] duration-200",
                lit === c.key ? "bg-zinc-900 dark:bg-zinc-100" : i % 2 ? "bg-[#A2AFB2]/55" : "bg-[#A2AFB2]",
                lit && lit !== c.key && "opacity-30",
              )}
              style={{ width: `${(c.tvl / total) * 100}%` }}
            />
          ))}
        </div>
        {hovered && (
          <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-2">
            <TipPlate>
              <p className="font-mono text-[10px] text-zinc-500">{categoryName(hovered.key)}</p>
              <p className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                {usd(hovered.tvl)} · {total ? ((hovered.tvl / total) * 100).toFixed(1) : 0}% · {hovered.count} protocols
              </p>
              <p className="font-mono text-[10px] text-zinc-400">{picked === hovered.key ? "Click to show all" : "Click to list them"}</p>
            </TipPlate>
          </span>
        )}
      </div>

      {/* the legend reads biggest first; every row cuts the table */}
      <div className="mt-5 flex flex-col" onMouseLeave={() => setHover(null)}>
        {shares.map((c) => {
          const share = total ? c.tvl / total : 0;
          const on = picked === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onMouseEnter={() => setHover(c.key)}
              onClick={() => onPick(on ? "All" : c.key)}
              className={cn(
                "grid h-7 grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_4.5rem_2.25rem] items-center gap-3 text-left font-mono text-[11px] transition-opacity",
                lit && lit !== c.key && "opacity-40",
              )}
            >
              <span className={cn("truncate uppercase tracking-[0.1em]", on ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400")}>
                {categoryName(c.key)}
              </span>
              <span className="block h-1.5 bg-zinc-100 dark:bg-zinc-900">
                <span
                  className={cn("block h-full transition-[width] duration-500", lit === c.key ? "bg-zinc-900 dark:bg-zinc-100" : "bg-[#A2AFB2]")}
                  style={{ width: `${c.tvl > 0 ? Math.max(1, share * 100) : 0}%` }}
                />
              </span>
              <span className="text-right tabular-nums text-zinc-900 dark:text-zinc-50">{c.tvl > 0 ? usd(c.tvl) : "—"}</span>
              <span className="text-right tabular-nums text-zinc-400 dark:text-zinc-500">{c.count}</span>
            </button>
          );
        })}
      </div>
    </ChartBoard>
  );
}

/* ------------------------------------------------------------------ */
/* Treemap: the biggest protocols by TVL, area to scale                */

const TREEMAP_N = 24;

interface Tile<T> {
  x: number;
  y: number;
  w: number;
  h: number;
  item: T;
}

/** squarified treemap (Bruls, Huizing, van Wijk): rows are laid along
 *  the short side while adding a tile keeps the row's worst aspect down */
function squarify<T>(nodes: { value: number; item: T }[], W: number, H: number): Tile<T>[] {
  const total = nodes.reduce((s, n) => s + n.value, 0);
  if (!total || W <= 0 || H <= 0) return [];
  const areas = nodes.map((n) => ({ a: (n.value / total) * W * H, item: n.item }));
  const out: Tile<T>[] = [];
  let x = 0;
  let y = 0;
  let w = W;
  let h = H;
  let i = 0;
  while (i < areas.length) {
    const side = Math.min(w, h);
    const worst = (row: typeof areas) => {
      const s = row.reduce((t, r) => t + r.a, 0);
      const mx = Math.max(...row.map((r) => r.a));
      const mn = Math.min(...row.map((r) => r.a));
      return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
    };
    const row = [areas[i]];
    let j = i + 1;
    while (j < areas.length && worst([...row, areas[j]]) <= worst(row)) row.push(areas[j++]);
    const s = row.reduce((t, r) => t + r.a, 0);
    if (w >= h) {
      const cw = s / h;
      let cy = y;
      for (const r of row) {
        const rh = r.a / cw;
        out.push({ x, y: cy, w: cw, h: rh, item: r.item });
        cy += rh;
      }
      x += cw;
      w -= cw;
    } else {
      const rh = s / w;
      let cx = x;
      for (const r of row) {
        const rw = r.a / rh;
        out.push({ x: cx, y, w: rw, h: rh, item: r.item });
        cx += rw;
      }
      y += rh;
      h -= rh;
    }
    i = j;
  }
  return out;
}

export function ProtocolTreemap({ dapps, category }: { dapps: DAppStats[]; category: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pool = useMemo(
    () => dapps.filter((d) => d.tvl > 0 && (category === "All" || d.category === category)).sort((a, b) => b.tvl - a.tvl),
    [dapps, category],
  );
  const top = pool.slice(0, TREEMAP_N);
  const shown = top.reduce((s, d) => s + d.tvl, 0);
  const all = pool.reduce((s, d) => s + d.tvl, 0);
  const tiles = useMemo(
    () => (size ? squarify(top.map((d) => ({ value: d.tvl, item: d })), size.w, size.h) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size, pool],
  );
  const hd = hover ? tiles.find((t) => t.item.id === hover) : null;

  return (
    <ChartBoard
      label={category === "All" ? "Top Protocols by TVL" : `Top ${categoryName(category)} by TVL`}
      action={
        pool.length ? (
          <span className="font-mono text-[10px] tabular-nums tracking-[0.08em] text-zinc-400 dark:text-zinc-500">
            top {top.length} of {pool.length} · {all ? ((shown / all) * 100).toFixed(0) : 0}% of TVL
          </span>
        ) : undefined
      }
    >
      <div ref={frame} className="relative h-72 sm:h-[26rem]" onMouseLeave={() => setHover(null)}>
        {pool.length === 0 && <p className="flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">No TVL in this category</p>}
        {tiles.map((t) => {
          const d = t.item;
          const on = hover === d.id;
          const roomy = t.w > 76 && t.h > 38;
          return (
            <AppAnchor
              key={d.id}
              d={d}
              onMouseEnter={() => setHover(d.id)}
              onFocus={() => setHover(d.id)}
              onBlur={() => setHover(null)}
              className={cn(
                "absolute overflow-hidden border border-white p-2 transition-colors duration-150 dark:border-zinc-950",
                on ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-[#A2AFB2]/35 text-zinc-900 dark:bg-[#A2AFB2]/20 dark:text-zinc-50",
              )}
              style={{ left: t.x, top: t.y, width: t.w, height: t.h }}
              aria-label={`${d.name}: ${usd(d.tvl)}`}
            >
              {roomy && (
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-mono text-[11px] font-bold">{d.name}</span>
                  <span className={cn("font-mono text-[10px] tabular-nums", on ? "opacity-70" : "text-zinc-500 dark:text-zinc-400")}>{usd(d.tvl)}</span>
                </span>
              )}
            </AppAnchor>
          );
        })}
        {hd && (
          <span
            className="pointer-events-none absolute z-20"
            style={{
              top: Math.min(hd.y + 8, (size?.h ?? 0) - 72),
              ...(hd.x + hd.w / 2 > (size?.w ?? 0) / 2 ? { right: (size?.w ?? 0) - hd.x + 6 } : { left: hd.x + hd.w + 6 }),
            }}
          >
            <TipPlate>
              <p className="font-mono text-[10px] text-zinc-500">{categoryName(hd.item.category)}</p>
              <p className="whitespace-nowrap font-mono text-[11px] font-bold text-zinc-900 dark:text-zinc-100">{hd.item.name}</p>
              <p className="whitespace-nowrap font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                {usd(hd.item.tvl)} <span className="text-zinc-400">· {all ? ((hd.item.tvl / all) * 100).toFixed(1) : 0}%</span>
              </p>
            </TipPlate>
          </span>
        )}
      </div>
    </ChartBoard>
  );
}

/* ------------------------------------------------------------------ */
/* Leaderboard                                                          */

/** a move in ink, as on the C-Chain: an arrow and a number, no alarm red */
function Move({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-zinc-300 dark:text-zinc-700">—</span>;
  const flat = Math.abs(value) < 0.05;
  return (
    <span className="whitespace-nowrap text-zinc-700 dark:text-zinc-300">
      <span className="text-[8px]">{flat ? "■" : value > 0 ? "▲" : "▼"}</span> {Math.abs(value) >= 100 ? Math.abs(value).toFixed(0) : Math.abs(value).toFixed(1)}%
    </span>
  );
}

function Logo({ dapp }: { dapp: DAppStats }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden bg-zinc-100 font-mono text-[10px] font-bold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
      {dapp.logo && !broken ? (
        <Image
          src={dapp.logo}
          alt=""
          width={20}
          height={20}
          unoptimized={dapp.logo.endsWith(".svg")}
          className={cn("h-full w-full object-cover", dapp.darkInvert && "dark:invert")}
          onError={() => setBroken(true)}
        />
      ) : (
        dapp.name.charAt(0)
      )}
    </span>
  );
}

const COLS = "md:grid-cols-[2rem_minmax(0,1fr)_7rem_6.5rem_5rem_5rem_6.5rem_6.5rem]";

export function Leaderboard({ table, total }: { table: Table; total: number }) {
  const {
    sortedData,
    visibleData,
    hasMoreData,
    sortField,
    sortDirection,
    onSort,
    onLoadMore,
    searchTerm,
    setSearchTerm,
    clearSearch,
    selectedCategory,
    setSelectedCategory,
    showOnChainOnly,
    setShowOnChainOnly,
  } = table;
  const cutting = selectedCategory !== "All" || showOnChainOnly || searchTerm !== "";

  const SortHeader = ({ label, k, right = true }: { label: string; k: SortField; right?: boolean }) => {
    const active = sortField === k;
    return (
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "uppercase tracking-[0.14em] transition-colors hover:text-zinc-900 dark:hover:text-zinc-100",
          right ? "text-right" : "text-left",
          active && "text-zinc-900 dark:text-zinc-100",
        )}
      >
        {label}
        {active ? (sortDirection === "desc" ? " ↓" : " ↑") : ""}
      </button>
    );
  };

  return (
    <section className="flex scroll-mt-24 flex-col gap-4" id="leaderboard">
      <SectionHeader
        label="Leaderboard"
        action={
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            {cutting ? `${sortedData.length} / ${total}` : `${total} protocols`}
          </span>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-full items-center gap-3 border border-zinc-200 bg-white px-3 py-2 transition-colors focus-within:border-zinc-900 sm:w-72 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-100">
          <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by protocol or category"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
          {searchTerm && (
            <button type="button" onClick={clearSearch} aria-label="Clear search" className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          aria-pressed={showOnChainOnly}
          onClick={() => setShowOnChainOnly(!showOnChainOnly)}
          title="Protocols tracked from on-chain activity, with no TVL listing"
          className={cn(
            "border px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
            showOnChainOnly
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-200 bg-white/80 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100",
          )}
        >
          On-chain tracked
        </button>
        {selectedCategory !== "All" && (
          <button
            type="button"
            onClick={() => setSelectedCategory("All")}
            className="group inline-flex items-center gap-1.5 border border-zinc-900 py-1.5 pl-2.5 pr-2 font-mono text-[11px] text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            {categoryName(selectedCategory)}
            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </button>
        )}
      </div>

      <Board divide={false}>
        <div className="overflow-x-auto">
          <div className="md:min-w-[52rem] xl:min-w-0">
            <div className={cn(HEAD, COLS, "border-b border-zinc-200 dark:border-zinc-800")}>
              <span>#</span>
              <SortHeader label="Protocol" k="name" right={false} />
              <span>Category</span>
              <SortHeader label="TVL" k="tvl" />
              <SortHeader label="24h" k="change_1d" />
              <SortHeader label="7d" k="change_7d" />
              <SortHeader label="Volume 24h" k="volume24h" />
              <SortHeader label="Market Cap" k="mcap" />
            </div>
            {visibleData.map((d, i) => {
              return (
                <AppAnchor key={d.id} d={d} className={cn(ROW, COLS, "border-b border-zinc-100 last:border-b-0 dark:border-zinc-900")}>
                  <span className={cn(MUTED, "max-md:hidden")}>{i + 1}</span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Logo dapp={d} />
                    <span className={cn(INK, "truncate font-medium")}>{d.name}</span>
                  </span>
                  <span className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500 max-md:order-3 dark:text-zinc-400">
                    {categoryName(d.category)}
                  </span>
                  <span className={cn(INK, "text-right max-md:order-2")}>{d.tvl > 0 ? usd(d.tvl) : <span className="text-zinc-300 dark:text-zinc-700">—</span>}</span>
                  <span className="text-right font-mono text-[12px] tabular-nums max-md:order-4">
                    <Move value={d.change_1d} />
                  </span>
                  <span className="text-right font-mono text-[12px] tabular-nums max-md:hidden">
                    <Move value={d.change_7d} />
                  </span>
                  <span className={cn(MUTED, "text-right max-md:hidden")}>{d.volume24h ? usd(d.volume24h) : "—"}</span>
                  <span className={cn(MUTED, "text-right max-md:hidden")}>{d.mcap ? usd(d.mcap) : "—"}</span>
                </AppAnchor>
              );
            })}
            {sortedData.length === 0 && <EmptyRow>no protocols match</EmptyRow>}
          </div>
        </div>
      </Board>
      {hasMoreData && <LoadMore onClick={onLoadMore} label={`Load more · ${sortedData.length - visibleData.length} remaining`} />}
    </section>
  );
}
