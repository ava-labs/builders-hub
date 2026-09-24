"use client";

/* The Query page before a question: the last questions as chips under
   the prompt, then questions worth asking (by topic) beside the reader's
   boards. Dense on purpose: every row is one click from an answer. */

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowUpRight, History, LayoutGrid, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EXAMPLES } from "@/lib/explorer-query/examples";
import { forgetQuestion, forgetQuestions, useRecentQuestions } from "@/lib/explorer-query/recent";
import { boardHref, boardScope, boardsHref, useBoards, useHydrated } from "@/lib/explorer-query/board";
import { CARD } from "./QueryVisual";
import { BoardThumb, Label, ago, useNow } from "./query-board-bits";

/** recent questions shown as chips before "+N" */
const FOLD = 5;

/* the last questions, as chips under the prompt: one click asks again */
function Recent({ chain, onAsk }: { chain: string; onAsk: (q: string) => void }) {
  const items = useRecentQuestions(chain);
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, FOLD);
  return (
    // one row that scrolls on a phone, wrapping where there is room
    <section aria-label="Recent questions" className="-mx-4 -mt-2 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
      <Label className="mr-1 flex shrink-0 items-center gap-1.5">
        <History className="h-3 w-3" /> Recent
      </Label>
      <AnimatePresence initial={false}>
        {shown.map((q) => (
          <motion.span
            key={q}
            layout
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="group relative flex max-w-full shrink-0 items-center"
          >
            <button
              type="button"
              onClick={() => onAsk(q)}
              title={q}
              className="max-w-[15rem] truncate rounded-full sm:max-w-[22rem] bg-zinc-100 py-1.5 pl-3 pr-7 text-[12.5px] text-zinc-700 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              {q}
            </button>
            <button
              type="button"
              onClick={() => forgetQuestion(chain, q)}
              aria-label={`Remove "${q}" from recent`}
              className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-zinc-400 opacity-60 transition-opacity hover:bg-zinc-300/60 hover:text-zinc-900 group-hover:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      {items.length > FOLD && (
        <button type="button" onClick={() => setAll((v) => !v)} className="shrink-0 rounded-full px-2 py-1.5 font-mono text-[11px] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          {all ? "fewer" : `+${items.length - FOLD}`}
        </button>
      )}
      <button
        type="button"
        onClick={() => forgetQuestions(chain)}
        className="ml-1 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
      >
        Clear
      </button>
    </section>
  );
}

/* suggestions by topic: one card per topic, its questions as rows */
function Suggestions({ examples, onAsk }: { examples: typeof EXAMPLES; onAsk: (q: string) => void }) {
  return (
    <section className="flex flex-col gap-3">
      <Label>Try asking</Label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {examples.map((g) => (
          <div key={g.group} className={cn(CARD, "relative flex flex-col overflow-hidden p-1.5")}>
            {/* the topic's hue, a soft light in the corner */}
            <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-[0.14] blur-2xl" style={{ background: g.hue }} />
            <span className="relative flex items-center gap-2 px-3 pb-1 pt-2.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: g.hue }} />
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{g.group}</span>
            </span>
            {g.items.map((it) => (
              <button
                key={it.q}
                type="button"
                onClick={() => onAsk(it.q)}
                className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/70"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[14px] font-medium leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">{it.q}</span>
                  <span className="text-[12.5px] text-zinc-500 dark:text-zinc-400">{it.hint}</span>
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/* the reader's boards as a slim list beside the suggestions */
function Boards({ chain, network }: { chain: string; network: string }) {
  const { boards, create } = useBoards(boardScope(network, chain));
  const now = useNow();
  const router = useRouter();
  const shown = boards.slice(0, 4);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <LayoutGrid className="h-3 w-3" /> Your boards
        </Label>
        {boards.length > 0 && (
          <Link
            href={boardsHref(network, chain)}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
          >
            All {boards.length}
          </Link>
        )}
      </div>
      <div className={cn(CARD, "flex flex-col p-1.5")}>
        {shown.length === 0 && (
          <div className="flex flex-col gap-3 px-3 pb-2 pt-3">
            <div className="grid grid-cols-6 gap-1.5 opacity-80" aria-hidden>
              <span className="col-span-4 h-9 rounded-md bg-zinc-100 dark:bg-zinc-900" />
              <span className="col-span-2 h-9 rounded-md bg-zinc-100 dark:bg-zinc-900" />
              <span className="col-span-6 h-4 rounded-md bg-zinc-100 dark:bg-zinc-900" />
            </div>
            <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">Pin any chart to a board to build a page of your own. Tiles keep their SQL and refresh when you open it.</p>
          </div>
        )}
        {shown.map((b) => (
          <Link
            key={b.id}
            href={boardHref(network, chain, b.id)}
            className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/70"
          >
            <span className="h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-50 p-1.5 ring-1 ring-inset ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
              <BoardThumb board={b} className="auto-rows-[0.4rem] gap-[2px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14px] font-medium tracking-tight text-zinc-900 dark:text-zinc-50">{b.name}</span>
              <span className="font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">
                {b.tiles.length} {b.tiles.length === 1 ? "tile" : "tiles"} · {ago(b.updatedAt, now)}
              </span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100" />
          </Link>
        ))}
        <button
          type="button"
          onClick={() => router.push(boardHref(network, chain, create().id))}
          className={cn(
            "flex items-center gap-3 rounded-xl px-2 py-2 text-left text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/70 dark:hover:text-zinc-50",
            shown.length > 0 && "mt-0.5 border-t border-zinc-100 pt-2.5 dark:border-zinc-900",
          )}
        >
          <span className="flex h-11 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
            <Plus className="h-3.5 w-3.5" />
          </span>
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]">New board</span>
        </button>
      </div>
    </section>
  );
}

/** the Query page's landing: recent questions under the prompt, then
    suggestions by topic beside the reader's boards */
export function QueryHome({
  chain,
  network,
  examples,
  onAsk,
  className,
}: {
  /** the chain slug: "c-chain", "p-chain" */
  chain: string;
  network: string;
  examples: typeof EXAMPLES;
  onAsk: (q: string) => void;
  className?: string;
}) {
  // the store is this device's; draw it only once the client has it
  const hydrated = useHydrated();
  return (
    <div className={cn("flex flex-col gap-8", className)}>
      {hydrated && <Recent chain={chain} onAsk={onAsk} />}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-6">
        <Suggestions examples={examples} onAsk={onAsk} />
        {hydrated ? <Boards chain={chain} network={network} /> : <div />}
      </div>
    </div>
  );
}
