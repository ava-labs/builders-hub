"use client";

/* the answer's window, as buttons: the span it reads, and the spans it can be read over again with no model */

import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SPANS, type Moves, type SpanKey } from "@/lib/explorer-query/window-shift";
import { MOTION, useReduced } from "./motion";

const SEG =
  "relative flex h-7 items-center justify-center rounded-full px-2.5 font-mono text-[10.5px] font-medium tabular-nums transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 disabled:cursor-default";

export function WindowButtons({
  moves,
  own,
  moving,
  busy,
  onMove,
  onOwn,
}: {
  /** the window of the answer in view */
  moves: Moves;
  /** the window the answer was first given over, when it is none of the spans: a button of its own */
  own: string | null;
  /** the span being read now */
  moving: SpanKey | null;
  busy: boolean;
  onMove: (key: SpanKey) => void;
  /** back to the window the answer was first given over */
  onOwn: () => void;
}) {
  const id = useId();
  const reduced = useReduced();
  const items: { key: string; label: string; on: boolean; go: () => void }[] = [
    ...(own ? [{ key: "own", label: own, on: moves.span === null, go: onOwn }] : []),
    ...SPANS.map((s) => ({ key: s.key, label: s.label, on: moves.span === s.key, go: () => onMove(s.key) })),
  ];
  return (
    <div role="group" aria-label="Window" className="flex shrink-0 items-center gap-px rounded-full bg-zinc-100 p-0.5 ring-1 ring-inset ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
      {items.map((b) => (
        <button
          key={b.key}
          type="button"
          aria-pressed={b.on}
          disabled={busy || b.on}
          onClick={b.go}
          className={cn(SEG, b.on ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100", busy && !b.on && moving !== b.key && "opacity-50", moving === b.key && "animate-pulse text-zinc-900 dark:text-zinc-50")}
        >
          {b.on && <motion.span layoutId={`${id}-pill`} transition={reduced ? { duration: 0 } : MOTION} className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-zinc-700" />}
          <span className="relative">{b.label}</span>
        </button>
      ))}
    </div>
  );
}
