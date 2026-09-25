"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board, INK } from "@/components/explorer-v2/ui";
import { formatNumber, formatTime } from "@/components/explorer-v2/format";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { useFreeze } from "./LiveBoards";
import { setSelection, askAbout } from "@/components/explorer-v2/dig/selection";

/* The level above the block: a run of blocks as one strip, each a
   column as tall as the share of its limit it reserved, in chain order.
   Same grammar as the gas map on a block page: hover reads the block,
   click opens it, drag selects a run and sums it. Zoom out from a block
   and this is what you land on; click a column and you are back in. */

export interface RangeBlock {
  number: number;
  timestampMs: number;
  txCount: number;
  gasUsed: number;
  gasLimit: number;
}

export function BlockRangeMap({ blocks, base, live }: { blocks: RangeBlock[]; base: string; live: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const [inside, setInside] = useState(false);
  // by height, not position: live columns shift as blocks arrive
  const [range, setRange] = useState<[number, number] | null>(null);

  // the strip holds still under the pointer so a column can be clicked
  const held = useFreeze(blocks, inside);
  const ordered = [...held].sort((a, b) => a.number - b.number);
  const hoverBlock = hover !== null ? ordered.find((b) => b.number === hover) : undefined;

  const inRange = (b: RangeBlock) => !!range && b.number >= range[0] && b.number <= range[1];
  const selected = range ? ordered.filter(inRange) : [];

  // publish the run: what it did and where it leads
  useEffect(() => {
    if (!range || selected.length === 0) {
      setSelection(null);
      return;
    }
    const txs = selected.reduce((s, b) => s + b.txCount, 0);
    const gas = selected.reduce((s, b) => s + b.gasUsed, 0);
    const limit = selected.reduce((s, b) => s + b.gasLimit, 0);
    const first = selected[0];
    const last = selected[selected.length - 1];
    const spanS = (last.timestampMs - first.timestampMs) / 1000;
    const title = `${selected.length} block${selected.length === 1 ? "" : "s"} · #${formatNumber(first.number)} to #${formatNumber(last.number)} · ${formatNumber(txs)} txs · ${limit ? ((gas / limit) * 100).toFixed(1) : "0"}% of the limit reserved`;
    setSelection({
      kind: "blocks",
      title,
      brief: [
        `Selection on the blocks strip: ${title}.`,
        `Span ${spanS.toFixed(1)} s from ${formatTime(Math.floor(first.timestampMs / 1000))} to ${formatTime(Math.floor(last.timestampMs / 1000))} UTC.`,
        `Gas reserved ${formatNumber(gas)} of ${formatNumber(limit)}.`,
        `Blocks:`,
        ...selected.slice(0, 20).map((b) => `- #${b.number} ${b.txCount} txs, ${b.gasUsed} of ${b.gasLimit} gas reserved (${b.gasLimit ? ((b.gasUsed / b.gasLimit) * 100).toFixed(1) : "0"}%)`),
      ].join("\n"),
      hrefs: [`${base}/block/${first.number}`, `${base}/block/${last.number}`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, selected.length, selected[0]?.number, selected[selected.length - 1]?.number]);
  useEffect(() => () => setSelection(null), []);

  /* drag to select a run; a click still opens the block */
  const strip = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x0: number; n0: number; moved: boolean } | null>(null);
  const swallow = useRef(false);
  const numberAt = (clientX: number): number => {
    const kids = strip.current?.children;
    if (!kids || kids.length === 0) return 0;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i] as HTMLElement;
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) return Number(el.dataset.n);
      const d = clientX < r.left ? r.left - clientX : clientX - r.right;
      if (d < bestD) {
        bestD = d;
        best = Number(el.dataset.n);
      }
    }
    return best;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x0: e.clientX, n0: numberAt(e.clientX), moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.x0) < 4) return;
    d.moved = true;
    const n = numberAt(e.clientX);
    setRange([Math.min(d.n0, n), Math.max(d.n0, n)]);
  };
  const onPointerUp = () => {
    if (drag.current?.moved) swallow.current = true;
    drag.current = null;
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (!swallow.current) return;
    swallow.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const txs = ordered.reduce((s, b) => s + b.txCount, 0);
  const gas = ordered.reduce((s, b) => s + b.gasUsed, 0);
  const limit = ordered.reduce((s, b) => s + b.gasLimit, 0);
  const selTxs = selected.reduce((s, b) => s + b.txCount, 0);
  const selGas = selected.reduce((s, b) => s + b.gasUsed, 0);
  const selLimit = selected.reduce((s, b) => s + b.gasLimit, 0);

  return (
    <Board divide={false} className="flex flex-col" onMouseEnter={() => setInside(true)} onMouseLeave={() => setInside(false)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-5 md:px-6">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          Block Map{live ? <span className="ml-3 text-[#E6212F]">live</span> : null}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
          <span className={INK}>{ordered.length}</span> blocks · {formatNumber(txs)} txs · <span className={INK}>{limit ? ((gas / limit) * 100).toFixed(1) : "0"}%</span> of the limit reserved
        </span>
      </div>
      <div className="flex flex-col gap-4 px-5 pb-5 pt-4 md:px-6">
        <div className="relative">
          <div
            ref={strip}
            className="flex h-20 w-full select-none items-end gap-[2px]"
            style={{ touchAction: "pan-y" }}
            onMouseLeave={() => setHover(null)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClickCapture={onClickCapture}
          >
            {ordered.map((b) => {
              const fill = b.gasLimit > 0 ? b.gasUsed / b.gasLimit : 0;
              const out = !!range && !inRange(b);
              const dim = out || (hover !== null && hover !== b.number);
              return (
                <Link
                  key={b.number}
                  data-n={b.number}
                  href={`${base}/block/${b.number}`}
                  draggable={false}
                  onMouseEnter={() => setHover(b.number)}
                  onFocus={() => setHover(b.number)}
                  aria-label={`block ${b.number}, ${b.txCount} txs, ${(fill * 100).toFixed(0)}% of the limit`}
                  className={cn("relative flex h-full min-w-[2px] flex-1 items-end transition-opacity duration-150", dim && (out ? "opacity-20" : "opacity-40"))}
                >
                  {/* the column: the block's share of its limit */}
                  <span
                    className={cn("block w-full", fill >= 0.9 ? "bg-[#E6212F]" : b.txCount === 0 ? "bg-zinc-200 dark:bg-zinc-800" : "bg-zinc-700 dark:bg-zinc-300")}
                    style={{ height: `${Math.max(3, fill * 100)}%` }}
                  />
                </Link>
              );
            })}
          </div>
          {hoverBlock && !drag.current?.moved && (
            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2">
              <TipPlate>
                <p className="font-mono text-[11px] text-zinc-900 dark:text-zinc-100">#{formatNumber(hoverBlock.number)}</p>
                <p className="font-mono text-[10px] tabular-nums text-zinc-500">
                  {hoverBlock.txCount} tx{hoverBlock.txCount === 1 ? "" : "s"} · {formatNumber(hoverBlock.gasUsed)} gas reserved · {hoverBlock.gasLimit ? ((hoverBlock.gasUsed / hoverBlock.gasLimit) * 100).toFixed(1) : "0"}% of the limit
                </p>
                <p className="font-mono text-[10px] text-zinc-400">{formatTime(Math.floor(hoverBlock.timestampMs / 1000))} UTC</p>
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-300 dark:text-zinc-600">click opens · drag selects</p>
              </TipPlate>
            </div>
          )}
        </div>

        {range && selected.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border border-zinc-900 px-3 py-2 font-mono text-[11px] dark:border-zinc-100">
            <span className="flex flex-wrap items-baseline gap-x-3 tabular-nums text-zinc-900 dark:text-zinc-50">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E6212F]">Selected</span>
              <span>
                {selected.length} block{selected.length === 1 ? "" : "s"}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                <Link href={`${base}/block/${selected[0].number}`} className="hover:text-[#E6212F]">
                  #{formatNumber(selected[0].number)}
                </Link>
                {" to "}
                <Link href={`${base}/block/${selected[selected.length - 1].number}`} className="hover:text-[#E6212F]">
                  #{formatNumber(selected[selected.length - 1].number)}
                </Link>
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">{formatNumber(selTxs)} txs</span>
              <span className="text-zinc-500 dark:text-zinc-400">{formatNumber(selGas)} gas reserved</span>
              <span className="text-zinc-500 dark:text-zinc-400">{selLimit ? ((selGas / selLimit) * 100).toFixed(1) : "0"}% of the limit</span>
              <span className="text-zinc-400 dark:text-zinc-500">{((selected[selected.length - 1].timestampMs - selected[0].timestampMs) / 1000).toFixed(1)} s</span>
            </span>
            <span className="flex items-center gap-4 text-[10px] uppercase tracking-[0.14em]">
              <button
                type="button"
                onClick={() => askAbout(`Explain what happened in the ${selected.length} selected blocks.`)}
                className="text-zinc-600 hover:text-[#E6212F] dark:text-zinc-300"
              >
                Ask about this
              </button>
              <button type="button" onClick={() => setRange(null)} className="text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-50">
                Clear
              </button>
            </span>
          </div>
        )}
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-300 dark:text-zinc-600">hover reads · click opens · drag selects · red columns reserved 90% or more</p>
      </div>
    </Board>
  );
}
