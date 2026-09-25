"use client";

import { Fragment } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/components/explorer-v2/format";
import type { DrillAnswer } from "@/lib/explorer-query/types";
import type { Selection } from "@/lib/explorer-query/selection";
import { RecordPlot, ResultTable, type Row, isTxList } from "./QueryRows";
import { TxCards } from "./QueryInspector";

/* A drill is a zoom, not a new section below the fold. The chart's own
   place turns into the records behind the mark that was picked, with a
   trail above it back to where the reader was. Each level keeps the
   selection it was opened from, so going back up restores it. */

/** one group, opened into the records behind it */
export interface OpenDrill {
  title: string;
  row: Row;
  index: number;
  answer: DrillAnswer | null;
  error: string | null;
  /** the selection on the level above, handed back on the way up */
  prev: Selection;
}

/** the trail: "All <answer> › <picked>"; every crumb but the last goes back */
export function Crumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav aria-label="Zoom" className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px]">
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-zinc-300 dark:text-zinc-700" />}
          {it.onClick ? (
            <button type="button" onClick={it.onClick} className="max-w-[18rem] truncate text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
              {it.label}
            </button>
          ) : (
            <span aria-current="page" className="max-w-[24rem] truncate font-medium text-zinc-900 dark:text-zinc-50">
              {it.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

/** the chart's place: one level at a time, crossfading as the reader zooms */
export function ZoomStage({ level, children, className }: { level: string; children: React.ReactNode; className?: string }) {
  const still = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={level}
        initial={still ? { opacity: 0 } : { opacity: 0, scale: 0.985, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={still ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
        transition={{ duration: still ? 0 : 0.25, ease: [0.2, 0.8, 0.2, 1] }}
        className={cn("min-w-0", className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

const SHORT = 6;

/** the records behind one mark: their plot, the first few, a door to all */
export function DrillView({
  drill,
  base,
  sym,
  hoverTx,
  onHoverTx,
  onRows,
}: {
  drill: OpenDrill;
  base: string;
  sym: string;
  hoverTx: string | null;
  onHoverTx: (h: string | null) => void;
  /** open the inspector on all of them */
  onRows: () => void;
}) {
  if (drill.error) return <p className="py-10 font-mono text-[12px] text-[#E6212F]">{drill.error}</p>;
  if (!drill.answer)
    return (
      <div aria-busy="true" aria-label="Loading the records" className="flex min-h-[18rem] flex-col gap-3 py-2">
        <span className="h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
        {[0, 1, 2].map((k) => (
          <span key={k} className="h-9 animate-pulse rounded-lg bg-zinc-100/70 dark:bg-zinc-900/70" />
        ))}
      </div>
    );
  const { result, names } = drill.answer;
  if (result.rowCount === 0) return <p className="py-10 font-mono text-[12px] text-zinc-400 dark:text-zinc-500">No records matched.</p>;
  const tx = isTxList(result.columns);
  const more = result.rows.length > SHORT;
  return (
    <div className="flex flex-col gap-2">
      {tx && (
        <div className="-mx-5 md:-mx-6 [&>div]:border-b-0">
          <RecordPlot rows={result.rows} names={names} base={base} sym={sym} hoverTx={hoverTx} onHoverTx={onHoverTx} />
        </div>
      )}
      <div className="-mx-3">
        {tx ? (
          <TxCards rows={result.rows.slice(0, SHORT)} names={names} visual={null} base={base} sym={sym} step={SHORT} />
        ) : (
          <ResultTable columns={result.columns} rows={result.rows.slice(0, SHORT)} names={names} visual={null} base={base} sym={sym} span="other" picked={null} />
        )}
      </div>
      {more && (
        <button type="button" onClick={onRows} className="self-start rounded-full px-3 py-1.5 font-mono text-[11px] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50">
          All {formatNumber(result.rowCount)} records
        </button>
      )}
    </div>
  );
}
