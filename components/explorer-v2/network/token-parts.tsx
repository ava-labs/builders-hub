"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board, ChartBoard, HEAD, INK, LiveDot, MUTED, ROW, RowSkeleton, SectionHeader, feeInk } from "@/components/explorer-v2/ui";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { ReadoutBlock } from "@/components/explorer-v2/evm/EvmOverviewStats";
import { Belt, MotionRow, useFreeze } from "@/components/explorer-v2/evm/LiveBoards";
import { ageShort, formatNumber } from "@/components/explorer-v2/format";

/* The token page's instruments: where the 720M cap sits, what each
   chain has burned, the fees paid on the page clock, and the C-Chain's
   burn block by block. Red is the burn's color here, as on the C-Chain;
   everything else is block gray and ink. */

export const TOKEN_CAP = 720_000_000;

export const avax = (v: number) => fmtCompact(v);
export const usdOf = (v: number, price: number) => (price > 0 ? `$${fmtCompact(v * price)}` : undefined);

/* ------------------------------------------------------------------ */
/* Price history for the price readout's trace, on the page clock       */

export function usePriceHistory(n: number): number[] | undefined {
  // the upstream stops at a year; the day clock gets hourly points
  const days = n <= 1 ? "1" : n <= 7 ? "7" : n <= 30 ? "30" : n <= 90 ? "90" : "365";
  const [prices, setPrices] = useState<number[] | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/market-history/43114?days=${days}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { prices?: number[] } | null) => {
        if (!cancelled && data?.prices?.length) setPrices(n <= 1 ? data.prices : data.prices.slice(-n));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [days, n]);
  return prices;
}

/* ------------------------------------------------------------------ */
/* Supply: the cap as one bar                                          */

interface Part {
  key: string;
  label: string;
  value: number;
  /** full static class strings so Tailwind keeps them */
  tone: string;
  href?: string;
}

function ShareLegend({ parts, total, hover, setHover, unit = "AVAX" }: { parts: Part[]; total: number; hover: string | null; setHover: (k: string | null) => void; unit?: string }) {
  return (
    <div className="mt-5 flex flex-col" onMouseLeave={() => setHover(null)}>
      {parts.map((p) => {
        const inner = (
          <>
            <span className={cn("h-2 w-2 shrink-0", p.tone)} />
            <span className="truncate uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
              {p.label}
              {p.href && <span className="ml-1 text-[#E6212F] opacity-0 transition-opacity group-hover/leg:opacity-100">→</span>}
            </span>
            <span className="text-right tabular-nums text-zinc-900 dark:text-zinc-50">
              {avax(p.value)} <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{unit}</span>
            </span>
            <span className="text-right tabular-nums text-zinc-400 dark:text-zinc-500">{total ? `${((p.value / total) * 100).toFixed(p.value / total < 0.1 ? 1 : 0)}%` : ""}</span>
          </>
        );
        const cls = cn(
          "group/leg grid h-7 grid-cols-[auto_minmax(0,1fr)_auto_3rem] items-center gap-3 font-mono text-[11px] transition-opacity",
          hover && hover !== p.key && "opacity-40",
        );
        return p.href ? (
          <Link key={p.key} href={p.href} className={cls} onMouseEnter={() => setHover(p.key)}>
            {inner}
          </Link>
        ) : (
          <div key={p.key} className={cls} onMouseEnter={() => setHover(p.key)}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function ShareBar({ parts, total, hover, setHover, unit = "AVAX" }: { parts: Part[]; total: number; hover: string | null; setHover: (k: string | null) => void; unit?: string }) {
  const hp = hover ? parts.find((p) => p.key === hover) : null;
  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <div className="flex h-10 w-full gap-px">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <span
              key={p.key}
              onMouseEnter={() => setHover(p.key)}
              className={cn("h-full min-w-px transition-opacity duration-200", p.tone, hover && hover !== p.key && "opacity-30")}
              style={{ width: `${(p.value / total) * 100}%` }}
            />
          ))}
      </div>
      {hp && (
        <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-2">
          <TipPlate>
            <p className="font-mono text-[10px] text-zinc-500">{hp.label}</p>
            <p className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
              {hp.value.toLocaleString("en-US", { maximumFractionDigits: 0 })} {unit} · {((hp.value / total) * 100).toFixed(2)}%
            </p>
          </TipPlate>
        </span>
      )}
    </div>
  );
}

export function SupplyBoard({ circulating, staked, locked, burned }: { circulating: number; staked: number; locked: number; burned: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const supply = TOKEN_CAP - burned;
  const parts: Part[] = [
    { key: "staked", label: "Staked", value: staked, tone: "bg-zinc-800 dark:bg-zinc-200", href: "/explorer/mainnet/p-chain/staking" },
    { key: "locked", label: "Locked", value: locked, tone: "bg-zinc-500 dark:bg-zinc-500" },
    { key: "liquid", label: "Liquid", value: Math.max(0, circulating - staked - locked), tone: "bg-[#A2AFB2]" },
    { key: "unissued", label: "Not circulating", value: Math.max(0, supply - circulating), tone: "bg-[#A2AFB2]/35" },
    { key: "burned", label: "Burned", value: burned, tone: "bg-[#E6212F]" },
  ];
  return (
    <ChartBoard
      label="Supply"
      action={<span className="font-mono text-[10px] tabular-nums tracking-[0.08em] text-zinc-400 dark:text-zinc-500">of the 720M AVAX cap</span>}
    >
      <ShareBar parts={parts} total={TOKEN_CAP} hover={hover} setHover={setHover} />
      <ShareLegend parts={parts} total={TOKEN_CAP} hover={hover} setHover={setHover} />
    </ChartBoard>
  );
}

export function BurnBoard({ c, p, x }: { c: number; p: number; x: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = c + p + x;
  const rows = [
    { key: "c", label: "C-Chain", value: c, href: "/explorer/mainnet/c-chain/gas" },
    { key: "p", label: "P-Chain", value: p, href: "/explorer/mainnet/p-chain" },
    { key: "x", label: "X-Chain", value: x, href: "/explorer/mainnet/x-chain" },
  ];
  return (
    <ChartBoard
      label="Burned by Chain"
      action={
        <span className="font-mono text-[10px] tabular-nums tracking-[0.08em] text-zinc-400 dark:text-zinc-500">
          {total.toLocaleString("en-US", { maximumFractionDigits: 0 })} AVAX
        </span>
      }
    >
      <div className="flex flex-col gap-4" onMouseLeave={() => setHover(null)}>
        {rows.map((r) => {
          const share = total ? r.value / total : 0;
          return (
            <Link
              key={r.key}
              href={r.href}
              onMouseEnter={() => setHover(r.key)}
              className={cn("group/burn flex flex-col gap-1.5 transition-opacity", hover && hover !== r.key && "opacity-40")}
            >
              <span className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
                <span className="uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
                  {r.label}
                  <span className="ml-1 text-[#E6212F] opacity-0 transition-opacity group-hover/burn:opacity-100">→</span>
                </span>
                <span className="tabular-nums text-zinc-900 dark:text-zinc-50">
                  {r.value.toLocaleString("en-US", { maximumFractionDigits: 0 })} <span className="text-[10px] text-zinc-400 dark:text-zinc-500">AVAX</span>
                  <span className="ml-3 inline-block w-12 text-right text-zinc-400 dark:text-zinc-500">{(share * 100).toFixed(share < 0.1 ? 2 : 1)}%</span>
                </span>
              </span>
              <span className="block h-1.5 bg-zinc-100 dark:bg-zinc-900">
                <span className="block h-full bg-[#E6212F]" style={{ width: `${Math.max(0.5, share * 100)}%` }} />
              </span>
            </Link>
          );
        })}
      </div>
    </ChartBoard>
  );
}

/* ------------------------------------------------------------------ */
/* Fees burned: the page clock's buckets as columns in a readout block. */
/* The ICM contract's fees are C-Chain gas too, so they are a part of    */
/* each column, not a layer on top of it.                                */

export interface FeeBucket {
  date: string;
  cChainFees: number;
  icmFees: number;
}

type FeeKey = "icm" | "rest";
const FEE_LAYERS: { key: FeeKey; label: string; what: string; tone: string }[] = [
  { key: "icm", label: "ICM", what: "Interchain Messaging transactions", tone: "bg-[#E6212F]/30" },
  { key: "rest", label: "Other", what: "every other C-Chain transaction", tone: "bg-[#E6212F]/70" },
];

/** a bucket's layers, floor up: ICM's share, then the rest of the burn */
function layersOf(b: FeeBucket): Record<FeeKey, number> {
  const icm = Math.min(b.icmFees, b.cChainFees);
  return { icm, rest: b.cChainFees - icm };
}

const FEE_PX = 240;

export function FeeBlock({
  buckets: raw,
  label,
  dateLabel,
  note,
  price,
}: {
  buckets: FeeBucket[];
  label: string;
  /** a bucket's date, spelled for the plate */
  dateLabel: (date: string) => string;
  note?: string | null;
  price: number;
}) {
  const buckets = useMemo(() => raw.map((b) => ({ date: b.date, ...layersOf(b) })), [raw]);
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const total = (b: Record<FeeKey, number>) => b.icm + b.rest;
  const sums = useMemo(
    () => ({
      icm: buckets.reduce((s, b) => s + b.icm, 0),
      rest: buckets.reduce((s, b) => s + b.rest, 0),
    }),
    [buckets],
  );
  const all = sums.icm + sums.rest;
  const peak = Math.max(0, ...buckets.map(total));
  const max = peak * 1.08 || 1;
  const last = buckets[buckets.length - 1];
  const hb = hover !== null ? buckets[hover] : null;

  // the right face carries the last bucket's strata at the same scale
  const side = last ? (
    <span className="absolute inset-x-0 bottom-0 flex flex-col-reverse" style={{ height: FEE_PX }}>
      {FEE_LAYERS.map((l, i) => (
        <span
          key={l.key}
          className={cn("w-full shrink-0 transition-opacity", l.tone, i === FEE_LAYERS.length - 1 && "border-t border-zinc-700/60 dark:border-zinc-300/60", focus && focus !== l.key && "opacity-20")}
          style={{ height: (last[l.key] / max) * FEE_PX }}
        />
      ))}
    </span>
  ) : null;

  return (
    <div className="pr-2 pt-2">
      <ReadoutBlock side={side} className="flex-col">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-x-8 gap-y-3 px-5 pt-3 md:px-6">
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {label}
              {note && <span className="font-normal text-zinc-400 dark:text-zinc-500"> · {note}</span>}
            </span>
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums text-zinc-900 [font-family:Aeonik,var(--font-sans),sans-serif] dark:text-zinc-50">
                {avax(all)}
                <span className="ml-1 font-mono text-[12px] font-normal tracking-normal text-zinc-400 dark:text-zinc-500">AVAX</span>
              </span>
              <span className="font-mono text-[10px] tracking-[0.04em] text-zinc-400 dark:text-zinc-500">
                {usdOf(all, price) ? `${usdOf(all, price)} · ` : ""}
                {buckets.length > 1 ? `${dateLabel(buckets[0].date)} to ${dateLabel(last.date)}` : ""}
              </span>
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-0.5 font-mono text-[10px] uppercase tracking-[0.12em]" onMouseLeave={() => setFocus(null)}>
            {FEE_LAYERS.map((l) => (
              <button
                key={l.key}
                type="button"
                title={l.what}
                onMouseEnter={() => setFocus(l.key)}
                onFocus={() => setFocus(l.key)}
                onBlur={() => setFocus(null)}
                className={cn("flex items-center gap-1.5 transition-opacity", focus && focus !== l.key ? "opacity-40" : "opacity-100")}
              >
                <span className={cn("h-2 w-2", l.tone)} />
                <span className="text-zinc-500 dark:text-zinc-400">{l.label}</span>
                <span className="tabular-nums text-zinc-900 dark:text-zinc-50">{all > 0 ? ((sums[l.key] / all) * 100).toFixed(sums[l.key] / all < 0.1 || sums[l.key] / all > 0.99 ? 1 : 0) : 0}%</span>
              </button>
            ))}
          </span>
        </div>

        <div className="relative mt-6" style={{ height: FEE_PX }} onMouseLeave={() => setHover(null)}>
          {/* the scale, said once: the window's peak */}
          {peak > 0 && (
            <span className="pointer-events-none absolute inset-x-0 border-t border-dashed border-zinc-200 dark:border-zinc-800" style={{ top: FEE_PX - (peak / max) * FEE_PX }}>
              <span className="absolute -top-4 right-3 font-mono text-[9px] tabular-nums text-zinc-400 md:right-4 dark:text-zinc-500">peak {avax(peak)} AVAX</span>
            </span>
          )}
          <div className="absolute inset-0 flex items-end gap-px">
            {buckets.map((b, i) => (
              <div
                key={b.date}
                className={cn("flex h-full min-w-0 flex-1 flex-col-reverse transition-opacity duration-150", hover !== null && hover !== i && "opacity-35")}
                onMouseEnter={() => setHover(i)}
              >
                {FEE_LAYERS.map((l, li) => (
                  <span
                    key={l.key}
                    className={cn(
                      "w-full shrink-0 transition-opacity",
                      l.tone,
                      li === FEE_LAYERS.length - 1 && total(b) > 0 && "border-t border-zinc-700/70 dark:border-zinc-300/70",
                      focus && focus !== l.key && "opacity-15",
                    )}
                    style={{ height: (b[l.key] / max) * FEE_PX }}
                  />
                ))}
              </div>
            ))}
          </div>
          {hb && (
            <span
              className="pointer-events-none absolute top-2 z-20"
              style={
                hover! > (buckets.length - 1) / 2
                  ? { right: `calc(${100 - (hover! / buckets.length) * 100}% + 8px)` }
                  : { left: `calc(${((hover! + 1) / buckets.length) * 100}% + 8px)` }
              }
            >
              <TipPlate>
                <p className="whitespace-nowrap font-mono text-[10px] text-zinc-500">
                  {dateLabel(hb.date)} · {avax(total(hb))} AVAX{usdOf(total(hb), price) ? ` · ${usdOf(total(hb), price)}` : ""}
                </p>
                {FEE_LAYERS.map((l) => (
                  <p key={l.key} className="flex items-center justify-between gap-4 whitespace-nowrap font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-1.5", l.tone)} />
                      {l.label}
                    </span>
                    <span>{hb[l.key].toLocaleString("en-US", { maximumFractionDigits: 2 })} AVAX</span>
                  </p>
                ))}
              </TipPlate>
            </span>
          )}
        </div>
      </ReadoutBlock>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live block burns: the latest-blocks board's belt, one burn per block */

interface BlockBurn {
  number: number;
  burned: number;
  /** ms */
  timestamp: number;
}

interface ExplorerBlock {
  number: string;
  gasUsed: string;
  baseFeePerGas?: string;
  burnedFee?: string;
  timestampMilliseconds?: number;
  timestamp: string;
}

const BURN_POLL_MS = 2500;
const BURN_ROWS = 10;

/** the burn: the API's receipt sum when present, else the header
 *  estimate (block gasUsed × base fee) */
function burnOf(b: ExplorerBlock): number {
  if (b.burnedFee) return parseFloat(b.burnedFee);
  if (!b.baseFeePerGas) return 0;
  return (parseInt(b.gasUsed.replace(/,/g, ""), 10) * parseFloat(b.baseFeePerGas)) / 1e9;
}

function fmtBurn(v: number): string {
  if (v === 0) return "0";
  if (v < 0.00001) return v.toExponential(2);
  return v.toFixed(8).replace(/\.?0+$/, "");
}

function useBlockBurns() {
  const [burns, setBurns] = useState<BlockBurn[]>([]);
  const [failed, setFailed] = useState(false);
  const last = useRef<number | undefined>(undefined);
  const busy = useRef(false);

  const poll = useCallback(async (): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    try {
      const q = last.current !== undefined ? `lastFetchedBlock=${last.current}` : "initialLoad=true";
      const res = await fetch(`/api/explorer/43114?${q}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { stats?: { latestBlock?: number }; blocks?: ExplorerBlock[] } = await res.json();
      if (data.stats?.latestBlock) last.current = data.stats.latestBlock;
      if (data.blocks?.length) {
        const fresh = data.blocks.map((b) => ({
          number: parseInt(b.number, 10),
          burned: burnOf(b),
          timestamp: b.timestampMilliseconds || new Date(b.timestamp).getTime(),
        }));
        setBurns((prev) => {
          const by = new Map(prev.map((b) => [b.number, b]));
          for (const b of fresh) if (!by.has(b.number)) by.set(b.number, b);
          return [...by.values()].sort((a, b) => b.number - a.number).slice(0, BURN_ROWS + 1);
        });
      }
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    const loop = async () => {
      await poll();
      if (alive) timer = setTimeout(loop, BURN_POLL_MS);
    };
    loop();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [poll]);

  return { burns, failed };
}

export function LiveBurnsBoard() {
  const { burns, failed } = useBlockBurns();
  // the belt holds still under the pointer so a row can be clicked
  const [hover, setHover] = useState(false);
  const rows = useFreeze(burns, hover);
  const peak = Math.max(0, ...rows.map((r) => r.burned));
  const cols = "md:grid-cols-[6.5rem_minmax(0,1fr)_7.5rem_2.5rem]";
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label="Live Block Burns"
        action={
          <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            <LiveDot />
            C-Chain
          </span>
        }
      />
      <Board divide={false} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <div className={cn(HEAD, cols, "border-b border-zinc-200 dark:border-zinc-800")}>
          <span>Block</span>
          <span>Burn</span>
          <span className="text-right">AVAX</span>
          <span className="text-right">Age</span>
        </div>
        {rows.length === 0 && !failed && <RowSkeleton n={BURN_ROWS} />}
        {rows.length === 0 && failed && <p className="px-5 py-5 font-mono text-[11px] text-[#E6212F] md:px-6">block feed unavailable</p>}
        <Belt rows={BURN_ROWS}>
          {rows.map((b, i) => (
            <MotionRow key={b.number} animateIn overflow={i >= BURN_ROWS}>
              <Link href={`/explorer/mainnet/c-chain/block/${b.number}`} className={cn(ROW, cols)}>
                <span className={cn(INK, "md:order-1")}>{formatNumber(b.number)}</span>
                <span className={cn("text-right font-mono text-[12.5px] tabular-nums md:order-3", feeInk)}>{fmtBurn(b.burned)}</span>
                {/* the burn as the row's one bar, against the board's biggest */}
                <span className="col-span-2 md:order-2 md:col-span-1">
                  <span className="block h-1.5 w-full bg-zinc-100 dark:bg-zinc-900">
                    <span className="block h-full bg-[#E6212F]/80" style={{ width: `${peak > 0 ? Math.max(1.5, (b.burned / peak) * 100) : 0}%` }} />
                  </span>
                </span>
                <span className={cn(MUTED, "text-right max-md:hidden md:order-4")}>{ageShort(Math.floor(b.timestamp / 1000))}</span>
              </Link>
            </MotionRow>
          ))}
        </Belt>
      </Board>
    </section>
  );
}
