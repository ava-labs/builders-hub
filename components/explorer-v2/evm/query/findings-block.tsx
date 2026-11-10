"use client";

/* what stands out in the answer, one line each: found by rules on the rows, never written by a model. A line about
   one row lights that row's mark, and opens it as the mark does. */

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Finding } from "./findings";
import { CARD, type Row } from "./sheet";

const INK: Record<Finding["tone"], string> = {
  up: "text-emerald-700 dark:text-emerald-400",
  down: "text-[#C81B28] dark:text-red-400",
  bad: "text-[#C81B28] dark:text-red-400",
  plain: "text-zinc-500 dark:text-zinc-400",
};

// on a phone the tag stands over its line; from a tablet up it stands beside it
const LINE = "grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-lg px-2 py-1.5 text-left sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]";

export function FindingsBlock({ findings, onHoverKey, onOpen }: { findings: Finding[]; onHoverKey?: (key: unknown) => void; /** open the row a finding is about; without it the lines are read only */ onOpen?: (row: Row) => void }) {
  if (!findings.length) return null;
  return (
    <section aria-label="Findings" className={cn(CARD, "flex flex-col gap-1 px-2 pb-2 pt-3.5 sm:px-3")}>
      <span className="px-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Findings</span>
      <ul className="flex flex-col">
        {findings.map((f) => {
          const body = (
            <>
              <span className={cn("col-span-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] sm:col-span-1", INK[f.tone])}>{f.tag}</span>
              <span className="text-[13.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">{f.text}</span>
            </>
          );
          const row = f.row;
          return (
            <li key={`${f.kind}:${f.text}`} onMouseEnter={() => f.key !== undefined && onHoverKey?.(f.key)} onMouseLeave={() => f.key !== undefined && onHoverKey?.(undefined)}>
              {row && onOpen ? (
                <button type="button" onClick={() => onOpen(row)} className={cn(LINE, "group transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 dark:hover:bg-zinc-900")}>
                  {body}
                  <ChevronRight aria-hidden className="h-3.5 w-3.5 self-center text-zinc-300 transition-colors group-hover:text-zinc-900 dark:text-zinc-600 dark:group-hover:text-zinc-100" />
                </button>
              ) : (
                <span className={LINE}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
