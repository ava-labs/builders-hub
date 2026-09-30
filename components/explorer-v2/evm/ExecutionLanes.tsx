"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { Board } from "@/components/explorer-v2/ui";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import { cn } from "@/lib/utils";
import { PHASE_TITLE, PhaseTrack, phaseOf, useFreeze } from "./LiveBoards";
import { useNarrow, useReduced } from "./query/motion";
import type { Head, StreamTx } from "./useHeadStream";

/* Continuous Execution, live: the newest blocks on one height axis, in
   three lanes. ACCEPTED holds each block as consensus accepted it, its
   transactions as light squares. EXECUTED holds the same block once its
   receipts exist, in ink with reverts in red, filled square by square in
   the order they ran. STATE ROOT holds the mark of each block's root,
   solid once a later header commits it. Execution is FIFO and keeps pace
   on the C-Chain, so the two top lanes end flush and the queue reads 0;
   under load the blocks accepted and not yet executed stand hollow at
   the right. The root trails a few blocks, counted in blocks. Every block
   here is final. */

/** px a block */
const COL = 28;
/** five squares across, eight up; past that a block is one solid cell */
const MAX_SQUARES = 40;
const EASE = [0.22, 1, 0.36, 1] as const;

interface Column {
  number: number;
  txCount: number;
  timestampMs: number;
  /** receipts exist; null until the stream has read any, so a page just opened shows no queue it has not seen */
  executed: boolean | null;
  /** the block's receipts in the order they ran, when the stream pulled them; FIFO proves the rest executed */
  runs: StreamTx[] | null;
}

/** a value that changes only once it has held for `ms`: a head and its receipts land in one poll, and the queue must
    not read 1 between them */
function useSteady<T>(value: T, ms: number): T {
  const [steady, setSteady] = useState(value);
  useEffect(() => {
    if (Object.is(value, steady)) return;
    const t = setTimeout(() => setSteady(value), ms);
    return () => clearTimeout(t);
  }, [value, steady, ms]);
  return steady;
}

/** a block's transactions as squares, bottom row first; the executed lane lights them one by one in their order */
function Squares({ col, lane, fresh, reduced }: { col: Column; lane: "accepted" | "executed"; fresh: boolean; reduced: boolean }) {
  // a block the board opened on stands filled; one that executes on screen fills square by square
  const [lit, setLit] = useState(lane === "executed" && col.executed && !fresh);
  useEffect(() => {
    if (lane !== "executed" || !col.executed || lit) return;
    const r = requestAnimationFrame(() => setLit(true));
    return () => cancelAnimationFrame(r);
  }, [lane, col.executed, lit]);
  if (lane === "executed" && col.executed === null) return null;
  if (col.txCount === 0) return <span className="mb-px h-px w-4 bg-zinc-300 dark:bg-zinc-700" />;
  const hollow = lane === "executed" && !col.executed;
  const ink = (i: number) => (lane === "accepted" ? "bg-zinc-300 dark:bg-zinc-700" : !lit ? "bg-transparent" : col.runs?.[i] && !col.runs[i].success ? "bg-[#E6212F]" : "bg-zinc-700 dark:bg-zinc-300");
  const stagger = Math.min(12, 600 / col.txCount);
  if (col.txCount > MAX_SQUARES) return <span className={cn("h-[39px] w-6", hollow ? "ring-1 ring-inset ring-zinc-200 dark:ring-zinc-800" : ink(0), !reduced && "transition-colors duration-[80ms]")} />;
  return (
    <span className={cn("flex w-6 flex-wrap-reverse gap-px", hollow && "ring-1 ring-zinc-200 ring-offset-1 ring-offset-transparent dark:ring-zinc-800")}>
      {Array.from({ length: col.txCount }, (_, i) => (
        <span key={i} className={cn("h-1 w-1", ink(i), !reduced && lane === "executed" && "transition-colors duration-[80ms]")} style={reduced || lane === "accepted" ? undefined : { transitionDelay: `${Math.round(i * stagger)}ms` }} />
      ))}
    </span>
  );
}

export function ExecutionLanes({ heads, executedHeight, txs, live, base }: { heads: Head[]; executedHeight: number | null; txs: StreamTx[]; live: boolean; base: string }) {
  const reduced = useReduced();
  const narrow = useNarrow();
  const strip = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(24);
  useLayoutEffect(() => {
    const el = strip.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setFit(Math.max(6, Math.floor(e.contentRect.width / COL))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [hot, setHot] = useState<{ n: number; left: number; right: boolean } | null>(null);
  const tip = heads[0] ?? null;
  const settled = tip?.settledHeight ?? null;
  // one past the window, for the slide out on the left
  const cols: Column[] = heads
    .slice(0, fit + 1)
    .reverse()
    .map((h) => {
      const runs = txs.filter((t) => t.blockNumber === h.number).sort((a, b) => a.txIndex - b.txIndex);
      return { number: h.number, txCount: h.txCount, timestampMs: h.timestampMs, executed: executedHeight === null ? null : h.number <= executedHeight, runs: runs.length ? runs : null };
    });
  // the strip holds still under the pointer so a block can be read and opened
  const shown = useFreeze({ cols, settled }, hot !== null);
  const hotN = hot?.n ?? null;
  // the board's first frame stands still; after it, a block that arrives fades in and a block that executes fills
  const opened = useRef(false);
  useEffect(() => void (opened.current = true), []);
  // a jump of more than three heads (a tab come back) moves at once, no slide
  const lastTip = useRef<number | null>(null);
  const jump = tip !== null && lastTip.current !== null && tip.number - lastTip.current > 3;
  useEffect(() => void (lastTip.current = tip?.number ?? null), [tip?.number]);
  const queue = useSteady(tip && executedHeight !== null ? Math.max(0, tip.number - executedHeight) : null, 1000);
  const rootGap = tip && settled !== null ? tip.number - settled : null;
  const hover = hotN === null ? null : (shown.cols.find((c) => c.number === hotN) ?? null);
  const reverted = (c: Column) => c.runs?.filter((t) => !t.success).length ?? 0;
  const readings = {
    accepted: tip ? `#${formatNumber(tip.number)}` : "…",
    executed: queue === null ? "…" : queue === 0 ? "queue 0" : `queue ${queue} · #${formatNumber((executedHeight ?? 0) + 1)} executing`,
    root: settled === null || rootGap === null ? "…" : `#${formatNumber(settled)} committed · ${rootGap} executing`,
  };
  const lanes = [
    { label: "Accepted", reading: readings.accepted, title: "Final: consensus accepted it. Squares are its transactions.", h: "h-10" },
    { label: "Executed", reading: readings.executed, title: "Receipts exist. Execution is FIFO, so a filled cell proves every cell left of it. Hollow: accepted, not yet executed.", h: "h-10" },
    { label: "State Root", reading: readings.root, title: "Every block here is final. Under Continuous Execution the state root is committed by a later block; this lane shows whether that has happened yet.", h: "h-4" },
  ];
  return (
    <Board divide={false} className="flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-5 md:px-6">
        <span className={cn("font-mono text-[10px] font-bold uppercase tracking-[0.18em]", live ? "text-[#E6212F]" : "text-zinc-400")}>{live ? "live" : "reconnecting"}</span>
        {narrow && (
          <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
            <span className="whitespace-nowrap">{readings.executed}</span> · <span className="whitespace-nowrap">root {readings.root}</span>
          </span>
        )}
      </div>
      <div className="relative flex gap-4 px-5 pb-5 pt-4 md:px-6">
        <div className={cn("flex shrink-0 flex-col gap-2", narrow ? "w-[5.5rem]" : "w-56")}>
          {lanes.map((l) => (
            <div key={l.label} title={l.title} className={cn("flex cursor-help flex-col justify-end", l.h)}>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{l.label}</span>
              {!narrow && l.reading && <span className="truncate font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">{l.reading}</span>}
            </div>
          ))}
        </div>
        <div ref={strip} className="flex min-w-0 flex-1 justify-end overflow-hidden" onMouseLeave={() => setHot(null)}>
          {shown.cols.map((c) => {
            const fresh = opened.current;
            return (
              <motion.div
                key={c.number}
                layout={reduced || jump ? false : "position"}
                initial={fresh && !reduced ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ layout: { duration: 0.5, ease: EASE }, opacity: { duration: 0.2 } }}
                className="shrink-0"
                style={{ width: COL }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  // the plate opens toward the middle: from the block's left edge in the strip's left half, else its right
                  const box = strip.current?.getBoundingClientRect();
                  setHot({ n: c.number, left: el.offsetLeft, right: !!box && el.getBoundingClientRect().left > box.left + box.width / 2 });
                }}
              >
                <Link href={`${base}/block/${c.number}`} aria-label={`Block ${formatNumber(c.number)}`} className={cn("flex flex-col items-center gap-2 transition-opacity", hotN !== null && hotN !== c.number && "opacity-40")}>
                  <span className="flex h-10 items-end">
                    <Squares col={c} lane="accepted" fresh={fresh} reduced={reduced} />
                  </span>
                  <span className="flex h-10 items-end">
                    <Squares col={c} lane="executed" fresh={fresh} reduced={reduced} />
                  </span>
                  <span className="flex h-4 items-center">
                    <PhaseTrack phase={phaseOf(c.number, c.executed ? c.number : null, shown.settled)} label={false} />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
        {hover && hot && (
          <div className={cn("pointer-events-none absolute bottom-full z-10 -mb-3", hot.right && "-translate-x-full")} style={{ left: hot.right ? hot.left + COL : hot.left }}>
            <TipPlate>
              <p className="font-mono text-[11px] text-zinc-900 dark:text-zinc-100">#{formatNumber(hover.number)}</p>
              <p className="whitespace-nowrap font-mono text-[10px] tabular-nums text-zinc-500">
                {formatNumber(hover.txCount)} {hover.txCount === 1 ? "tx" : "txs"}
                {reverted(hover) ? ` · ${reverted(hover)} reverted` : ""} · {new Date(hover.timestampMs).toISOString().slice(11, 23)} UTC
              </p>
              <p className="whitespace-nowrap font-mono text-[10px] text-zinc-400">
                {hover.executed === false ? `final: accepted; queued behind #${formatNumber((executedHeight ?? hover.number - 1) + 1)}` : PHASE_TITLE[phaseOf(hover.number, hover.executed ? hover.number : null, shown.settled)]}
              </p>
              {hover.runs
                ?.slice()
                .sort((a, b) => Number(a.success) - Number(b.success))
                .slice(0, 4)
                .map((t) => (
                  <p key={t.hash} className="whitespace-nowrap font-mono text-[10px] text-zinc-400">
                    {truncate(t.hash, 6)} {!t.success && <span className="text-[#E6212F]">reverted</span>}
                  </p>
                ))}
            </TipPlate>
          </div>
        )}
      </div>
      <p className="px-5 pb-4 font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-400 md:px-6 dark:text-zinc-500">hover reads · click opens · hollow cells queued · red squares reverted</p>
    </Board>
  );
}
