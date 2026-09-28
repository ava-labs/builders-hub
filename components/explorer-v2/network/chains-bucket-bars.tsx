"use client";

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { MOTION, useReduced } from "@/components/explorer-v2/evm/query/motion";

/* The parts the Chains and Validators pages share to turn a long list
   into something to look at first: bucket bars that cut the list, the
   Query panels' view switch, a figure that toggles a cut, and the blue
   chip that shows the cut over the list. */

export const QUIET_BAR = "#A2AFB2";

export interface Bucket {
  key: string;
  label: string;
  count: number;
  /** the bar's paint; the quiet block gray when absent */
  paint?: string;
  /** a few members, named in the tooltip */
  names?: string[];
}

/** horizontal bars, one a bucket: hover dims the rest, click cuts the list */
export function BucketBars({
  buckets,
  picked,
  onPick,
  unit = "chains",
}: {
  buckets: Bucket[];
  picked?: string;
  onPick?: (key: string) => void;
  unit?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const lit = hover ?? picked ?? null;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <ul className="flex flex-col gap-1" onMouseLeave={() => setHover(null)}>
      {buckets.map((b) => {
        const on = picked === b.key;
        const dim = lit !== null && lit !== b.key;
        const empty = b.count === 0;
        return (
          <li key={b.key} className="relative">
            <button
              type="button"
              disabled={empty || !onPick}
              onMouseEnter={() => setHover(b.key)}
              onFocus={() => setHover(b.key)}
              onBlur={() => setHover(null)}
              onClick={() => onPick?.(b.key)}
              aria-pressed={on}
              className={cn(
                "grid w-full grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 py-1 text-left transition-opacity duration-200 sm:grid-cols-[8rem_minmax(0,1fr)_3rem]",
                dim && "opacity-35",
                !empty && onPick ? "cursor-pointer" : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "truncate font-mono text-[11px]",
                  on ? "text-[#0061E2] dark:text-[#5f9dff]" : empty ? "text-zinc-300 dark:text-zinc-700" : "text-zinc-600 dark:text-zinc-300",
                )}
              >
                {b.label}
              </span>
              <span className="relative block h-5 bg-zinc-100 dark:bg-zinc-900">
                <span
                  className="absolute inset-y-0 left-0 border-r border-zinc-700 transition-[width] duration-500 dark:border-zinc-300"
                  style={{
                    width: `${empty ? 0 : Math.max(1.5, (b.count / max) * 100)}%`,
                    background: b.paint ?? QUIET_BAR,
                    borderRightWidth: empty ? 0 : undefined,
                  }}
                />
              </span>
              <span className={cn("text-right font-mono text-[12px] tabular-nums", empty ? "text-zinc-300 dark:text-zinc-700" : "text-zinc-900 dark:text-zinc-50")}>
                {b.count.toLocaleString("en-US")}
              </span>
            </button>
            {hover === b.key && !empty && (
              <div className="pointer-events-none absolute bottom-full left-[7rem] z-20 mb-1 sm:left-[9rem]">
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{b.label}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {b.count.toLocaleString("en-US")} {b.count === 1 ? unit.replace(/s$/, "") : unit}
                  </p>
                  {b.names && b.names.length > 0 && (
                    <p className="max-w-56 truncate text-[10px] text-zinc-500">
                      {b.names.slice(0, 4).join(", ")}
                      {b.count > 4 ? ` +${b.count - 4}` : ""}
                    </p>
                  )}
                  {onPick && <p className="text-[10px] text-zinc-400">{on ? "Click to show all" : "Click to list them"}</p>}
                </TipPlate>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** the Query panels' switch: a pill that slides to the choice */
export function ViewSwitch<T extends string>({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
}) {
  const reduced = useReduced();
  return (
    <div role="group" className="flex shrink-0 items-center gap-px rounded-full bg-zinc-100 p-0.5 ring-1 ring-inset ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
      {options.map(({ v, label }) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(v)}
            className={cn(
              "relative flex h-6 items-center rounded-full px-2.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50",
              on ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            {on && <motion.span layoutId={`${id}-pill`} transition={reduced ? { duration: 0 } : MOTION} className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-zinc-700" />}
            <span className="relative font-mono text-[10.5px] font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** a figure that cuts the list: the block lifts, and a blue rule marks it while on */
export function FigureToggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick?: () => void;
  title?: string;
  children: ReactNode;
}) {
  if (!onClick) return <>{children}</>;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} title={title} className="relative block w-full text-left focus-visible:outline-none">
      {children}
      <span
        aria-hidden
        className={cn("absolute inset-x-0 -bottom-1.5 h-0.5 bg-[#0061E2] transition-opacity duration-200 dark:bg-[#5f9dff]", active ? "opacity-100" : "opacity-0")}
      />
    </button>
  );
}

/** one part of the cut, shown over the list; click removes it */
export function CutChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0061E2]/[0.08] py-1.5 pl-3 pr-2 font-mono text-[11px] text-[#0061E2] transition-colors hover:bg-[#0061E2]/[0.14] dark:bg-[#5b9bff]/15 dark:text-[#8db8ff]"
    >
      {label}
      <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
    </button>
  );
}

/** the list's search, the Primary Network roster's pill */
export function FilterInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex w-full items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2 transition-colors focus-within:border-zinc-900 sm:w-80 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-100">
      <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
