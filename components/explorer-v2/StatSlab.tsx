"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTween } from "@/components/explorer-v2/evm/query/motion";

/* ------------------------------------------------------------------ */
/* Stat slab: a headline figure drawn as a solid, in the block tape's
   axonometric projection (lit top face, shaded right face). A figure
   that is a share fills the solid like a vessel, to its own level. A
   figure with history carries a strip of its last days. A slab with an
   action lifts on hover; a slab whose filter is on wears the selection
   blue, so the page shows which figure it is filtered by.              */

const DEPTH = "0.5rem"; // extrusion depth: keep in sync with -top-2 / -right-2

export function StatSlab({
  label,
  value,
  format,
  unit,
  sub,
  spark,
  fill,
  alert = false,
  active = false,
  onClick,
  href,
  title,
}: {
  label: string;
  /** null while the feed loads */
  value: number | null;
  format: (n: number) => string;
  unit?: string;
  sub?: ReactNode;
  /** the figure's recent history, oldest first */
  spark?: number[];
  /** 0..1: the figure is a share; the solid fills to it */
  fill?: number;
  /** the figure needs attention: the level and strip turn red */
  alert?: boolean;
  /** this slab's filter is on */
  active?: boolean;
  onClick?: () => void;
  href?: string;
  title?: string;
}) {
  const t = useTween(value, 500);
  const shown = value === null ? null : format(Number.isInteger(value) && t !== null ? Math.round(t) : (t ?? value));
  const level = fill === undefined ? null : Math.min(100, Math.max(fill > 0 ? 3 : 0, fill * 100));
  const lifts = !!(onClick || href);

  const face = (
    <>
      {level !== null && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
            // a level, not a tint: a pale body under a crisp waterline
            "border-t",
            alert ? "border-[#E6212F]/40 bg-[#E6212F]/[0.06]" : active ? "border-[#0061E2]/40 bg-[#0061E2]/[0.06]" : "border-[#A2AFB2]/60 bg-[#A2AFB2]/[0.12] dark:border-[#A2AFB2]/30 dark:bg-[#A2AFB2]/[0.07]",
          )}
          style={{ height: `${level}%` }}
        />
      )}
      <span className="relative flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{label}</span>
        {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0061E2] dark:bg-[#5b9bff]" />}
      </span>
      <span className="relative truncate font-mono text-[22px] leading-none tabular-nums tracking-tight text-zinc-900 sm:text-[28px] dark:text-zinc-50">
        {shown ?? <span className="text-zinc-300 dark:text-zinc-700">…</span>}
        {unit && shown !== null && <span className="ml-1.5 text-[13px] font-normal tracking-normal text-zinc-400 dark:text-zinc-500">{unit}</span>}
      </span>
      <span className="relative min-h-4 truncate font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{sub}</span>
      {spark && spark.length > 5 && <Strip values={spark} alert={alert} />}
    </>
  );

  const cls = cn(
    "relative flex h-full min-w-0 flex-col gap-2 overflow-hidden border px-4 py-4 text-left transition-[translate,border-color,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] sm:px-5",
    active
      ? "border-[#0061E2]/60 bg-white dark:border-[#5b9bff]/60 dark:bg-zinc-950"
      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
    lifts && "group-hover/slab:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50",
  );

  return (
    <div className="group/slab relative mr-2 mt-2 min-w-0">
      {/* top face: lit */}
      <span
        aria-hidden
        className={cn(
          "absolute -top-2 left-0 w-full origin-bottom-left skew-x-[-45deg] border border-b-0 transition-[translate,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          active ? "border-[#0061E2]/60 bg-[#0061E2]/15 dark:border-[#5b9bff]/60" : "border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800",
          lifts && "group-hover/slab:-translate-y-1",
        )}
        style={{ height: DEPTH }}
      />
      {/* right face: in shade, carrying the same level as the front */}
      <span
        aria-hidden
        className={cn(
          "absolute -right-2 top-0 h-full origin-top-left skew-y-[-45deg] overflow-hidden border border-l-0 transition-[translate,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          active ? "border-[#0061E2]/60 bg-[#0061E2]/25 dark:border-[#5b9bff]/60" : "border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-900",
          lifts && "group-hover/slab:-translate-y-1",
        )}
        style={{ width: DEPTH }}
      >
        {level !== null && (
          <span
            aria-hidden
            className={cn("absolute inset-x-0 bottom-0 transition-[height] duration-700", alert ? "bg-[#E6212F]/20" : "bg-[#A2AFB2]/35 dark:bg-[#A2AFB2]/20")}
            style={{ height: `${level}%` }}
          />
        )}
      </span>
      {href ? (
        <Link href={href} title={title} className={cls}>
          {face}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} title={title} aria-pressed={active} className={cn(cls, "w-full")}>
          {face}
        </button>
      ) : (
        <div className={cls}>{face}</div>
      )}
    </div>
  );
}

/** the figure's last days as bars; square root heights keep one spike from flattening the rest */
function Strip({ values, alert }: { values: number[]; alert: boolean }) {
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  // a count that moves a few percent reads as flat against zero: draw the range
  const base = lo > 0 && (hi - lo) / hi < 0.5 ? lo - (hi - lo) * 0.25 : 0;
  const span = hi - base || 1;
  return (
    <span aria-hidden className="relative mt-1 flex h-5 items-end gap-px">
      {values.map((v, i) => (
        <span
          key={i}
          className={cn(
            "min-w-px flex-1 rounded-[1px]",
            i === values.length - 1 ? (alert ? "bg-[#E6212F]" : "bg-zinc-900 dark:bg-zinc-100") : "bg-zinc-200 dark:bg-zinc-800",
          )}
          style={{ height: `${Math.max(8, Math.sqrt(Math.max(0, v - base) / span) * 100)}%` }}
        />
      ))}
    </span>
  );
}
