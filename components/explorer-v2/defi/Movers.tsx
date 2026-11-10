"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChartBoard, EmptyRow } from "@/components/explorer-v2/ui";
import { changeOf, deltaOf, type DefiProtocol, type Span } from "@/lib/defi/llama";
import { signedPct, signedUsd } from "./palette";
import { SPAN_LABEL } from "./data";

/* Where capital moved over the span: the protocols whose Avalanche
   TVL grew and shrank the most in dollars, drawn out from a shared zero,
   blue in and red out. A TVL move mixes deposits and price, so a token's
   rally reads as growth; the note says so. A bar opens its row. */

const EACH = 7;

export function Movers({ rows, span, onOpen }: { rows: DefiProtocol[]; span: Span; onOpen: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const { up, down, net, max } = useMemo(() => {
    const moved = rows
      .map((p) => ({ p, d: deltaOf(p, span) }))
      .filter((m): m is { p: DefiProtocol; d: number } => m.d !== null && m.d !== 0);
    const up = moved.filter((m) => m.d > 0).sort((a, b) => b.d - a.d).slice(0, EACH);
    const down = moved.filter((m) => m.d < 0).sort((a, b) => a.d - b.d).slice(0, EACH);
    const net = moved.reduce((s, m) => s + m.d, 0);
    const max = Math.max(1, ...up.map((m) => m.d), ...down.map((m) => -m.d));
    return { up, down, net, max };
  }, [rows, span]);

  const Row = ({ p, d }: { p: DefiProtocol; d: number }) => {
    const pct = changeOf(p, span);
    const w = `${(Math.abs(d) / max) * 100}%`;
    return (
      <li>
        <button
          type="button"
          onClick={() => onOpen(p.id)}
          onMouseEnter={() => setHover(p.id)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(p.id)}
          onBlur={() => setHover(null)}
          className={cn(
            "grid w-full grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 py-1.5 text-left transition-opacity sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1fr)]",
            hover !== null && hover !== p.id && "opacity-50",
          )}
        >
          <span className="truncate font-mono text-[11.5px] text-zinc-900 dark:text-zinc-100">{p.name}</span>
          {/* the left half holds outflows, the right half inflows */}
          <span className="flex h-3 justify-end">
            {d < 0 && <span className="h-full rounded-l-[2px]" style={{ width: w, background: "var(--d-down)" }} />}
          </span>
          <span className="flex h-3 items-center gap-2">
            {d > 0 && <span className="h-full rounded-r-[2px]" style={{ width: w, background: "var(--d-up)" }} />}
            <span className="shrink-0 whitespace-nowrap font-mono text-[10.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
              {signedUsd(d)}
              {pct !== null && <span className="text-zinc-400 dark:text-zinc-500"> · {signedPct(pct)}</span>}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <ChartBoard
      label={`Biggest Movers · ${span}`}
      className="flex min-w-0 flex-col"
      action={
        <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
          net <span className="text-zinc-900 dark:text-zinc-100">{signedUsd(net)}</span>
        </span>
      }
    >
      {up.length === 0 && down.length === 0 ? (
        <EmptyRow>No moves in this cut</EmptyRow>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Grew</p>
            <ul>{up.map((m) => <Row key={m.p.id} {...m} />)}</ul>
          </div>
          <div>
            <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Shrank</p>
            <ul>{down.map((m) => <Row key={m.p.id} {...m} />)}</ul>
          </div>
          <p className="font-mono text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
            Change in Avalanche TVL over {SPAN_LABEL[span]}. It includes price moves, so a rally in a token counts as growth.
          </p>
        </div>
      )}
    </ChartBoard>
  );
}
