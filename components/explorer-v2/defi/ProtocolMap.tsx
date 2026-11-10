"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ChartBoard } from "@/components/explorer-v2/ui";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { ViewSwitch } from "@/components/explorer-v2/network/icm-parts";
import { changeOf, type DefiProtocol, type Span } from "@/lib/defi/llama";
import { GROUP, GROUPS } from "@/lib/defi/taxonomy";
import { squarify } from "@/lib/defi/treemap";
import { changeTone, groupInk, groupTone, signedPct, usd } from "./palette";
import { SPAN_LABEL } from "./data";

/* Every protocol in the table's cut as a tile sized by its Avalanche
   TVL. Colored by category it shows where the money sits; colored by
   change it is a heat map of the span: blue grew, red shrank, gray
   held. The table's filter feeds it, so a category picked below zooms
   the map to that category. A tile opens its protocol's row. */

const TILES = 40;
const CAP = 25;

type Mode = "group" | "change";

interface Node {
  kind: "protocol" | "rest";
  p?: DefiProtocol;
  n?: number;
  tvl: number;
}

export function ProtocolMap({ rows, span, onOpen }: { rows: DefiProtocol[]; span: Span; onOpen: (id: string) => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("group");

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = useMemo(() => rows.reduce((s, p) => s + p.tvl, 0), [rows]);
  const nodes = useMemo<Node[]>(() => {
    const sorted = [...rows].filter((p) => p.tvl > 0).sort((a, b) => b.tvl - a.tvl);
    const top = sorted.slice(0, TILES).map((p) => ({ kind: "protocol" as const, p, tvl: p.tvl }));
    const rest = sorted.slice(TILES);
    const restTvl = rest.reduce((s, p) => s + p.tvl, 0);
    return restTvl > 0 ? [...top, { kind: "rest", n: rest.length, tvl: restTvl }] : top;
  }, [rows]);
  const tiles = useMemo(() => (size ? squarify(nodes.map((n) => ({ value: n.tvl, item: n })), size.w, size.h) : []), [nodes, size]);
  const groupsShown = useMemo(() => GROUPS.filter((g) => rows.some((p) => p.group === g.key)), [rows]);
  const hd = hover !== null ? tiles[hover] : null;

  return (
    <ChartBoard
      label="Protocol Map"
      className="flex min-w-0 flex-col"
      bodyClassName="flex flex-1 flex-col gap-4"
      action={
        <ViewSwitch
          id="defi-map-mode"
          value={mode}
          onChange={setMode}
          options={[
            { v: "group", label: "Category" },
            { v: "change", label: `Change · ${span}` },
          ]}
        />
      }
    >
      <div ref={frame} className="relative h-[22rem] sm:h-[30rem]" onMouseLeave={() => setHover(null)}>
        {rows.length === 0 && (
          <p className="flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
            No protocols in this cut
          </p>
        )}
        {tiles.map((t, i) => {
          const n = t.item;
          const p = n.p;
          const pct = p ? changeOf(p, span) : null;
          const fill = !p ? "var(--d-flat)" : mode === "group" ? groupTone(p.group) : changeTone(pct, CAP);
          const strong = mode === "change" && pct !== null && Math.abs(pct) / CAP > 0.55;
          const ink = !p ? undefined : mode === "group" ? groupInk(p.group) : undefined;
          const roomy = t.w > 70 && t.h > 34;
          const big = t.w > 120 && t.h > 64;
          const on = hover === i;
          return (
            <button
              key={p ? p.id : "rest"}
              type="button"
              disabled={!p}
              onClick={() => p && onOpen(p.id)}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={p ? `${p.name}: ${usd(p.tvl)}${pct !== null ? `, ${signedPct(pct)} over ${SPAN_LABEL[span]}` : ""}` : `${n.n} more protocols: ${usd(n.tvl)}`}
              className={cn(
                "absolute overflow-hidden border border-[color:var(--d-gap)] p-2 text-left transition-[filter] duration-150 disabled:cursor-default",
                on && "brightness-110",
                !ink && (strong ? "text-white" : "text-zinc-900 dark:text-zinc-50"),
              )}
              style={{ left: t.x, top: t.y, width: t.w, height: t.h, background: fill, color: ink }}
            >
              {roomy && (
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {p?.logo && big && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.logo} alt="" width={14} height={14} className="h-3.5 w-3.5 shrink-0 rounded-full bg-white/70" loading="lazy" />
                    )}
                    <span className="truncate font-mono text-[11px] font-bold">{p ? p.name : `${n.n} more`}</span>
                  </span>
                  <span className="truncate font-mono text-[10px] tabular-nums opacity-80">
                    {usd(n.tvl)}
                    {big && p && mode === "change" && pct !== null ? ` · ${signedPct(pct)}` : ""}
                    {big && p && mode === "group" ? ` · ${((p.tvl / (total || 1)) * 100).toFixed(1)}%` : ""}
                  </span>
                </span>
              )}
            </button>
          );
        })}
        {hd && size && (
          <span
            className="pointer-events-none absolute z-20"
            style={{
              top: Math.max(0, Math.min(hd.y + 8, size.h - 96)),
              ...(hd.x + hd.w / 2 > size.w / 2 ? { right: size.w - hd.x + 6 } : { left: hd.x + hd.w + 6 }),
            }}
          >
            <TipPlate>
              {hd.item.p ? (
                <>
                  <p className="font-mono text-[10px] text-zinc-500">
                    {GROUP[hd.item.p.group].label} · {hd.item.p.category}
                  </p>
                  <p className="whitespace-nowrap font-mono text-[11px] font-bold text-zinc-900 dark:text-zinc-100">{hd.item.p.name}</p>
                  <p className="whitespace-nowrap font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                    {usd(hd.item.p.tvl)} <span className="text-zinc-400">· {((hd.item.p.tvl / (total || 1)) * 100).toFixed(1)}% of this map</span>
                  </p>
                  {changeOf(hd.item.p, span) !== null && (
                    <p className="whitespace-nowrap font-mono text-[10.5px] tabular-nums text-zinc-500">
                      {signedPct(changeOf(hd.item.p, span) ?? 0)} over {SPAN_LABEL[span]}
                    </p>
                  )}
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-400">Click to open its row</p>
                </>
              ) : (
                <p className="whitespace-nowrap font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                  {hd.item.n} smaller protocols · {usd(hd.item.tvl)}
                </p>
              )}
            </TipPlate>
          </span>
        )}
      </div>
      {/* the key: categories in category mode, the diverging scale in change mode */}
      {mode === "group" ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
          {groupsShown.map((g) => (
            <span key={g.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[1px]" style={{ background: groupTone(g.key) }} />
              {g.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
          <span>−{CAP}%</span>
          <span className="flex h-2 w-40 overflow-hidden rounded-[1px]">
            {[-25, -15, -8, -2, 0, 2, 8, 15, 25].map((v) => (
              <span key={v} className="flex-1" style={{ background: changeTone(v, CAP) }} />
            ))}
          </span>
          <span>+{CAP}%</span>
          <span className="ml-2 text-zinc-400 dark:text-zinc-500">Avalanche TVL over {SPAN_LABEL[span]}</span>
        </div>
      )}
    </ChartBoard>
  );
}
