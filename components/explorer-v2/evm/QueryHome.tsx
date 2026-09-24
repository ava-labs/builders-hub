"use client";

/* The Query page before a question: what this device asked lately, the
   boards it built, and questions worth asking. Three quiet sections with
   room between them; everything is one click from an answer. */

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, History, LayoutGrid, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EXAMPLES } from "@/lib/explorer-query/examples";
import { forgetQuestion, forgetQuestions, useRecentQuestions } from "@/lib/explorer-query/recent";
import { boardHref, boardScope, boardsHref, useBoards, useHydrated } from "@/lib/explorer-query/board";
import { BoardCard, NewBoardCard } from "./QueryBoard";
import { Label, useNow } from "./query-board-bits";

/** recent questions shown before "Show all" */
const FOLD = 4;

function Recent({ chain, onAsk }: { chain: string; onAsk: (q: string) => void }) {
  const items = useRecentQuestions(chain);
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, FOLD);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <History className="h-3 w-3" /> Recent
        </Label>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => forgetQuestions(chain)}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
          >
            Clear
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-200 px-4 py-6 text-[13.5px] leading-relaxed text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          Questions you ask come back here, newest first.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            <AnimatePresence initial={false}>
              {shown.map((q) => (
                <motion.li
                  key={q}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                  className="group relative"
                >
                  <button
                    type="button"
                    onClick={() => onAsk(q)}
                    className="flex w-full items-center gap-3 px-4 py-3 pr-12 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                  >
                    <span className="min-w-0 flex-1 truncate text-[14px] text-zinc-700 group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-zinc-50">{q}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100" />
                  </button>
                  <button
                    type="button"
                    onClick={() => forgetQuestion(chain, q)}
                    aria-label={`Remove "${q}" from recent`}
                    className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-zinc-300 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-900 focus-visible:opacity-100 group-hover:opacity-100 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {items.length > FOLD && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              className="w-full border-t border-zinc-100 px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:border-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
            >
              {all ? "Show fewer" : `Show all ${items.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Boards({ chain, network }: { chain: string; network: string }) {
  const { boards } = useBoards(boardScope(network, chain));
  const now = useNow();
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <LayoutGrid className="h-3 w-3" /> Boards
        </Label>
        {boards.length > 0 && (
          <Link
            href={boardsHref(network, chain)}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
          >
            All boards
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {boards.slice(0, boards.length > 2 ? 2 : 3).map((b) => (
          <BoardCard key={b.id} board={b} href={boardHref(network, chain, b.id)} now={now} />
        ))}
        {boards.length === 0 ? (
          <div className="flex min-h-[11.5rem] flex-col justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 sm:col-span-1 xl:col-span-2 dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="grid grid-cols-6 gap-1.5 opacity-70" aria-hidden>
              <span className="col-span-4 h-8 rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
              <span className="col-span-2 h-8 rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
              <span className="col-span-6 h-5 rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
            </div>
            <p className="text-[13.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Pin any chart to a board to build a page of your own. Tiles keep their SQL and refresh when you open it.
            </p>
          </div>
        ) : null}
        <NewBoardCard network={network} chainSlug={chain} />
      </div>
    </section>
  );
}

function Suggestions({ examples, onAsk }: { examples: typeof EXAMPLES; onAsk: (q: string) => void }) {
  const cards = examples.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group, hue: g.hue })));
  return (
    <section className="flex flex-col gap-3">
      <Label>Try asking</Label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.q}
            type="button"
            onClick={() => onAsk(c.q)}
            className="group relative flex min-h-[8.5rem] flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_16px_32px_-18px_rgba(24,24,27,0.35)] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            {/* the category's hue, a soft light in the corner */}
            <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-25" style={{ background: c.hue }} />
            <span className="relative flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.hue }} />
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{c.group}</span>
            </span>
            <span className="relative flex flex-col gap-1">
              <span className="text-[15px] font-medium leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">{c.q}</span>
              <span className="flex items-center justify-between gap-3 text-[12.5px] text-zinc-500 dark:text-zinc-400">
                {c.hint}
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100" />
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** the Query page's landing: recent questions, boards, suggestions */
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
    <div className={cn("flex flex-col gap-10 pt-4", className)}>
      {hydrated && (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
          <Recent chain={chain} onAsk={onAsk} />
          <Boards chain={chain} network={network} />
        </div>
      )}
      <Suggestions examples={examples} onAsk={onAsk} />
    </div>
  );
}
