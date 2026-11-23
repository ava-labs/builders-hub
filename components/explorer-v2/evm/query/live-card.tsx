"use client";

/* a suggestion's card with what a scan kept of its answer: the rows drawn small in the topic's hue, the headline
   figure, and on the landing's first line the findings that stand out most across every card */

import { cn } from "@/lib/utils";
import type { ScanCard } from "@/lib/explorer-query/scan-card";
import { Label, ago } from "../query-board-bits";
import type { KeptScan } from "./use-scan";

/** the answer's rows, small: a series as columns through time, a ranking as bars from the highest down */
export function CardSpark({ card, hue, className }: { card: ScanCard; hue: string; className?: string }) {
  if (card.shape === "ranking")
    return (
      <span aria-hidden className={cn("flex flex-col justify-end gap-[3px]", className)}>
        {card.spark.slice(0, 6).map((h, i) => (
          <span key={i} className="h-[7px] rounded-[2px]" style={{ width: `${Math.max(3, h * 100)}%`, background: hue, opacity: 0.85 - i * 0.11 }} />
        ))}
      </span>
    );
  return (
    <span aria-hidden className={cn("flex items-end gap-px", className)}>
      {card.spark.map((h, i) => (
        <span key={i} className="min-w-px flex-1 rounded-[1px]" style={{ height: `${Math.max(4, h * 100)}%`, background: hue, opacity: 0.35 + h * 0.55 }} />
      ))}
    </span>
  );
}

/** the figure a card leads with, and what it is */
export function CardFigure({ card }: { card: ScanCard }) {
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="shrink-0 whitespace-nowrap font-mono text-[20px] leading-none tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">{card.figure}</span>
      <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{card.label}</span>
    </span>
  );
}

const INK = { up: "text-emerald-700 dark:text-emerald-400", down: "text-[#C81B28] dark:text-red-400", bad: "text-[#C81B28] dark:text-red-400", plain: "text-zinc-500 dark:text-zinc-400" } as const;

/** the most findings the landing leads with */
const LOOKS = 3;

/** the findings that stand out most across the scanned answers, each a door to its question */
export function WorthALook({ scan, questions, now, onAsk }: { scan: KeptScan; /** the questions on this page, in their order */ questions: string[]; now: number; onAsk: (q: string) => void }) {
  const looks = questions
    .flatMap((q) => (scan.cards[q]?.finding ? [{ q, f: scan.cards[q].finding! }] : []))
    .sort((p, q) => q.f.score - p.f.score)
    .slice(0, LOOKS);
  if (!looks.length) return null;
  return (
    <section aria-label="Worth a look now" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <Label>Worth a look now</Label>
        <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">Read {ago(scan.at, now)}</span>
      </div>
      {/* a row to swipe on a phone, three across where there is room */}
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:p-0 [&::-webkit-scrollbar]:hidden">
        {looks.map(({ q, f }) => (
          <li key={q} className="w-[82%] min-w-0 shrink-0 snap-start sm:w-[46%] lg:w-auto">
            <button
              type="button"
              onClick={() => onAsk(q)}
              className="flex h-full w-full flex-col gap-2 rounded-2xl bg-white p-4 text-left ring-1 ring-zinc-200/80 transition-shadow duration-300 hover:shadow-[0_14px_32px_-18px_rgba(24,24,27,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 dark:bg-zinc-950 dark:ring-zinc-800/80"
            >
              <span className={cn("font-mono text-[10px] font-bold uppercase tracking-[0.14em]", INK[f.tone])}>{f.tag}</span>
              <span className="text-[14px] leading-snug text-zinc-900 dark:text-zinc-50">{f.text}</span>
              <span className="mt-auto truncate pt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{q}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
