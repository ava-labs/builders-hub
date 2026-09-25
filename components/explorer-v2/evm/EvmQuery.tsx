"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Check, ChevronRight, Copy, Download, MessageSquarePlus, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import { setSelection as setDigSelection, askAbout } from "@/components/explorer-v2/dig/selection";
import type { ChartSpec, DrillAnswer, Names, QueryAnswer, Turn } from "@/lib/explorer-query/types";
import type { QueryEvent } from "@/lib/explorer-query/answer";
import type { Coverage, QueryResult } from "@/lib/explorer-query/clickhouse";
import type { VisualSpec } from "@/lib/explorer-query/visual";
import { type Selection, applySelection, describe } from "@/lib/explorer-query/selection";
import { CARD, QueryVisual, fmt, fmtX, nameFor } from "./QueryVisual";
import { type Row, doorFor, downloadCsv, duration, fillTitle, formatOf, header, isAddress, isHash, isTime, isTxList, toUnix } from "./QueryRows";
import { QueryHome } from "./QueryHome";
import { PinToBoard } from "./QueryBoard";
import { QueryInspector, RowsBody } from "./QueryInspector";
import { Crumbs, DrillView, type OpenDrill, ZoomStage } from "./QueryZoom";
import { AvalancheLoader } from "./AvalancheLoader";
import { EXAMPLES, PCHAIN_EXAMPLES, examplesFor } from "@/lib/explorer-query/examples";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { rememberQuestion } from "@/lib/explorer-query/recent";
import { askHref } from "@/lib/explorer-query/board";

/* A question about the chain, answered as a sheet in the explorer's
   own grammar. The query stage returns rows first and the page draws
   them at once; the layout stage then arranges them (headline figures,
   panels, a short reading). The chart is the index of the rows: a pick
   on it filters every surface, the rows open in a sheet beside it, and
   a mark zooms in place into the records behind it. Where the figures
   came from (tables, window, timings, SQL) folds away under the chart. */

/* the selection rides along with a follow-up after this mark, so the
   question the reader sees stays the one they typed */
const FILTER_MARK = "\n\n(Only the rows where ";



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



/** one line on where the answer is: who is writing, and the last step */
/** the callouts as one paragraph: every sentence closed, no 1.395e+6, short addresses */
function reads(callouts: string[]): string {
  return callouts
    .map((c) =>
      c
        .trim()
        .replace(/\b\d+(?:\.\d+)?e[+-]?\d+\b/gi, (m) => formatNumber(Number(m)))
        // an address reads the way the charts write it
        .replace(/\b0x[0-9a-fA-F]{40}\b/g, (m) => truncate(m.toLowerCase(), 6)),
    )
    .filter(Boolean)
    .map((c) => (/[.!?]$/.test(c) ? c : `${c}.`))
    .join(" ");
}

/** under every answer: the figures rest on SQL a model wrote */
const SQL_CAVEAT = "The SQL behind this answer is written by an AI model and may not be 100% accurate. Check it before you rely on a figure.";

/* the loader's line: what is happening, never which model does it */
function progress(events: QueryEvent[]): string {
  let line = "Writing the SQL";
  for (const e of events) {
    if (e.type === "stage") {
      if (e.stage === "cached") return "Kept answer: running its SQL for fresh rows";
      line = e.stage === "escalated" ? "Taking a second pass at the SQL" : "Writing the SQL";
    } else if (e.type === "step") {
      const what = e.kind === "test" ? `Test ${e.n}` : "Final query";
      line = e.ok ? `${what} ran, ${e.detail}` : `${what} failed, fixing`;
    }
  }
  return line;
}

/** the chain a Query page asks: its table chain_id and how the page names it */
interface QueryChain {
  chainId: string | number;
  chainSlug?: string;
  chainName: string;
  nativeToken?: string;
  kind: "evm" | "pchain";
}

/** what the database holds of a chain: its window, nothing, or unknown (null) */
export type IndexState = Coverage | "empty" | null;

/** a window that ends more than a day ago is named on the page */
const STALE_S = 24 * 3600;

/** an EVM chain's Query page, inside the chain's own layout and shell */
export function EvmQuery({ network, index = null }: { network: string; index?: IndexState }) {
  const c = useChainContext();
  return (
    <QueryPage
      network={network}
      c={{ chainId: c.chainId, chainSlug: c.chainSlug, chainName: c.chainName, nativeToken: c.nativeToken, kind: "evm" }}
      examples={examplesFor(c.chainId)}
      index={index}
    />
  );
}

/** the P-Chain's Query page: its rows carry chain_id 1 (mainnet) or 5 (Fuji) */
export function PchainQuery({ network }: { network: string }) {
  return (
    <QueryPage
      network={network}
      c={{ chainId: network === "fuji" ? 5 : 1, chainSlug: "p-chain", chainName: "the P-Chain", nativeToken: "AVAX", kind: "pchain" }}
      examples={PCHAIN_EXAMPLES}
    />
  );
}

/* each chain family's own chrome; stable components, so a re-render of
   the wrapper never remounts the page and loses its answer */
function QueryShell({ kind, network, children }: { kind: QueryChain["kind"]; network: string; children: React.ReactNode }) {
  if (kind === "pchain")
    return (
      <ExplorerShell chain="p-chain" network={network} hideHeader>
        <div className="mx-auto w-full max-w-[90rem] px-5 pb-24 pt-2 md:px-6">{children}</div>
      </ExplorerShell>
    );
  return (
    <EvmShell network={network} search={false}>
      {children}
    </EvmShell>
  );
}

function QueryPage({ network, c, examples, index = null }: { network: string; c: QueryChain; examples: typeof EXAMPLES; index?: IndexState }) {
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken ?? "AVAX";

  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"idle" | "query" | "running">("idle");
  const [designing, setDesigning] = useState(false);
  // what the model has done so far on this question
  const [events, setEvents] = useState<QueryEvent[]>([]);
  // a kept answer's reading, being written again
  const [reading, setReading] = useState(false);
  // the SQL the model handed back, so an edit is not laid out as if it were kept
  const answerSql = useRef("");
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<QueryAnswer | null>(null);
  const [history, setHistory] = useState<Turn[]>([]);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [sqlDraft, setSqlDraft] = useState("");
  const [range, setRange] = useState<[number, number] | null>(null);
  const [drill, setDrill] = useState<OpenDrill | null>(null);
  const drillNow = useRef(drill);
  drillNow.current = drill;
  // the reader's picks on this level of this answer; the chart edits them
  const [sel, setSel] = useState<Selection>([]);
  // the next question is about the selection
  const [about, setAbout] = useState(false);
  const [inspect, setInspect] = useState(false);
  const [how, setHow] = useState(false);
  const still = useReducedMotion();
  const [started, setStarted] = useState<number | null>(null);
  // one pointer for the whole sheet: a bar and its row, a dot and its row
  const [hoverKey, setHoverKey] = useState<unknown>(undefined);
  const [hoverTx, setHoverTx] = useState<string | null>(null);
  const router = useRouter();
  const [, tick] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const token = useRef(0);
  const { done: copied, copy } = useCopy();

  // the elapsed clock while a stage runs
  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [started]);

  const post = async <T,>(body: object): Promise<T> => {
    const res = await fetch("/api/explorer/query", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId: c.chainId, ...body }) });
    const out = (await res.json()) as T & { error?: string };
    if (!res.ok || out.error) throw new Error(out.error ?? `HTTP ${res.status}`);
    return out;
  };

  /** a question, streamed: each step as it ends, then the answer */
  const stream = async (body: object, my: number): Promise<QueryAnswer> => {
    const res = await fetch("/api/explorer/query", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId: c.chainId, ...body }) });
    if (!res.ok || !res.body) {
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(out.error ?? `HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (value) buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const e = JSON.parse(line) as QueryEvent;
        if (e.type === "answer") return e.answer;
        if (e.type === "error") throw new Error(e.error);
        if (my === token.current) setEvents((prev) => [...prev, e]);
      }
      if (done) throw new Error("The answer stopped before it finished.");
    }
  };

  /** a kept layout's sentences, written again from the rows just fetched */
  const reread = async (a: QueryAnswer) => {
    const my = token.current;
    setReading(true);
    try {
      const out = await post<{ callouts: string[]; ms: number }>({ key: a.key, reading: true });
      if (my !== token.current) return;
      setAnswer((prev) => (prev && prev.sql === a.sql && prev.visual ? { ...prev, visual: { ...prev.visual, callouts: out.callouts } } : prev));
    } catch {
      /* the chart stands without its reading */
    } finally {
      if (my === token.current) setReading(false);
    }
  };

  /** the second stage: arrange rows the page already shows */
  const design = useCallback(
    async (question: string, a: QueryAnswer) => {
      if (!a.result || a.result.rows.length === 0) return;
      const my = ++token.current;
      setDesigning(true);
      try {
        // a kept answer is laid out by the server from its own SQL; hand-edited rows are sent
        const out = await post<{ visual: VisualSpec; designer: boolean; ms: number }>(
          a.key && a.sql === answerSql.current
            ? { key: a.key }
            : { design: { question, title: a.title, note: a.note, columns: a.result.columns, rows: a.result.rows, names: a.names, chart: a.chart } },
        );
        if (my !== token.current) return;
        setAnswer((prev) => (prev && prev.sql === a.sql ? { ...prev, visual: out.visual, draftVisual: false, model: { ...(prev.model ?? { steps: 0, ms: 0, tries: 0 }), designMs: out.ms, designer: out.designer } } : prev));
      } catch {
        // the designer failed: draw the basic layout rather than wait forever
        if (my === token.current) setAnswer((prev) => (prev && prev.sql === a.sql ? { ...prev, draftVisual: false } : prev));
      } finally {
        if (my === token.current) setDesigning(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c.chainId],
  );

  const ask = useCallback(
    async (q: string, refine: boolean) => {
      const text = q.trim();
      if (!text) return;
      const my = ++token.current;
      setEvents([]);
      setReading(false);
      setPhase("query");
      setStarted(Date.now());
      setError(null);
      setRange(null);
      setDrill(null);
      setSel([]);
      setAbout(false);
      setInspect(false);
      setDesigning(false);
      setSqlOpen(false);
      const hist = refine ? history : [];
      try {
        const a = await stream({ prompt: text, history: hist }, my);
        if (my !== token.current) return;
        // a question about the other chain's data is asked on that chain's page
        if (a.route && a.route !== c.chainSlug) {
          router.push(`/explorer/${network}/${a.route}/query?q=${encodeURIComponent(text)}&from=${c.chainSlug ?? ""}`);
          return;
        }
        answerSql.current = a.sql;
        setAnswer(a);
        setSqlDraft(a.sql);
        setHistory([...hist, { prompt: text, sql: a.sql, title: a.title }].slice(-6));
        setPrompt("");
        const url = new URL(window.location.href);
        if (!refine) {
          asked.current = text;
          url.searchParams.set("q", text);
          rememberQuestion(c.chainSlug ?? String(c.chainId), text);
        }
        window.history.replaceState(null, "", url.toString());
        setPhase("idle");
        setStarted(null);
        if (a.draftVisual) void design(text, a);
        else if (a.model?.cached && a.key && a.result?.rowCount) void reread(a);
      } catch (e) {
        setError(e instanceof Error ? e.message : "The query failed.");
        setPhase("idle");
        setStarted(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c.chainId, c.chainSlug, network, router, history, design],
  );

  /** the reader's own SQL, run through the same guard */
  const runSql = useCallback(async () => {
    setPhase("running");
    setError(null);
    setRange(null);
    setDrill(null);
    setSel([]);
    setInspect(false);
    try {
      const out = await post<{ sql: string; result: QueryResult; names: Names }>({ sql: sqlDraft });
      const cols = new Set(out.result.columns.map((k) => k.name));
      let next: QueryAnswer | null = null;
      setAnswer((prev) => {
        const chart: ChartSpec = prev?.chart ?? { kind: "table", series: [] };
        const v = prev?.visual;
        const fits = !!v && v.panels.every((p) => (!p.x || cols.has(p.x)) && p.series.every((s) => cols.has(s.column))) && v.stats.every((s) => cols.has(s.column));
        const dFits = !!prev?.drill && [...prev.drill.sql.matchAll(/\{\{\s*(\w+)/g)].every((m) => cols.has(m[1]));
        next = { ...(prev as QueryAnswer), note: "Your edit of the query.", sql: out.sql, chart, drill: dFits ? prev!.drill : null, result: out.result, names: out.names ?? {}, visual: fits ? v! : null };
        return next;
      });
      if (next && !(next as QueryAnswer).visual) void design(history[history.length - 1]?.prompt ?? "", next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The query failed.");
    } finally {
      setPhase("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.chainId, sqlDraft, history, design]);

  /** one group, opened into the transactions behind it */
  const openDrill = useCallback(
    async (row: Row, index: number) => {
      if (!answer?.drill) return;
      if (drill) {
        // one level down at a time: the same mark again goes back up
        if (drill.index === index) {
          setSel(drill.prev);
          setDrill(null);
          setDigSelection(null);
        }
        return;
      }
      const title = fillTitle(answer.drill.title, row, answer.names);
      setDrill({ title, row, index, answer: null, error: null, prev: sel });
      setSel([]);
      try {
        const out = await post<DrillAnswer>({ drill: { sql: answer.drill.sql, row } });
        setDrill((d) => (d && d.index === index ? { ...d, answer: out } : d));
        setDigSelection({
          kind: "records",
          title,
          brief: [`Open on the Query page: ${title} (${out.result.rowCount} rows), from:`, out.sql, "Rows:", ...out.result.rows.slice(0, 12).map((r) => "- " + out.result.columns.map((k) => `${k.name}=${String(r[k.name])}`).join(" "))].join("\n"),
          hrefs: out.result.rows.slice(0, 8).map((r) => `${base}/tx/${String(r.tx_hash ?? "")}`),
        });
      } catch (e) {
        setDrill((d) => (d && d.index === index ? { ...d, error: e instanceof Error ? e.message : "The transactions did not load." } : d));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answer, drill, sel, c.chainId, base],
  );

  // a shared link asks on load, and so does a question typed into the
  // search bar while this page is open (same route, new ?q)
  const params = useSearchParams();
  const qParam = params.get("q");
  // sent here from the other chain's Query page
  const cameFrom = params.get("from");
  const asked = useRef<string | null>(null);
  // the latest ask, read by the effect below without making it a trigger:
  // only a new ?q may ask, never a re-render (New question changes ask)
  const askRef = useRef(ask);
  askRef.current = ask;
  useEffect(() => {
    if (!qParam || qParam === asked.current) return;
    asked.current = qParam;
    void askRef.current(qParam, false);
  }, [qParam]);
  useEffect(() => () => setDigSelection(null), []);

  const reset = () => {
    token.current++;
    setAnswer(null);
    setHistory([]);
    setError(null);
    setPrompt("");
    setRange(null);
    setDrill(null);
    setSel([]);
    setAbout(false);
    setInspect(false);
    setDesigning(false);
    setDigSelection(null);
    asked.current = null;
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    window.history.replaceState(null, "", url.toString());
    setTimeout(() => inputRef.current?.focus(), 50);
  };


  const allRows: Row[] = answer?.result?.rows ?? [];
  const names = answer?.names ?? {};
  const visual = answer?.visual ?? null;
  const canDrill = !!answer?.drill;
  const charted = !!visual && visual.panels.some((p) => p.kind !== "table");
  // the basic layout is never drawn while the real one is on its way
  const laying = designing || (!!answer?.draftVisual && !!answer.result?.rowCount);
  const recordRows = !!answer?.result && isTxList(answer.result.columns);
  const tables = answer?.sql ? [...new Set([...answer.sql.matchAll(/\b(?:FROM|JOIN)\s+((?:raw|decoded|p)_\w+)/gi)].map((m) => m[1]))] : [];
  const cov = answer?.coverage;
  const covSecs = cov ? toUnix(cov.until) - toUnix(cov.since) : 0;
  const busy = phase !== "idle";
  const stale = index && index !== "empty" && Date.now() / 1000 - index.untilUnix > STALE_S ? index : null;
  const elapsed = started ? Math.floor((Date.now() - started) / 1000) : 0;
  const shareUrl = typeof window !== "undefined" && history[0] ? `${window.location.origin}${window.location.pathname}?q=${encodeURIComponent(history[0].prompt)}` : "";

  // every surface below the chart reads the rows through the selection
  const picked = useMemo(() => applySelection(allRows, sel), [allRows, sel]);
  const drilled = drill?.answer?.result ?? null;
  // what the inspector lists: the drilled records, else the picked rows
  const level = drill
    ? { title: drill.title, columns: drilled?.columns ?? [], rows: drilled?.rows ?? [], total: drilled?.rows.length ?? 0, names: drill.answer?.names ?? {}, visual: null }
    : { title: answer?.title ?? "", columns: answer?.result?.columns ?? [], rows: picked, total: allRows.length, names, visual };

  /** a picked value in words a person reads: its name, its clock, its figure */
  const humanValue = (col: string, v: unknown): string => {
    const n = nameFor(names, col, v);
    if (n) return n;
    if (isTime(v)) return fmtX(v, "hours");
    if (isAddress(v) || isHash(v)) return truncate(v, 5);
    if (typeof v === "number") return fmt(v, formatOf(col, visual), sym);
    return String(v ?? "");
  };
  const selWords = useMemo(() => {
    if (!sel.length) return "";
    const back: Record<string, string> = {};
    const human = sel.map((p) => {
      const h = header(p.column);
      back[h] = p.column;
      return { ...p, column: h };
    });
    return describe(human, (h, v) => humanValue(back[h] ?? h, v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, names, visual, sym]);
  // the same filter as the model needs it: raw columns and values, names beside
  const selForModel = () =>
    describe(sel, (col, v) => {
      const n = nameFor(names, col, v);
      return n ? `${String(v)} (${n})` : String(v);
    });

  const submit = () => {
    const extra = answer && about && sel.length ? `${FILTER_MARK}${selForModel()}.)` : "";
    void ask(prompt + extra, !!answer);
  };

  const askAboutSelection = () => {
    setAbout(true);
    setPrompt(`For ${selWords}: `);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const popZoom = useCallback(() => {
    const d = drillNow.current;
    if (d) setSel(d.prev);
    setDrill(null);
    setDigSelection(null);
  }, []);

  // keys: / asks, R opens the rows, Esc steps back out (sheet, zoom, selection)
  const keyState = useRef({ inspect, drill: !!drill, sel: sel.length, rows: level.total, answer: !!answer });
  keyState.current = { inspect, drill: !!drill, sel: sel.length, rows: level.total, answer: !!answer };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // a focused chart handles its own Escape first (it clears the picks)
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const k = keyState.current;
      if (e.key === "/") {
        e.preventDefault();
        setInspect(false);
        inputRef.current?.focus();
      } else if ((e.key === "r" || e.key === "R") && k.answer && k.rows > 0) {
        e.preventDefault();
        setInspect((v) => !v);
      } else if (e.key === "Escape") {
        if (k.inspect) setInspect(false);
        else if (k.drill) popZoom();
        else if (k.sel) setSel([]);
        else return;
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popZoom]);

  const input = (
    <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 shadow-[0_8px_24px_-16px_rgba(24,24,27,0.3)] transition-colors focus-within:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-100">
      <textarea
        ref={inputRef}
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          if (!e.target.value) setAbout(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            e.currentTarget.blur();
          }
        }}
        rows={1}
        autoFocus={!answer}
        disabled={busy}
        placeholder={
          answer
            ? c.kind === "pchain"
              ? "Refine this answer: only L1s, per week, add delegators"
              : "Refine this answer: only reverted, per hour, add fees"
            : c.kind === "pchain"
              ? "Ask the P-Chain about validators, staking, delegations, L1s or supply"
              : `Ask ${c.chainName} about its transactions, gas, contracts or tokens`
        }
        className="max-h-40 min-h-[1.75rem] flex-1 resize-none bg-transparent py-1 font-mono text-[13px] leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-60 dark:text-zinc-50 dark:placeholder:text-zinc-600"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || !prompt.trim()}
        aria-label={answer ? "Refine" : "Ask"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-opacity disabled:opacity-25 dark:bg-zinc-100 dark:text-zinc-900"
      >
        <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );

  const quiet = "flex items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50";

  return (
    // the prompt box below is this page's search bar; the shell's would repeat it
    <QueryShell kind={c.kind} network={network}>
      {index === "empty" ? (
        <p className="rounded-2xl border border-dashed border-zinc-200 px-4 py-6 text-[13.5px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {c.chainName}&rsquo;s history is not indexed yet, so Query has nothing to read.{" "}
          <Link href={askHref(network, "c-chain")} className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-[#E6212F] dark:text-zinc-50 dark:decoration-zinc-700">
            Ask the C-Chain instead
          </Link>
        </p>
      ) : (
      <div className="flex flex-col gap-8">
        {/* the question */}
        <section className="flex flex-col gap-3">
          {answer && history.length > 0 && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 font-mono text-[11px]">
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-zinc-400 dark:text-zinc-500">
                {history.map((t, i) => (
                  <span key={i} className="flex items-baseline gap-2">
                    {i > 0 && <span className="text-zinc-300 dark:text-zinc-700">/</span>}
                    <span className={cn(i === history.length - 1 && "text-zinc-700 dark:text-zinc-200")}>{t.prompt.split(FILTER_MARK)[0]}</span>
                  </span>
                ))}
              </span>
              <button type="button" onClick={reset} className="shrink-0 uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500">
                New question
              </button>
            </div>
          )}
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
          {busy && <AvalancheLoader status={`${phase === "running" ? "Running your SQL" : progress(events)} · ${elapsed} s`} />}
          {error && <p className="border-l-2 border-[#E6212F] pl-3 font-mono text-[12px] text-[#E6212F]">{error}</p>}
          {!answer && !busy && (
            <div className="flex flex-col gap-6 pt-3">
              <QueryHome chain={c.chainSlug ?? String(c.chainId)} network={network} examples={examples} onAsk={(q) => void ask(q, false)} />
            </div>
          )}
        </section>

        {answer && (
          <section className="flex flex-col gap-5">
            {/* the answer, and its takeaway in one quiet lead */}
            <div className="flex flex-col gap-2">
              {cameFrom && cameFrom !== c.chainSlug && (
                <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                  Asked on the {cameFrom === "p-chain" ? "P-Chain" : "C-Chain"} page. This data lives on the {c.kind === "pchain" ? "P-Chain" : "C-Chain"}, so it is answered here.
                </span>
              )}
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900 sm:text-[26px] dark:text-zinc-50">{answer.title}</h1>
                {c.chainSlug && !laying && <PinToBoard chain={c.chainSlug} network={network} answer={answer} question={history.at(-1)?.prompt} className="mt-1 shrink-0" />}
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
                !reading && answer.note && <p className="max-w-3xl text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{answer.note}</p>
              )}
            </div>

            {/* the chart, full width; a drill zooms it in place */}
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
                {drill ? (
                  <Crumbs items={[{ label: answer.title, onClick: popZoom }, { label: drill.title }]} />
                ) : (
                  <span className="min-w-0 truncate font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                    {sel.length ? `${formatNumber(picked.length)} of ${formatNumber(allRows.length)} rows` : charted ? (canDrill ? "Drag or click to filter. Open a mark with ›." : "Drag or click to filter.") : ""}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  {level.total > 0 && (
                    <button
                      type="button"
                      onClick={() => setInspect(true)}
                      aria-haspopup="dialog"
                      aria-keyshortcuts="R"
                      className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 font-mono text-[11px] tabular-nums text-zinc-700 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                    >
                      <Rows3 className="h-3.5 w-3.5" />
                      Rows ({formatNumber(level.rows.length)})
                      <kbd className="hidden rounded bg-white px-1 text-[10px] text-zinc-400 sm:inline dark:bg-zinc-950 dark:text-zinc-500">R</kbd>
                    </button>
                  )}
                </span>
              </div>

              <ZoomStage level={drill ? `drill-${drill.index}` : laying ? "laying" : "answer"}>
                {drill ? (
                  <div className={cn(CARD, "px-4 py-4 sm:px-5 sm:py-5")}>
                    <DrillView drill={drill} base={base} sym={sym} hoverTx={hoverTx} onHoverTx={setHoverTx} onRows={() => setInspect(true)} />
                  </div>
                ) : laying ? (
                  // one draw: the loader holds the space until the layout is final
                  <div aria-busy="true" className={cn(CARD, "flex min-h-[18rem] flex-1 flex-col")}>
                    <AvalancheLoader status="Rows are in. Laying out the chart" fill framed={false} />
                  </div>
                ) : charted && visual ? (
                  <QueryVisual
                    visual={visual}
                    rows={allRows}
                    names={names}
                    sym={sym}
                    canDrill={canDrill || recordRows}
                    onPick={(r) => {
                      if (recordRows && r.tx_hash) return router.push(`${base}/tx/${String(r.tx_hash)}`);
                      // a mark that is one thing on the chain (a contract, a
                      // validator, a block) opens that thing's own page
                      const door = visual?.panels.map((p) => p.x && doorFor(p.x, r[p.x], base)).find(Boolean);
                      if (door) return router.push(door);
                      const i = allRows.indexOf(r);
                      if (i >= 0) void openDrill(r, i);
                    }}
                    hoverKey={hoverKey}
                    onHoverKey={setHoverKey}
                    range={range}
                    onRange={setRange}
                    onZoom={(lo, hi) => void ask(`Only between ${String(lo)} and ${String(hi)} inclusive, same figures, finer buckets if that helps.`, true)}
                    selection={sel}
                    onSelection={setSel}
                    panelAction={c.chainSlug ? (i) => <PinToBoard chain={c.chainSlug!} network={network} answer={answer} panelIndex={i} question={history.at(-1)?.prompt} /> : undefined}
                  />
                ) : allRows.length === 1 ? (
                  // one row is a set of figures: each column on its own card
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {(answer.result?.columns ?? []).map((col) => {
                      const v = allRows[0][col.name];
                      const f = formatOf(col.name, visual);
                      return (
                        <div key={col.name} className={cn(CARD, "flex min-w-0 flex-col gap-2 px-4 py-4 sm:px-5 sm:py-5")}>
                          <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{header(col.name)}</span>
                          <span className="truncate font-mono text-[22px] leading-none tabular-nums tracking-tight text-zinc-900 sm:text-[26px] dark:text-zinc-50">
                            {typeof v === "number" ? fmt(v, /pct|percent|ratio/i.test(col.name) && f === "number" ? "percent" : f, sym) : (nameFor(names, col.name, v) ?? (isAddress(v) ? truncate(String(v), 6) : String(v ?? "")))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : allRows.length ? (
                  // no chart to index the rows: the rows, by their shape, are the view
                  <div className={cn(CARD, "px-2 py-3")}>
                    <RowsBody
                      columns={answer.result?.columns ?? []}
                      rows={allRows}
                      names={names}
                      visual={visual}
                      base={base}
                      sym={sym}
                      onOpen={canDrill ? (r) => void openDrill(r, allRows.indexOf(r)) : undefined}
                    />
                  </div>
                ) : (
                  <p className={cn(CARD, "px-5 py-10 font-mono text-[12px] text-zinc-500")}>The query returned no rows.</p>
                )}
              </ZoomStage>
            </div>

            {/* where the figures came from, folded away until asked */}
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
                      {visual && visual.callouts.length > 0 && answer.note && <p className="max-w-3xl text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">{answer.note}</p>}
                      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
                        <Fact label="Source" sub="Indexed ClickHouse tables, read-only">
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
                          <Fact label="Result" sub={`${formatNumber(answer.result.rowsRead)} rows scanned in ${(answer.result.elapsedMs / 1000).toFixed(2)} s`}>
                            {formatNumber(answer.result.rowCount)} row{answer.result.rowCount === 1 ? "" : "s"}
                            {answer.result.truncated ? " (capped)" : ""}
                          </Fact>
                        )}
                      </dl>

                      <div className="flex flex-col gap-2">
                        <span className="flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px]">
                          <button type="button" onClick={() => setSqlOpen((v) => !v)} className="text-zinc-900 transition-colors hover:text-[#E6212F] dark:text-zinc-50">
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
                          {shareUrl && (
                            <button type="button" onClick={() => copy("link", shareUrl)} className={quiet}>
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
                            onChange={(e) => setSqlDraft(e.target.value)}
                            spellCheck={false}
                            rows={Math.min(18, Math.max(5, sqlDraft.split("\n").length + 1))}
                            className="w-full resize-y rounded-xl bg-zinc-50 px-3 py-2 font-mono text-[12px] leading-relaxed text-zinc-900 outline-none ring-1 ring-zinc-200/70 focus:ring-zinc-400 dark:bg-zinc-900/50 dark:text-zinc-100 dark:ring-zinc-800"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
                            <span className="text-zinc-400 dark:text-zinc-500">
                              {c.kind === "pchain"
                                ? `One SELECT over the P-Chain tables (decoded_p_txs, the UTXO and snapshot tables), with chain_id = ${c.chainId}. At most 2,000 rows.`
                                : `One SELECT over raw_blocks, raw_txs, raw_logs or raw_traces, with chain_id = ${c.chainId}. At most 2,000 rows.`}
                            </span>
                            <button type="button" onClick={() => void runSql()} disabled={busy || sqlDraft.trim() === answer.sql.trim()} className="rounded-full bg-zinc-900 px-3.5 py-1.5 uppercase tracking-[0.14em] text-white disabled:opacity-25 dark:bg-zinc-100 dark:text-zinc-900">
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
            <p className="font-mono text-[10.5px] leading-relaxed text-zinc-400 dark:text-zinc-500">{SQL_CAVEAT}</p>
          </section>
        )}
      </div>
      )}

      {answer && (
        <QueryInspector
          open={inspect}
          onClose={() => setInspect(false)}
          title={level.title}
          sub={drill ? drill.title : sel.length ? selWords : undefined}
          columns={level.columns}
          rows={level.rows}
          total={level.total}
          names={level.names}
          visual={level.visual}
          base={base}
          sym={sym}
          onOpen={
            !drill && canDrill && !recordRows
              ? (r) => {
                  setInspect(false);
                  void openDrill(r, allRows.indexOf(r));
                }
              : undefined
          }
        />
      )}
    </QueryShell>
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
