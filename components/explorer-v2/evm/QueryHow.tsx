"use client";

/* Under a Query answer: where its figures came from, folded away until
   asked. The tables, the window of the chain they cover, the run, the SQL
   to copy or edit, and the model's steps. */

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight, Copy, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/components/explorer-v2/format";
import { askAbout } from "@/components/explorer-v2/dig/selection";
import type { Names, QueryAnswer } from "@/lib/explorer-query/types";
import type { VisualSpec } from "@/lib/explorer-query/visual";
import { NoteText, downloadCsv, duration, toUnix } from "./QueryRows";
import type { OpenDrill } from "./QueryZoom";
import { sqlScopeOf } from "./QueryWorking";
import { cutLine, rowCount } from "./query-client";

function useCopy() {
  const [done, setDone] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setDone(key);
      setTimeout(() => setDone(null), 1400);
    });
  };
  return { done, copy };
}

const quiet = "flex items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50";

export function QueryHow({
  answer,
  visual,
  names,
  base,
  c,
  drill,
  designing,
  busy,
  linked,
  sqlOpen,
  onSqlOpen,
  sqlDraft,
  onSqlDraft,
  onRun,
}: {
  answer: QueryAnswer;
  visual: VisualSpec | null;
  names: Names;
  base: string;
  c: { kind: "evm" | "pchain"; chainId: string | number; chainSlug?: string };
  drill: OpenDrill | null;
  designing: boolean;
  busy: boolean;
  /** the answer has a thread to link to */
  linked: boolean;
  sqlOpen: boolean;
  onSqlOpen: (open: boolean) => void;
  sqlDraft: string;
  onSqlDraft: (sql: string) => void;
  onRun: () => void;
}) {
  const [how, setHow] = useState(false);
  const still = useReducedMotion();
  const { done: copied, copy } = useCopy();
  const tables = answer.sql ? [...new Set([...answer.sql.matchAll(/\b(?:FROM|JOIN)\s+((?:raw|decoded|p)_\w+)/gi)].map((m) => m[1]))] : [];
  const cov = answer.coverage;
  const covSecs = cov ? toUnix(cov.until) - toUnix(cov.since) : 0;
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setHow((v) => !v)}
        aria-expanded={how}
        aria-controls="query-how"
        className="flex items-center gap-1.5 self-start rounded-full py-1 pr-2 text-[13px] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none", how && "rotate-90")} />
        How this was answered
      </button>
      <AnimatePresence initial={false}>
        {how && (
          <motion.div
            id="query-how"
            key="how"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: still ? 0 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-5 pb-2 pl-5 pt-4">
              {visual && visual.callouts.length > 0 && answer.note && <p className="max-w-3xl text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400"><NoteText text={answer.note} base={base} /></p>}
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
                <Fact label="Source" sub={answer.sources?.some((s) => s.label) ? `Indexed ClickHouse tables, read-only, with ${answer.sources.filter((s) => s.label).map((s) => s.label).join(" and ")} from our API` : "Indexed ClickHouse tables, read-only"}>
                  {tables.length ? tables.join(", ") : "none"}
                </Fact>
                {cov && (
                  <Fact
                    label="Data window"
                    sub={
                      <>
                        <Link href={`${base}/block/${cov.lo}`} className="hover:text-[#E6212F]">
                          #{formatNumber(cov.lo)}
                        </Link>
                        {" to "}
                        <Link href={`${base}/block/${cov.hi}`} className="hover:text-[#E6212F]">
                          #{formatNumber(cov.hi)}
                        </Link>
                        {` · ${formatNumber(cov.blocks)} blocks`}
                        {answer.anchor && (
                          <span className="mt-1 block text-amber-700 dark:text-amber-400">
                            The index ends {duration(Math.max(0, Math.floor(Date.now() / 1000) - toUnix(answer.anchor)))} before now, so &ldquo;now&rdquo; is its last block, {answer.anchor.slice(11, 16)} UTC.
                          </span>
                        )}
                      </>
                    }
                  >
                    {duration(covSecs)}
                  </Fact>
                )}
                {answer.result && (
                  <Fact label="Result" sub={`${answer.result.rowsRead > 0 ? `${formatNumber(answer.result.rowsRead)} rows scanned in` : "Ran in"} ${(answer.result.elapsedMs / 1000).toFixed(2)} s`}>
                    {cutLine(answer) ?? rowCount(answer.result.rowCount)}
                  </Fact>
                )}
              </dl>

              <div className={cn("flex flex-col gap-2", !answer.result && "hidden")}>
                <span className="flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px]">
                  <button type="button" onClick={() => onSqlOpen(!sqlOpen)} className="text-zinc-900 transition-colors hover:text-[#E6212F] dark:text-zinc-50">
                    {sqlOpen ? "Hide SQL" : "Edit SQL"}
                  </button>
                  <button type="button" onClick={() => copy("sql", answer.sql)} className={quiet}>
                    {copied === "sql" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} SQL
                  </button>
                  {answer.result && answer.result.rowCount > 0 && (
                    <button type="button" onClick={() => downloadCsv({ title: answer.title, columns: answer.result!.columns, rows: answer.result!.rows, names })} className={quiet}>
                      <Download className="h-3 w-3" /> All rows as CSV
                    </button>
                  )}
                  {linked && (
                    <button type="button" onClick={() => copy("link", window.location.href)} className={quiet}>
                      {copied === "link" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Link
                    </button>
                  )}
                  {drill?.answer && (
                    <button type="button" onClick={() => copy("drill", drill.answer!.sql)} className={quiet}>
                      {copied === "drill" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Records SQL
                    </button>
                  )}
                  {drill?.answer && (
                    <button type="button" onClick={() => askAbout(`Explain these transactions: ${drill.title}.`)} className={quiet}>
                      Ask the assistant
                    </button>
                  )}
                </span>
                <span className="font-mono text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                  {answer.model?.cached
                    ? `Kept answer; rows fresh in ${Math.round((answer.model.ms ?? 0) / 100) / 10} s.`
                    : `SQL written in ${Math.round((answer.model?.ms ?? 0) / 1000)} s${answer.model?.tries ? `, ${answer.model.tries} test run${answer.model.tries === 1 ? "" : "s"}` : ""}.`}
                  {designing ? " Laying out the chart." : answer.model?.designMs ? ` Chart laid out in ${Math.round(answer.model.designMs / 1000)} s.` : ""}
                </span>
                {!!answer.model?.timings?.length && (
                  <ol className="flex flex-col gap-1 font-mono text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
                    {answer.model.timings.map((t) => (
                      <li key={t.n} className="flex items-baseline gap-2" title={t.detail}>
                        <span className={cn("w-1.5 shrink-0", t.ok ? "text-emerald-600 dark:text-emerald-400" : "text-[#E6212F]")}>{t.ok ? "✓" : "×"}</span>
                        <span className="w-10 shrink-0">{t.kind === "test" ? "test" : "final"}</span>
                        <span className="shrink-0">model {(t.modelMs / 1000).toFixed(1)} s</span>
                        <span className="shrink-0">sql {(t.sqlMs / 1000).toFixed(2)} s</span>
                        {!t.ok && <span className="min-w-0 truncate text-[#E6212F]">{t.detail}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {sqlOpen && (
                <div className="flex flex-col gap-3">
                  <textarea
                    value={sqlDraft}
                    onChange={(e) => onSqlDraft(e.target.value)}
                    spellCheck={false}
                    rows={Math.min(18, Math.max(5, sqlDraft.split("\n").length + 1))}
                    className="w-full resize-y rounded-xl bg-zinc-50 px-3 py-2 font-mono text-[12px] leading-relaxed text-zinc-900 outline-none ring-1 ring-zinc-200/70 focus:ring-zinc-400 dark:bg-zinc-900/50 dark:text-zinc-100 dark:ring-zinc-800"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
                    <span className="text-zinc-400 dark:text-zinc-500">{sqlScopeOf(c)}</span>
                    <button type="button" onClick={onRun} disabled={busy || sqlDraft.trim() === answer.sql.trim()} className="rounded-full bg-zinc-900 px-3.5 py-1.5 uppercase tracking-[0.14em] text-white disabled:opacity-25 dark:bg-zinc-100 dark:text-zinc-900">
                      Run
                    </button>
                  </div>
                  {answer.drill && (
                    <details className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      <summary className="cursor-pointer select-none">How a group opens into its transactions</summary>
                      <pre className="mt-2 overflow-x-auto rounded-xl bg-zinc-50 px-3 py-2 leading-relaxed dark:bg-zinc-900/50">{answer.drill.sql}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** one line of provenance: what, how much, and the fine print under it */
function Fact({ label, sub, children }: { label: string; sub?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">{label}</dt>
      <dd className="flex flex-col gap-1">
        <span className="font-mono text-[15px] tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">{children}</span>
        {sub != null && <span className="font-mono text-[10px] tracking-[0.04em] text-zinc-400 dark:text-zinc-500">{sub}</span>}
      </dd>
    </div>
  );
}
