"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChartBoard } from "@/components/explorer-v2/ui";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { StackBlock, type StackCol, type StackLayer } from "@/components/explorer-v2/gas/instruments";
import { useNarrow } from "@/components/explorer-v2/evm/query/motion";
import { fmtBurn } from "./token-live";

/* The token page's instruments: where the 720M cap sits, what was
   issued, what each chain has burned, and the fees burned on the page
   clock. Red is the burn's color here, as on the C-Chain; everything
   else is block gray and ink. */

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
/* Phones: the cap, the issued and the burn as bars                     */

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
    { key: "unissued", label: "Not yet issued", value: Math.max(0, supply - circulating), tone: "bg-[#A2AFB2]/35" },
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

/** what was issued: the genesis and every staking reward since, which is
 *  exactly what circulates plus what burned */
export function IssuedBoard({ genesis, rewards, circulating, burned }: { genesis: number; rewards: number; circulating: number; burned: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const issued = genesis + rewards;
  const parts: Part[] = [
    { key: "genesis", label: "Genesis", value: genesis, tone: "bg-zinc-300 dark:bg-zinc-600" },
    { key: "rewards", label: "Staking rewards", value: rewards, tone: "bg-zinc-100 ring-1 ring-inset ring-zinc-300 dark:bg-zinc-800 dark:ring-zinc-600" },
  ];
  return (
    <ChartBoard
      label="Issued"
      action={
        <span className="font-mono text-[10px] tabular-nums tracking-[0.08em] text-zinc-400 dark:text-zinc-500">
          {avax(issued)} = {avax(circulating)} circulating + {avax(burned)} burned
        </span>
      }
    >
      <ShareBar parts={parts} total={issued} hover={hover} setHover={setHover} />
      <ShareLegend parts={parts} total={issued} hover={hover} setHover={setHover} />
    </ChartBoard>
  );
}

export function BurnBoard({ c, p, x, sinceOpen = null }: { c: number; p: number; x: number; sinceOpen?: number | null }) {
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
        {sinceOpen !== null && <p className="font-mono text-[10px] tabular-nums text-[#E6212F]">+{fmtBurn(sinceOpen)} AVAX on the C-Chain since you opened this page</p>}
      </div>
    </ChartBoard>
  );
}

/* ------------------------------------------------------------------ */
/* Fees burned: the page clock's buckets as cuboids. The ICM contract's  */
/* fees are C-Chain gas too, so they are a floor of each column, not a   */
/* layer on top of it.                                                    */

export interface FeeBucket {
  date: string;
  cChainFees: number;
  icmFees: number;
}

const BURN_LAYERS: StackLayer[] = [
  {
    key: "icm",
    label: "ICM",
    what: "Interchain Messaging transactions",
    faces: ["fill-[#F6BDC1] dark:fill-[#6E2A30]", "fill-[#FBDDE0] dark:fill-[#8A3B42]", "fill-[#E08E95] dark:fill-[#4E1A1F]"],
    swatch: "bg-[#F6BDC1] dark:bg-[#6E2A30]",
  },
  {
    key: "rest",
    label: "Other",
    what: "every other C-Chain transaction",
    faces: ["fill-[#EE5A65] dark:fill-[#B8232F]", "fill-[#F8A5AB] dark:fill-[#D9434E]", "fill-[#C42331] dark:fill-[#7A1119]"],
    swatch: "bg-[#EE5A65] dark:bg-[#B8232F]",
  },
];

/* the Helicon upgrade: fees follow max(gas used, half the limit) from here */
const HELICON = "2026-09-22";

export function BurnHistory({
  buckets,
  label,
  dateLabel,
  tickLabel,
  note,
  price,
}: {
  buckets: FeeBucket[];
  label: string;
  /** a bucket's date, spelled for the plate */
  dateLabel: (date: string) => string;
  /** a bucket's date, short, for the axis */
  tickLabel: (date: string) => string;
  note?: string | null;
  price: number;
}) {
  const cols = useMemo<StackCol[]>(
    () =>
      buckets.map((b) => {
        const icm = Math.min(b.icmFees, b.cChainFees);
        return { key: b.date, long: dateLabel(b.date), tick: tickLabel(b.date), parts: { icm, rest: b.cChainFees - icm } };
      }),
    [buckets, dateLabel, tickLabel],
  );
  // beside the live panel the history stands as tall as it; a phone keeps it short
  const narrow = useNarrow();
  const all = buckets.reduce((s, b) => s + b.cChainFees, 0);
  // the bucket that holds the upgrade, when the window reaches back past it
  const hIdx = buckets.reduce((at, b, i) => (b.date <= HELICON ? i : at), -1);
  const marker = hIdx > 0 && hIdx < buckets.length ? { key: buckets[hIdx].date, label: "Helicon" } : undefined;

  return (
    <StackBlock
      label={label}
      note={note}
      figure={avax(all)}
      unit="AVAX"
      sub={`${usdOf(all, price) ? `${usdOf(all, price)} · ` : ""}${buckets.length > 1 ? `${dateLabel(buckets[0].date)} to ${dateLabel(buckets[buckets.length - 1].date)}` : ""}`}
      cols={cols}
      layers={BURN_LAYERS}
      marker={marker}
      height={narrow ? 220 : 340}
      fmt={(v) => `${avax(v)} AVAX`}
      tip={(c) => {
        const total = (c.parts.icm ?? 0) + (c.parts.rest ?? 0);
        return (
          <>
            <p className="whitespace-nowrap font-mono text-[10px] text-zinc-500">
              {c.long} · {avax(total)} AVAX{usdOf(total, price) ? ` · ${usdOf(total, price)}` : ""}
            </p>
            {(c.parts.icm ?? 0) > 0 && (
              <p className="whitespace-nowrap font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">ICM {c.parts.icm.toLocaleString("en-US", { maximumFractionDigits: 2 })} AVAX</p>
            )}
            <p className="whitespace-nowrap font-mono text-[11px] font-semibold tabular-nums text-[#E6212F]">{total.toLocaleString("en-US", { maximumFractionDigits: 2 })} AVAX burned</p>
          </>
        );
      }}
    />
  );
}
