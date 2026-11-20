"use client";

/* the next step after an answer: see it another way with no new question, or ask one of the questions it raises */

import { GitCompareArrows, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const CHIP =
  "inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-left text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 disabled:opacity-50";
const OFF = "bg-zinc-100 text-zinc-700 hover:bg-zinc-200/80 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";
const LABEL = "w-12 shrink-0 pt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500";

export function FollowupsBlock({
  asks,
  onAsk,
  compare,
  busy,
}: {
  /** the questions the answer raises; a click asks one as a follow-up */
  asks: string[];
  onAsk: (question: string) => void;
  /** the answer beside the period before it, when a chart can show both: its words, whether it is on, and the switch */
  compare: { label: string; on: boolean; toggle: () => void } | null;
  busy: boolean;
}) {
  if (!asks.length && !compare) return null;
  return (
    <section aria-label="Next steps" className="flex flex-col gap-2 px-1">
      {compare && (
        <div className="flex items-start gap-3">
          <span className={LABEL}>View</span>
          <button type="button" aria-pressed={compare.on} onClick={compare.toggle} className={cn(CHIP, compare.on ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900" : OFF)}>
            <GitCompareArrows aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{compare.label}</span>
          </button>
        </div>
      )}
      {asks.length > 0 && (
        <div className="flex items-start gap-3">
          <span className={LABEL}>Ask</span>
          <ul className="flex min-w-0 flex-wrap gap-1.5">
            {asks.map((q) => (
              <li key={q} className="min-w-0 max-w-full">
                <button type="button" disabled={busy} onClick={() => onAsk(q)} title="Asks this as a follow-up. A model writes the answer." className={cn(CHIP, OFF)}>
                  <Sparkles aria-hidden className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
                  <span className="truncate">{q}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
