"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TipPlate } from "@/components/explorer-v2/staking/bits";

/* The pieces the overview's lists share: a strip that splits a total into
   its groups and cuts the list below to one of them, the chips that name
   the cut, a switcher for what the list ranks by, and a row bar. Block
   gray with ink edges; the selection blue marks the picked group. */

export interface ShareSegment {
  key: string;
  label: string;
  value: number;
}

/* a segment narrower than this carries no label, only its tooltip */
const LABEL_MIN_SHARE = 0.1;

export function ShareStrip({
  segments,
  picked,
  onPick,
  fmt,
  noun,
}: {
  segments: ShareSegment[];
  picked: string | null;
  onPick: (key: string | null) => void;
  fmt: (v: number) => string;
  /** what one segment is, for the tooltip's second line ("of transactions") */
  noun: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((s, g) => s + g.value, 0);
  if (total <= 0) return <div className="h-9 animate-pulse bg-zinc-100 dark:bg-zinc-900" />;

  let offset = 0;
  const placed = segments
    .filter((g) => g.value > 0)
    .map((g) => {
      const share = g.value / total;
      const at = offset;
      offset += share;
      return { ...g, share, at };
    });
  const tip = placed.find((g) => g.key === hover);

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <div className="flex h-9 w-full border border-zinc-700/50 dark:border-zinc-300/40">
        {placed.map((g, i) => {
          const on = picked === g.key;
          const dim = (hover !== null && hover !== g.key) || (picked !== null && !on && hover === null);
          return (
            <button
              key={g.key}
              type="button"
              aria-pressed={on}
              title={`${g.label}: ${fmt(g.value)}`}
              onMouseEnter={() => setHover(g.key)}
              onFocus={() => setHover(g.key)}
              onBlur={() => setHover(null)}
              onClick={() => onPick(on ? null : g.key)}
              style={{ width: `${g.share * 100}%` }}
              className={cn(
                "relative min-w-[3px] overflow-hidden transition-[background-color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0061E2]/60",
                i > 0 && "border-l border-zinc-700/50 dark:border-zinc-300/40",
                on ? "bg-[#0061E2]/80 dark:bg-[#5f9dff]/70" : "bg-[#A2AFB2]/45 hover:bg-[#A2AFB2]/80 dark:bg-[#A2AFB2]/30 dark:hover:bg-[#A2AFB2]/55",
                dim && "opacity-45",
              )}
            >
              {g.share >= LABEL_MIN_SHARE && (
                <span
                  className={cn(
                    "absolute inset-0 flex items-center truncate px-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em]",
                    on ? "text-white" : "text-zinc-800 dark:text-zinc-100",
                  )}
                >
                  {g.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {tip && (
        <div
          className="pointer-events-none absolute bottom-full z-20 mb-2 -translate-x-1/2"
          style={{ left: `${Math.min(88, Math.max(12, (tip.at + tip.share / 2) * 100))}%` }}
        >
          <TipPlate>
            <p className="whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-900 dark:text-zinc-50">{tip.label}</p>
            <p className="whitespace-nowrap font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">
              {fmt(tip.value)} · {(tip.share * 100).toFixed(1)}% {noun}
            </p>
          </TipPlate>
        </div>
      )}
    </div>
  );
}

/** the cut, named: each chip clears its own part */
export function CutChips({ chips, onClear }: { chips: { key: string; label: string }[]; onClear: (key: string) => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onClear(c.key)}
          className="group inline-flex items-center gap-1.5 rounded-full bg-[#0061E2]/[0.08] py-1.5 pl-3 pr-2 font-mono text-[11px] text-[#0061E2] transition-colors hover:bg-[#0061E2]/[0.14] dark:bg-[#5b9bff]/15 dark:text-[#8db8ff]"
        >
          {c.label}
          <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}

const SEG =
  "relative flex h-7 items-center justify-center rounded-full px-2.5 font-mono text-[10.5px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50";

/** what the list ranks by: the Query chart's view pill */
export function RankSwitch<T extends string>({
  id,
  options,
  value,
  onChange,
}: {
  id: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Rank by"
      className="flex shrink-0 items-center gap-px rounded-full bg-zinc-100 p-0.5 ring-1 ring-inset ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(SEG, on ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100")}
          >
            {on && (
              <motion.span
                layoutId={`${id}-pill`}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-zinc-700"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** a row's share of the list's leader, as a hairline bar under its name */
export function RowBar({ share, dim = false }: { share: number; dim?: boolean }) {
  return (
    <span aria-hidden className="block h-1 w-full bg-zinc-100 dark:bg-zinc-900">
      <span
        className={cn("block h-full bg-[#A2AFB2] transition-[width] duration-300 dark:bg-[#A2AFB2]/70", dim && "opacity-40")}
        style={{ width: `${Math.max(0.5, Math.min(1, share) * 100)}%` }}
      />
    </span>
  );
}
