"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import type { StackLayer } from "./instruments";

/* The stack block's parts: its key, and the mark of a column whose period
   is still running. A period still running (today, this week) is drawn apart from the
   finished ones: the same color under white stripes, so its short bar does
   not read as a drop. */

function Hatch({ id, stroke }: { id: string; stroke: string }) {
  return (
    <pattern id={id} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1={0} y1={0} x2={0} y2={5} strokeWidth={2.5} className={stroke} />
    </pattern>
  );
}

/** the stripes over a column's front and right faces; on the right face they run back
   along its depth, so each one wraps the edge as the same stripe */
export function PartialMark({ x, y, w, h, d }: { x: number; y: number; w: number; h: number; d: number }) {
  const id = `hatch-${useId().replace(/:/g, "")}`;
  return (
    <g>
      <defs>
        <Hatch id={id} stroke="stroke-white/75 dark:stroke-zinc-950/70" />
        {/* the side's stripes are shaded down as its red is */}
        <Hatch id={`${id}-side`} stroke="stroke-white/40 dark:stroke-zinc-950/70" />
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
      <polygon points={`${x + w},${y} ${x + w + d},${y - d} ${x + w + d},${y + h - d} ${x + w},${y + h}`} fill={`url(#${id}-side)`} />
    </g>
  );
}

/** the key's entry for a running period */
function PartialKey({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2 w-2 bg-[#EE5A65] dark:bg-[#B8232F]"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, rgb(255 255 255 / 0.75) 0 1px, transparent 1px 3px)" }}
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
