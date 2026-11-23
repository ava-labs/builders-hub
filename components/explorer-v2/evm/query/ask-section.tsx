"use client";

/* the question: its thread, the selection chip, the prompt box, the index and status lines, and the landing before an answer */

import type { RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageSquarePlus } from "lucide-react";
import type { QueryAnswer } from "@/lib/explorer-query/types";
import type { Coverage } from "@/lib/explorer-query/clickhouse";
import type { Selection } from "@/lib/explorer-query/selection";
import type { EXAMPLES } from "@/lib/explorer-query/examples";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import { QueryHome } from "../QueryHome";
import { QueryLoader } from "../QueryLoader";
import { PromptBox, ThreadLine, placeholderOf } from "../QueryWorking";
import type { OpenDrill } from "../QueryZoom";

export function AskSection({
  crumbs,
  answer,
  drill,
  sel,
  selWords,
  prompt,
  setPrompt,
  setAbout,
  askAboutSelection,
  submit,
  inputRef,
  phase,
  moving,
  elapsed,
  stale,
  error,
  gated,
  c,
  network,
  examples,
  ask,
}: {
  /** the thread, and the question on its way */
  crumbs: string[];
  answer: QueryAnswer | null;
  drill: OpenDrill | null;
  sel: Selection;
  selWords: string;
  prompt: string;
  setPrompt: (v: string) => void;
  /** the next question is about the selection */
  setAbout: (v: boolean) => void;
  /** make the selection the subject of the next question, and put the caret in the box */
  askAboutSelection: () => void;
  submit: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  phase: "idle" | "query" | "running";
  /** a window button is reading the answer over another span */
  moving: boolean;
  elapsed: number;
  /** the indexed window, when it ends more than a day ago */
  stale: Coverage | null;
  error: string | null;
  /** the anonymous limit was hit: the error offers sign-in, which lifts it */
  gated: boolean;
  c: { kind: "evm" | "pchain"; chainId: string | number; chainSlug?: string; chainName: string };
  network: string;
  examples: typeof EXAMPLES;
  ask: (q: string, refine: boolean) => Promise<unknown>;
}) {
  const { openLoginModal } = useLoginModalTrigger();
  const still = useReducedMotion();
  const busy = phase !== "idle";

  const input = (
    <PromptBox
      inputRef={inputRef}
      value={prompt}
      onChange={(v) => {
        setPrompt(v);
        if (!v) setAbout(false);
      }}
      onSend={submit}
      autoFocus={!answer}
      disabled={busy}
      label={answer ? "Refine" : "Ask"}
      placeholder={
        answer?.monitor
          ? "Monitor something else, or ask a new question"
          : answer
            ? c.kind === "pchain"
              ? "Refine this answer: only L1s, per week, add delegators"
              : "Refine this answer: only reverted, per hour, add fees"
            : placeholderOf(c.kind, c.chainName)
      }
    />
  );

  return (
    <section className="flex flex-col gap-3">
      {/* the thread, and the question on its way */}
      {crumbs.length > 0 && <ThreadLine prompts={crumbs} />}
      {/* the selection, offered as the subject of the next question */}
      <AnimatePresence initial={false}>
        {answer && !drill && sel.length > 0 && !busy && (
          <motion.div
            key="about"
            initial={still ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: still ? 0 : 0.18 }}
            className="flex"
          >
            <button
              type="button"
              onClick={askAboutSelection}
              className="flex max-w-full items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-[12.5px] text-zinc-600 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Ask about {selWords}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {input}
      {stale && (
        <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
          Indexed {stale.since.slice(0, 10)} to {stale.until.slice(0, 10)} UTC. Answers read that window, not today.
        </p>
      )}
      {/* a question's wait is drawn in the answer's frame (answer-skeleton.tsx); a window button says its own */}
      {phase === "running" && !moving && <QueryLoader status={`Running your SQL · ${elapsed} s`} />}
      {error && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-l-2 border-[#E6212F] pl-3">
          <p className="font-mono text-[12px] text-[#E6212F]">{error}</p>
          {gated && (
            <button
              type="button"
              onClick={() => openLoginModal()}
              className="border border-zinc-900 bg-zinc-900 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Sign in
            </button>
          )}
        </div>
      )}
      {!answer && !busy && (
        <div className="flex flex-col gap-6 pt-3">
          <QueryHome chain={c.chainSlug ?? String(c.chainId)} chainId={c.chainId} network={network} examples={examples} onAsk={(q) => void ask(q, false)} />
        </div>
      )}
    </section>
  );
}
