"use client";

/* The Query page before a question: questions worth asking, each with
   what a scan read of its answer (a figure, its rows drawn small), the
   findings that stand out now, then what this device asked lately and
   the boards it built. Everything is one click from an answer. */

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, History, LayoutGrid, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Rise } from "@/components/explorer-v2/ui";
import type { EXAMPLES, Glyph as GlyphKind } from "@/lib/explorer-query/examples";
import { forgetQuestion, forgetQuestions, useRecentQuestions } from "@/lib/explorer-query/recent";
import { boardHref, boardScope, boardsHref, useBoards, useHydrated } from "@/lib/explorer-query/board";
import { NETWORK_SLUG } from "@/lib/explorer-query/target";
import { BoardCard, NewBoardCard } from "./QueryBoard";
import { Label, useNow } from "./query-board-bits";
import { Glyph } from "./query/Glyph";
import type { ScanCard } from "@/lib/explorer-query/scan-card";
import { CardFigure, CardSpark, WorthALook } from "./query/live-card";
import { useScan } from "./query/use-scan";

/** recent questions shown before "Show all" */
const FOLD = 4;
const GLYPHS: GlyphKind[] = ["stack", "hbar", "area", "limit", "hbar", "donut", "line", "scatter"];

function Recent({ chain, onAsk }: { chain: string; onAsk: (q: string) => void }) {
  const items = useRecentQuestions(chain);
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, FOLD);
  if (items.length === 0) return null;
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <History className="h-3 w-3" /> Recent
        </Label>
        <button
          type="button"
          onClick={() => forgetQuestions(chain)}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
        >
          Clear
        </button>
      </div>
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
    </section>
  );
}

function Boards({ chain, network }: { chain: string; network: string }) {
  const { boards } = useBoards(boardScope(network, chain));
  const now = useNow();
  if (boards.length === 0) return null;
  return (
    <section className="flex min-w-0 flex-[1.4] flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <LayoutGrid className="h-3 w-3" /> Boards
        </Label>
        <Link href={boardsHref(network, chain)} className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
          All boards
        </Link>
      </div>
      {/* a row to swipe on a phone, a grid where there is room */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:p-0 xl:grid-cols-3 [&::-webkit-scrollbar]:hidden">
        {boards.slice(0, boards.length > 2 ? 2 : 3).map((b) => (
          <div key={b.id} className="w-[70%] shrink-0 snap-start sm:w-auto">
            <BoardCard board={b} href={boardHref(network, chain, b.id)} now={now} />
          </div>
        ))}
        <NewBoardCard network={network} chainSlug={chain} className="w-[45%] shrink-0 snap-start sm:w-auto" />
      </div>
    </section>
  );
}

/* one suggestion: the topic, its answer drawn small, the question */
function SuggestionCard({ q, hint, group, hue, glyph, card, onAsk }: { q: string; hint: string; group: string; hue: string; glyph: GlyphKind; /** what a scan kept of the answer */ card?: ScanCard; onAsk: (q: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAsk(q)}
      className="group relative flex min-h-[15rem] w-[78%] shrink-0 snap-start flex-col overflow-hidden rounded-3xl sm:w-auto bg-white p-5 text-left ring-1 ring-zinc-200/80 shadow-[0_1px_2px_rgba(24,24,27,0.04),0_12px_32px_-24px_rgba(24,24,27,0.25)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(24,24,27,0.04),0_28px_48px_-28px_rgba(24,24,27,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 dark:bg-zinc-950 dark:ring-zinc-800/80 dark:shadow-none dark:hover:ring-zinc-700"
    >
      {/* the topic's light, rising from behind the drawing */}
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-[0.10] blur-3xl transition-opacity duration-500 group-hover:opacity-[0.22]" style={{ background: hue }} />
      <span className="relative flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: hue }} />
        <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{group}</span>
      </span>
      <span className="relative mt-5 flex h-[4.5rem] items-end text-zinc-900 dark:text-zinc-100">
        {card && card.shape !== "none" ? (
          <CardSpark card={card} hue={hue} className="h-full w-full" />
        ) : (
          <Glyph kind={glyph} hue={hue} seed={q} className="h-full w-full origin-bottom transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-y-[1.08]" />
        )}
      </span>
      {card && (
        <span className="relative mt-4">
          <CardFigure card={card} />
        </span>
      )}
      {/* titles hang from one line across a row of cards */}
      <span className="flex-1" />
      <span className="relative mt-6 flex items-end justify-between gap-4">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-[16px] font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">{q}</span>
          <span className="text-[13px] text-zinc-500 dark:text-zinc-400">{hint}</span>
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 transition-colors duration-300 group-hover:bg-zinc-900 group-hover:text-white dark:bg-zinc-900 dark:text-zinc-500 dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </span>
    </button>
  );
}

const TOPIC = "rounded-full px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50";

function Suggestions({ examples, chainId, onAsk }: { examples: typeof EXAMPLES; chainId: string | number; onAsk: (q: string) => void }) {
  const scan = useScan(chainId);
  const now = useNow();
  // one topic at a time, or every topic
  const [topic, setTopic] = useState<string | null>(null);
  const cards = examples.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group, hue: g.hue })));
  const shown = topic ? cards.filter((c) => c.group === topic) : cards;
  return (
    <section className="flex flex-col gap-6">
      {scan && <WorthALook scan={scan} questions={cards.map((c) => c.q)} now={now} onAsk={onAsk} />}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Label>Try asking</Label>
          {examples.length > 1 && (
            <div role="group" aria-label="Topic" className="flex flex-wrap gap-1">
              {[null, ...examples.map((g) => g.group)].map((g) => (
                <button key={g ?? "all"} type="button" aria-pressed={topic === g} onClick={() => setTopic(g)} className={cn(TOPIC, topic === g ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100")}>
                  {g ?? "All"}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* a row to swipe on a phone, a grid where there is room */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-4 pt-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:p-0 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          {shown.map((c) => (
            <SuggestionCard key={c.q} q={c.q} hint={c.hint} group={c.group} hue={c.hue} glyph={c.glyph ?? GLYPHS[cards.indexOf(c) % GLYPHS.length]} card={scan?.cards[c.q]} onAsk={onAsk} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** the Query page's landing: suggestions with what a scan read of them, then recent questions and boards */
export function QueryHome({
  chain,
  chainId,
  network,
  examples,
  onAsk,
  className,
}: {
  /** the chain slug: "c-chain", "p-chain", "all" */
  chain: string;
  /** what the query route takes for this page: a chain id, or the network's slug */
  chainId: string | number;
  network: string;
  examples: typeof EXAMPLES;
  onAsk: (q: string) => void;
  className?: string;
}) {
  // the store is this device's; draw it only once the client has it
  const hydrated = useHydrated();
  // drawn by the server, the landing fades in, so the device's recent questions and boards come in above the
  // suggestions out of sight; drawn later by the client (New question), the store is in and nothing moves
  const fade = useRef(!hydrated).current;
  const landing = (
    <div className={cn("flex flex-col gap-10 pt-4", className)}>
      <Suggestions examples={examples} chainId={chainId} onAsk={onAsk} />
      {/* this device's own: each shows only once it holds something */}
      {hydrated && (
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-8">
          <Recent chain={chain} onAsk={onAsk} />
          {/* a board's SQL is bound to one chain, so All chains has none */}
          {chain !== NETWORK_SLUG && <Boards chain={chain} network={network} />}
        </div>
      )}
    </div>
  );
  return fade ? <Rise delay={0.14}>{landing}</Rise> : landing;
}
