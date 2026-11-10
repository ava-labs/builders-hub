"use client";

import { useMemo, useState } from "react";
import { useReduced } from "@/components/explorer-v2/evm/query/motion";
import type { CategoryFlow } from "@/lib/defi/flows";
import { flowGroup, flowLabel } from "./flow-labels";
import { groupTone, signedUsd, usd } from "./palette";

/* The window's money as a river: wallets on the left send into each
   category of protocol in the middle, and each category pays back out to
   wallets on the right. A ribbon's width is its USD, so a category whose
   left ribbon is wider than its right one took in more than it paid out.
   A slow current runs along each ribbon; it stops for readers who ask
   for less motion. */

const W = 1000;
const H = 440;
const NODE = 12;
const GAP = 14;
const MID = (W - NODE) / 2;

interface Band {
  c: CategoryFlow;
  /** the category node's top and height */
  y: number;
  h: number;
  /** the in and out ribbons' heights */
  hi: number;
  ho: number;
  /** where each ribbon meets the wallet node on its side */
  ly: number;
  ry: number;
}

function ribbon(x0: number, y0: number, x1: number, y1: number, h: number): string {
  const mx = (x0 + x1) / 2;
  return `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1} L${x1},${y1 + h} C${mx},${y1 + h} ${mx},${y0 + h} ${x0},${y0 + h} Z`;
}

function spine(x0: number, y0: number, x1: number, y1: number): string {
  const mx = (x0 + x1) / 2;
  return `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
}

export function FlowRiver({ categories, hours }: { categories: CategoryFlow[]; hours: number }) {
  const reduced = useReduced();
  const [hover, setHover] = useState<string | null>(null);

  const layout = useMemo(() => {
    const cats = categories.filter((c) => c.inflow + c.outflow > 0);
    const totalIn = cats.reduce((s, c) => s + c.inflow, 0);
    const totalOut = cats.reduce((s, c) => s + c.outflow, 0);
    const span = cats.reduce((s, c) => s + Math.max(c.inflow, c.outflow), 0);
    if (!cats.length || span <= 0) return null;
    const k = (H - GAP * (cats.length - 1)) / span;
    // the wallet nodes stand centered on their side, as tall as what they send or receive
    const leftTop = (H - totalIn * k) / 2;
    const rightTop = (H - totalOut * k) / 2;
    let y = 0;
    let ly = leftTop;
    let ry = rightTop;
    const bands: Band[] = cats.map((c) => {
      const h = Math.max(c.inflow, c.outflow) * k;
      const b = { c, y, h, hi: c.inflow * k, ho: c.outflow * k, ly, ry };
      y += h + GAP;
      ly += b.hi;
      ry += b.ho;
      return b;
    });
    return { bands, totalIn, totalOut, leftTop, rightTop, k };
  }, [categories]);

  if (!layout) {
    return <p className="flex h-40 items-center justify-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">No flows in this window</p>;
  }
  const { bands, totalIn, totalOut, leftTop, rightTop } = layout;
  const lit = (key: string) => hover === null || hover === key;
  const hd = hover ? bands.find((b) => b.c.category === hover) : null;

  const max = Math.max(1, ...bands.map((b) => Math.max(b.c.inflow, b.c.outflow)));
  return (
    <>
    {/* a phone has no room for the river's labels: the same numbers, one row a category */}
    <div className="flex flex-col gap-1 sm:hidden">
      <div className="grid grid-cols-[minmax(0,6rem)_minmax(0,1fr)_minmax(0,1fr)_4.5rem] gap-x-2 pb-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
        <span />
        <span className="text-right">out</span>
        <span>in</span>
        <span className="text-right">net</span>
      </div>
      {bands.map((b) => {
        const tone = groupTone(flowGroup(b.c.category));
        return (
          <div key={b.c.category} className="grid grid-cols-[minmax(0,6rem)_minmax(0,1fr)_minmax(0,1fr)_4.5rem] items-center gap-x-2 py-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-[1px]" style={{ background: tone }} />
              <span className="truncate font-mono text-[11px] text-zinc-900 dark:text-zinc-100">{flowLabel(b.c.category)}</span>
            </span>
            <span className="flex h-3 justify-end">
              <span className="h-full rounded-l-[2px] opacity-55" style={{ width: `${(b.c.outflow / max) * 100}%`, background: tone }} />
            </span>
            <span className="flex h-3">
              <span className="h-full rounded-r-[2px]" style={{ width: `${(b.c.inflow / max) * 100}%`, background: tone }} />
            </span>
            <span className="text-right font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">{signedUsd(b.c.net)}</span>
          </div>
        );
      })}
    </div>
    <div className="relative hidden sm:block" onMouseLeave={() => setHover(null)}>
      <style>{`@keyframes defi-current { to { stroke-dashoffset: -64; } }`}</style>
      <svg viewBox={`-150 -10 ${W + 300} ${H + 20}`} className="h-auto w-full" role="img" aria-label={`Flows over ${hours} hours: ${usd(totalIn)} into DeFi, ${usd(totalOut)} out`}>
        {/* the wallet nodes */}
        <rect x={0} y={leftTop} width={NODE} height={totalIn * layout.k} rx={2} className="fill-zinc-800 dark:fill-zinc-200" />
        <rect x={W - NODE} y={rightTop} width={NODE} height={totalOut * layout.k} rx={2} className="fill-zinc-800 dark:fill-zinc-200" />
        <text x={-12} y={H / 2 - 6} textAnchor="end" className="fill-zinc-900 font-mono text-[15px] font-bold dark:fill-zinc-100">
          Wallets
        </text>
        <text x={-12} y={H / 2 + 14} textAnchor="end" className="fill-zinc-500 font-mono text-[13px] dark:fill-zinc-400">
          {usd(totalIn)} in
        </text>
        <text x={W + 12} y={H / 2 - 6} className="fill-zinc-900 font-mono text-[15px] font-bold dark:fill-zinc-100">
          Wallets
        </text>
        <text x={W + 12} y={H / 2 + 14} className="fill-zinc-500 font-mono text-[13px] dark:fill-zinc-400">
          {usd(totalOut)} out
        </text>

        {bands.map((b) => {
          const tone = groupTone(flowGroup(b.c.category));
          const on = lit(b.c.category);
          const iy = b.y + (b.h - b.hi) / 2;
          const oy = b.y + (b.h - b.ho) / 2;
          const inPath = spine(NODE, b.ly + b.hi / 2, MID, iy + b.hi / 2);
          const outPath = spine(MID + NODE, oy + b.ho / 2, W - NODE, b.ry + b.ho / 2);
          const dash = (h: number) => ({
            strokeWidth: Math.max(1, Math.min(3, h / 3)),
            strokeDasharray: "2 30",
            animation: reduced ? undefined : `defi-current ${2.4}s linear infinite`,
          });
          return (
            <g
              key={b.c.category}
              onMouseEnter={() => setHover(b.c.category)}
              className="cursor-default transition-opacity duration-200"
              style={{ opacity: on ? 1 : 0.18 }}
            >
              <path d={ribbon(NODE, b.ly, MID, iy, b.hi)} fill={tone} fillOpacity={0.38} />
              <path d={ribbon(MID + NODE, oy, W - NODE, b.ry, b.ho)} fill={tone} fillOpacity={0.24} />
              {b.hi > 1.5 && <path d={inPath} fill="none" stroke="var(--d-current)" strokeOpacity={0.8} strokeLinecap="round" style={dash(b.hi)} />}
              {b.ho > 1.5 && <path d={outPath} fill="none" stroke="var(--d-current)" strokeOpacity={0.8} strokeLinecap="round" style={dash(b.ho)} />}
              <rect x={MID} y={b.y} width={NODE} height={Math.max(2, b.h)} rx={2} fill={tone} />
              {b.h >= 16 && (
                <text x={MID + NODE + 8} y={b.y + Math.min(b.h / 2, 18) + 4} className="fill-zinc-900 font-mono text-[13px] font-bold dark:fill-zinc-100">
                  {flowLabel(b.c.category)}
                  <tspan className="fill-zinc-500 font-normal dark:fill-zinc-400"> · net {signedUsd(b.c.net)}</tspan>
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hd && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 border border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <p className="font-mono text-[11px] font-bold text-zinc-900 dark:text-zinc-100">{flowLabel(hd.c.category)}</p>
          <p className="font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">
            {usd(hd.c.inflow)} in · {usd(hd.c.outflow)} out · net {signedUsd(hd.c.net)}
          </p>
          {hd.c.stableNet !== 0 && <p className="font-mono text-[10px] tabular-nums text-zinc-400">stablecoins net {signedUsd(hd.c.stableNet)}</p>}
        </div>
      )}
    </div>
    </>
  );
}
