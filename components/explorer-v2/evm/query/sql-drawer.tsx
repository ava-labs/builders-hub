"use client";

/* the SQL behind an answer, one click from the chart: read it, copy it, edit it and run it again. The page
   remembers on this device that a reader keeps it open. */

import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueryAnswer } from "@/lib/explorer-query/types";
import { sqlScopeOf } from "../QueryWorking";
import { CARD } from "./sheet";
import { SqlEditor } from "./SqlEditor";

const KEPT = "explorer-query:sql-open";

/** whether the SQL stands open, kept on this device: a reader who works in the SQL finds it open on the next answer */
export function useSqlOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEPT) === "1") setOpen(true);
    } catch {
      /* no storage: the SQL opens when asked */
    }
  }, []);
  const set = (next: boolean) => {
    setOpen(next);
    try {
      if (next) window.localStorage.setItem(KEPT, "1");
      else window.localStorage.removeItem(KEPT);
    } catch {
      /* the choice holds for this page only */
    }
  };
  return [open, set];
}

export const SQL_DRAWER_ID = "query-sql";

export function SqlDrawer({
  answer,
  c,
  busy,
  error,
  draft,
  onDraft,
  onRun,
  onClose,
}: {
  answer: QueryAnswer;
  c: { kind: "evm" | "pchain"; chainId: string | number; chainSlug?: string };
  busy: boolean;
  /** why the last run of the reader's SQL failed: the editor marks the place it names */
  error: string | null;
  draft: string;
  onDraft: (sql: string) => void;
  onRun: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    void navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  const quiet = "flex h-7 items-center gap-1.5 rounded-full px-2 font-mono text-[10.5px] text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50";
  return (
    <section id={SQL_DRAWER_ID} aria-label="SQL" className={cn(CARD, "flex scroll-mt-24 flex-col gap-3 px-4 pb-4 pt-3 sm:px-5")}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">SQL</span>
        <span className="flex items-center gap-1">
          <button type="button" onClick={copy} className={quiet}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy
          </button>
          <button type="button" onClick={onClose} aria-label="Close the SQL" className={cn(quiet, "w-7 justify-center px-0")}>
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
      <SqlEditor value={draft} onChange={onDraft} busy={busy} error={error} chainId={c.chainId} onRun={() => draft.trim() !== answer.sql.trim() && onRun()} />
      <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
        <span className="text-zinc-400 dark:text-zinc-500">{sqlScopeOf(c)}</span>
        <button type="button" onClick={onRun} disabled={busy || draft.trim() === answer.sql.trim()} className="rounded-full bg-zinc-900 px-3.5 py-1.5 uppercase tracking-[0.14em] text-white disabled:opacity-25 dark:bg-zinc-100 dark:text-zinc-900">
          Run
        </button>
      </div>
      {answer.drill && (
        <details className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          <summary className="cursor-pointer select-none">How a group opens into its transactions</summary>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-zinc-50 px-3 py-2 leading-relaxed dark:bg-zinc-900/50">{answer.drill.sql}</pre>
        </details>
      )}
    </section>
  );
}
