"use client";

/* the answer's head: where it was asked, its title and pin, its reading or note, its source lines */

import type { QueryAnswer, Turn } from "@/lib/explorer-query/types";
import type { VisualSpec } from "@/lib/explorer-query/visual-spec";
import { NoteText } from "../QueryRows";
import { PinToBoard } from "../QueryBoard";
import { reads, sourceLines } from "../query-client";

export function AnswerHead({
  answer,
  visual,
  history,
  c,
  network,
  base,
  cameFrom,
  pinnable,
  laying,
  reading,
}: {
  answer: QueryAnswer;
  visual: VisualSpec | null;
  history: Turn[];
  c: { kind: "evm" | "pchain"; chainSlug?: string };
  network: string;
  base: string;
  /** the chain page the question was sent here from (?from=) */
  cameFrom: string | null;
  pinnable: boolean;
  laying: boolean;
  reading: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {cameFrom && cameFrom !== c.chainSlug && (
        <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
          Asked on the {cameFrom === "p-chain" ? "P-Chain" : "C-Chain"} page. This data lives on the {c.kind === "pchain" ? "P-Chain" : "C-Chain"}, so it is answered here.
        </span>
      )}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900 sm:text-[26px] dark:text-zinc-50">{answer.title}</h1>
        {pinnable && !laying && !answer.monitor && <PinToBoard chain={c.chainSlug!} network={network} answer={answer} thread={history.map((t) => t.prompt)} className="mt-1 shrink-0" />}
      </div>
      {!laying && reading && (
        <span aria-busy="true" aria-label="Writing the reading" className="flex max-w-3xl flex-col gap-1.5 pt-1">
          {[92, 64].map((w) => (
            <span key={w} className="h-3 animate-pulse rounded-sm bg-zinc-200/80 dark:bg-zinc-800" style={{ width: `${w}%` }} />
          ))}
        </span>
      )}
      {!laying && !reading && visual && visual.callouts.length > 0 ? (
        <p className="max-w-3xl text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{reads(visual.callouts)}</p>
      ) : (
        !reading && answer.note && <p className="max-w-3xl text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400"><NoteText text={answer.note} base={base} /></p>
      )}
      {/* what a table from our server covers, and how recent it is */}
      {sourceLines(answer).map((t) => (
        <p key={t} className="max-w-3xl font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {t}
        </p>
      ))}
    </div>
  );
}
