"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import type { StackLayer } from "./instruments";

/* The stack block's parts: its key, and the mark of a column whose period
   is still running. A period still running (today, this week) is drawn apart from the
   finished ones: the same color under white stripes, behind a dashed
   outline, so its short bar does not read as a drop. */

function HatchDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={5} strokeWidth={2.5} className="stroke-white/75 dark:stroke-zinc-950/70" />
      </pattern>
    </defs>
  );
}

/** the stripes and dashed outline over a column's front face */
export function PartialMark({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const id = `hatch-${useId().replace(/:/g, "")}`;
  return (
    <g>
      <HatchDefs id={id} />
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={Math.max(0, w - 1)}
        height={Math.max(0, h - 1)}
        fill="none"
        strokeWidth={1}
        strokeDasharray="3 2"
        className="stroke-zinc-500 dark:stroke-zinc-400"
      />
    </g>
  );
}

/** the key's entry for a running period */
function PartialKey({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2 w-2 border border-dashed border-zinc-500 text-zinc-400 dark:border-zinc-400 dark:text-zinc-500"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 3px)" }}
      />
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
    </span>
  );
}

/** the layers' key, each with its share of the window; hovering one dims the others */
export function StackKey({
  layers,
  sums,
  all,
  focus,
  setFocus,
  partialLabel,
}: {
  layers: StackLayer[];
  sums: Record<string, number>;
  all: number;
  focus: string | null;
  setFocus: (key: string | null) => void;
  /** set when a column is still running */
  partialLabel?: string;
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-0.5 font-mono text-[10px] uppercase tracking-[0.12em]" onMouseLeave={() => setFocus(null)}>
      {layers.map((l) => (
        <button
          key={l.key}
          type="button"
          title={l.what}
          onMouseEnter={() => setFocus(l.key)}
          onFocus={() => setFocus(l.key)}
          onBlur={() => setFocus(null)}
          onClick={(e) => e.preventDefault()}
          className={cn("flex items-center gap-1.5 transition-opacity", focus && focus !== l.key ? "opacity-40" : "opacity-100")}
        >
          <span className={cn("h-2 w-2", l.swatch)} />
          <span className="text-zinc-500 dark:text-zinc-400">{l.label}</span>
          <span className="tabular-nums text-zinc-900 dark:text-zinc-50">{all > 0 ? `${((sums[l.key] / all) * 100).toFixed(0)}%` : ""}</span>
        </button>
      ))}
      {partialLabel && <PartialKey label={partialLabel} />}
    </span>
  );
}
