"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LiveDot } from "@/components/explorer-v2/ui";
import {
  BLOCK_FACE,
  FIGURE,
  FIG_UNIT,
  InkDelta,
  LABEL,
  ReadoutBlock,
  SUB,
  SideLevel,
  SparkBand,
  bandLevel,
} from "@/components/explorer-v2/evm/EvmOverviewStats";

/* One headline figure in the C-Chain home's voice: the extruded block,
   a bold figure, one qualifying line, the move against the previous
   window, and the series poured into its foot. Every explorer page that
   leads with figures uses this, so a figure reads the same on the
   C-Chain, the P-Chain and the whole network. */

export interface ReadoutProps {
  label: string;
  /** the figure, already formatted; null while loading, "—" when absent */
  value: ReactNode | null;
  unit?: string;
  sub?: ReactNode;
  /** change against the previous window, in percent */
  delta?: number | null;
  /** the figure's history, oldest first, drawn in the block's foot */
  spark?: number[];
  /** a live figure wears the pulse */
  live?: boolean;
  /** the page that charts this figure */
  href?: string;
}

export function Readout({ label, value, unit, sub, delta = null, spark, live, href }: ReadoutProps) {
  const trace = spark && spark.length >= 2 ? spark : undefined;
  return (
    <ReadoutBlock href={href} side={<SideLevel level={bandLevel(trace)} />} className={cn(BLOCK_FACE, !trace && "pb-5")}>
      {live && <LiveDot className="mt-1.5 shrink-0" />}
      <span className="relative z-10 flex min-w-0 flex-col gap-1.5">
        <span className={LABEL}>{label}</span>
        <span className={cn(FIGURE, "truncate")}>
          {value ?? <span className="text-zinc-300 dark:text-zinc-700">…</span>}
          {value !== null && unit && <span className={FIG_UNIT}>{unit}</span>}
        </span>
        {(sub != null || delta !== null) && (
          <span className={cn(SUB, "truncate")}>
            {sub}
            {sub != null && delta !== null ? " · " : null}
            <InkDelta value={delta} />
          </span>
        )}
      </span>
      {trace && <SparkBand values={trace} />}
    </ReadoutBlock>
  );
}

/** a row of readouts; room on the right and top for the blocks' faces */
export function ReadoutRow({ children, cols = 4, className }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 | 6; className?: string }) {
  const lg = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" }[cols];
  return <div className={cn("grid grid-cols-2 gap-x-4 gap-y-5 pr-2 pt-2", cols === 3 && "sm:grid-cols-3", lg, className)}>{children}</div>;
}
