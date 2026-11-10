"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import { setSelection as setDigSelection } from "@/components/explorer-v2/dig/selection";
import type { ChartSpec, DrillAnswer, Names, QueryAnswer, SourceNote, Turn } from "@/lib/explorer-query/types";
import type { QueryEvent } from "@/lib/explorer-query/answer";
import type { Coverage, QueryResult } from "@/lib/explorer-query/clickhouse";
import type { VisualSpec } from "@/lib/explorer-query/visual-spec";
import { type Selection, applySelection } from "@/lib/explorer-query/selection";
import { type Row, doorFor, fillTitle, isTxList, rowDoor } from "./QueryRows";
import { QueryInspector } from "./QueryInspector";
import { type OpenDrill, ZoomStage } from "./QueryZoom";
import { bucketOf } from "./drill-plot";
import { FILTER_MARK, QueryError, SQL_CAVEAT, postQuery, progress, readerError, streamQuery, withEdges } from "./query-client";
import { EXAMPLES, PCHAIN_EXAMPLES, examplesFor } from "@/lib/explorer-query/examples";
import { rememberQuestion } from "@/lib/explorer-query/recent";
import { askHref } from "@/lib/explorer-query/board-links";
import { NETWORK_SLUG, rowBase } from "@/lib/explorer-query/target";
import { type Kept, threadOf } from "@/lib/explorer-query/threads";
import type { SpanKey } from "@/lib/explorer-query/window-shift";
import { QueryHow } from "./QueryHow";
import { type TabLink, QueryTabs } from "./query-tabs";
import { runTileSql } from "./query-board-bits";
import { AnswerHead } from "./query/answer-head";
import { AnswerSkeleton } from "./query/answer-skeleton";
import { AnswerStage } from "./query/answer-stage";
import { AskSection } from "./query/ask-section";
import { type Moved, movedAnswer } from "./query/moved-answer";
import { SQL_DRAWER_ID, SqlDrawer, useSqlOpen } from "./query/sql-drawer";
import { StageBar } from "./query/stage-bar";
import { usePrior } from "./query/use-prior";
import { useQueryKeys } from "./query/use-query-keys";
import { useSelectionWords } from "./query/use-selection-words";

/* A question about the chain, answered as a sheet in the explorer's
   own grammar. The query stage returns rows first and the page draws
   them at once; the layout stage then arranges them (headline figures,
   panels, a short reading). The chart is the index of the rows: a pick
   on it filters every surface, the rows open in a sheet beside it, and
   a mark zooms in place into the records behind it. Where the figures
   came from (tables, window, timings, SQL) folds away under the chart. */


/* the thread rides in the URL: ?q= the question, one &then= per
   follow-up, so a copied link opens the refined answer and not the first */
const threadKey = (p: URLSearchParams) => JSON.stringify([p.get("q"), ...p.getAll("then")]);



/** the chain a Query page asks: its table chain_id and how the page names it */
export interface QueryChain {
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

/** a value the server streams in after the page: null until it lands */
export function useStreamed<T>(p: Promise<T> | null): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    p?.then((x) => live && setV(x), () => undefined);
    return () => {
      live = false;
    };
  }, [p]);
  return v;
}

/** an EVM chain's Query page, inside the chain's own layout and shell. What
    the database holds of the chain streams in after the page, so the page
    never waits on that read */
export function EvmQuery({ network, index = null }: { network: string; index?: Promise<IndexState> | null }) {
  const c = useChainContext();
  const state = useStreamed(index);
  return (
    <QueryTabs network={network} kind="evm" path={askHref(network, c.chainSlug)} chain={c.chainSlug} off={state === "empty"}>
      {(t) => (
        <QueryPage
          key={t.key}
          tab={t.link}
          network={network}
          c={{ chainId: c.chainId, chainSlug: c.chainSlug, chainName: c.chainName, nativeToken: c.nativeToken, kind: "evm" }}
          examples={examplesFor(c.chainId)}
          index={state}
        />
      )}
    </QueryTabs>
  );
}

/** the P-Chain's Query page: its rows carry chain_id 1 (mainnet) or 5 (Fuji) */
export function PchainQuery({ network }: { network: string }) {
  return (
    <QueryTabs network={network} kind="pchain" path={askHref(network, "p-chain")} chain="p-chain">
      {(t) => (
        <QueryPage
          key={t.key}
          tab={t.link}
          network={network}
          c={{ chainId: network === "fuji" ? 5 : 1, chainSlug: "p-chain", chainName: "the P-Chain", nativeToken: "AVAX", kind: "pchain" }}
          examples={PCHAIN_EXAMPLES}
        />
      )}
    </QueryTabs>
  );
}

export function QueryPage({
  tab,
  network,
  c,
  examples,
  index = null,
  picker,
  onRoute,
  resolve,
}: {
  /** the tab the page is in: what it opens on, and where it reports (query-tabs.tsx) */
  tab: TabLink;
  network: string;
  c: QueryChain;
  examples: typeof EXAMPLES;
  index?: IndexState;
  /** the network scope's chain picker, above the question */
  picker?: React.ReactNode;
  /** where a question about another chain goes; the default navigates to that chain's page */
  onRoute?: (route: string, q: string) => void;
  /** the chain a new question names, read before it is asked */
  resolve?: (q: string) => string | null | Promise<string | null>;
}) {
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken ?? "AVAX";
  // a board's SQL is bound to one chain: All chains pins nothing
  const pinnable = !!c.chainSlug && c.chainSlug !== NETWORK_SLUG;
  const params = useSearchParams();
  const tabNow = useRef(tab);
  tabNow.current = tab;
  // a tab opens on the answer it keeps; rows it could not keep are read again first (restore)
  const seed = tab.initial && !tab.initial.cut ? tab.initial : null;
  // else a link's question is asked on load, so the first frame is already the working one. Read from
  // the address bar: params trail a tab's own replaceState by a render
  const linkQ = () => (tab.initial === undefined ? (typeof window === "undefined" ? params : new URL(window.location.href).searchParams).get("q") : null);

  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"idle" | "query" | "running">(() => (linkQ()?.trim() ? "query" : "idle"));
  // the question on its way and the thread it follows, shown on the thread line until its answer stands
  const [asking, setAsking] = useState<{ text: string; prior: string[] } | null>(() => {
    const q = linkQ();
    return q ? { text: q, prior: [] } : null;
  });
  const [designing, setDesigning] = useState(false);
  // what the model has done so far on this question
  const [events, setEvents] = useState<QueryEvent[]>([]);
  // a kept answer's reading, being written again
  const [reading, setReading] = useState(false);
  // the SQL the model handed back, so an edit is not laid out as if it were kept
  const answerSql = useRef(seed?.answer.sql ?? "");
  const [error, setError] = useState<string | null>(null);
  // the anonymous limit was hit: the error offers sign-in, which lifts it
  const [gated, setGated] = useState(false);
  const [answer, setAnswer] = useState<QueryAnswer | null>(seed?.answer ?? null);
  const [history, setHistory] = useState<Turn[]>(seed?.turns ?? []);
  // what the tab gave the page: drawn again, not reported back as new
  const seeded = useRef<QueryAnswer | null>(seed?.answer ?? null);
  const [sqlOpen, setSqlOpen] = useSqlOpen();
  // a window button: the span being read, and the answer as first given, which its own button brings back
  const [moving, setMoving] = useState<SpanKey | null>(null);
  const origin = useRef<QueryAnswer | null>(null);
  const [sqlDraft, setSqlDraft] = useState(seed?.answer.sql ?? "");
  const [range, setRange] = useState<[number, number] | null>(null);
  const [drill, setDrill] = useState<OpenDrill | null>(null);
  const drillNow = useRef(drill);
  drillNow.current = drill;
  // the reader's picks on this level of this answer; the chart edits them
  const [sel, setSel] = useState<Selection>([]);
  // the next question is about the selection
  const [about, setAbout] = useState(false);
  const [inspect, setInspect] = useState(false);
  const [started, setStarted] = useState<number | null>(null);
  // one pointer for the whole sheet: a bar and its row, a dot and its row
  const [hoverKey, setHoverKey] = useState<unknown>(undefined);
  const [hoverTx, setHoverTx] = useState<string | null>(null);
  const router = useRouter();
  const [, tick] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const token = useRef(0);
  // a page leaves with its tab; a question it asked must not write the URL of the tab now in view
  const live = useRef(true);
  const gone = (my: number) => my !== token.current || !live.current;

  // the elapsed clock while a stage runs
  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [started]);

  const post = <T,>(body: object): Promise<T> => postQuery<T>({ chainId: c.chainId, ...body });

  /** a question, streamed: each step as it ends, then the answer */
  const stream = (body: object, my: number): Promise<QueryAnswer> =>
    streamQuery({ chainId: c.chainId, ...body }, (e) => {
      if (my === token.current) setEvents((prev) => [...prev, e]);
    });

  /** a kept layout's sentences, written again from the rows just fetched */
  const reread = async (a: QueryAnswer) => {
    const my = token.current;
    setReading(true);
    try {
      const out = await post<{ callouts: string[]; ms: number }>({ key: a.key, trace: a.trace, reading: true });
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
            ? { key: a.key, trace: a.trace }
            : { trace: a.trace, design: { question, title: a.title, note: a.note, columns: a.result.columns, rows: a.result.rows, names: a.names, chart: a.chart } },
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

  /** the thread as the URL keeps it; the page will not ask it again */
  const writeThread = (text: string, refine: boolean) => {
    const url = new URL(window.location.href);
    if (refine) url.searchParams.append("then", text);
    else {
      url.searchParams.set("q", text);
      url.searchParams.delete("then");
    }
    asked.current = threadKey(url.searchParams);
    window.history.replaceState(null, "", url.toString());
  };

  /* a kept answer, drawn again with no model. Rows the store left out are
     read again first: the SQL runs alone, and the layout stands without
     its reading, which was about the old rows */
  const restore = async (k: Kept) => {
    const my = ++token.current;
    const thread = threadOf(k);
    answerSql.current = k.answer.sql;
    setSqlDraft(k.answer.sql);
    setHistory(k.turns);
    if (!k.cut) {
      seeded.current = k.answer;
      setAnswer(k.answer);
      setPhase("idle");
      return;
    }
    setAsking({ text: thread[thread.length - 1], prior: thread.slice(0, -1) });
    setEvents([{ type: "stage", stage: "cached" }]);
    setPhase("query");
    setStarted(Date.now());
    try {
      const run = await runTileSql(`tab:${c.chainId}:${k.answer.sql}`, c.chainId, k.answer.sql);
      if (my !== token.current) return;
      const a = { ...k.answer, result: run.result, names: run.names, anchor: run.anchor ?? k.answer.anchor, visual: k.answer.visual && { ...k.answer.visual, callouts: [] } };
      seeded.current = a;
      setAnswer(a);
    } catch (e) {
      if (my === token.current) setError(e instanceof Error ? readerError(e.message) : "The query failed.");
    } finally {
      if (my === token.current) {
        setPhase("idle");
        setStarted(null);
      }
    }
  };
  useLayoutEffect(() => {
    if (tab.initial?.cut) void restore(tab.initial);
  }, []);

  /* a question, or a follow-up on the answer in view. A replay (a link
     with its thread) passes each step's history along and leaves the URL
     as it came. Resolves to the thread so far, or null when it stopped. */
  const ask = useCallback(
    async (q: string, refine: boolean, opts: { replay?: boolean; hist?: Turn[] } = {}): Promise<Turn[] | null> => {
      const text = q.trim();
      if (!text) return null;
      const my = ++token.current;
      const hist = refine ? (opts.hist ?? history) : [];
      setAsking({ text, prior: hist.map((t) => t.prompt) });
      setEvents([]);
      setReading(false);
      setPhase("query");
      setStarted(Date.now());
      setError(null);
      setGated(false);
      setRange(null);
      setDrill(null);
      setSel([]);
      setAbout(false);
      setInspect(false);
      setDesigning(false);
      // a new question that names another chain is asked there, and this page works until that one opens; a follow-up stays on this chain
      const named = !refine && resolve && onRoute ? await resolve(text) : null;
      if (gone(my)) return null;
      if (named && named !== c.chainSlug) {
        onRoute!(named, text);
        return null;
      }
      try {
        const a = await stream({ prompt: text, history: hist }, my);
        if (gone(my)) return null;
        // a question about the other chain's data is asked on that chain's page
        if (a.route && a.route !== c.chainSlug) {
          if (onRoute) onRoute(a.route, text);
          else router.push(`/explorer/${network}/${a.route}/query?q=${encodeURIComponent(text)}&from=${c.chainSlug ?? ""}`);
          return null;
        }
        const next = [...hist, { prompt: text, sql: a.sql, title: a.title }].slice(-6);
        answerSql.current = a.sql;
        origin.current = null;
        setAnswer(a);
        setSqlDraft(a.sql);
        setHistory(next);
        setPrompt("");
        if (!opts.replay) writeThread(text, refine);
        if (!refine) rememberQuestion(c.chainSlug ?? String(c.chainId), text);
        setPhase("idle");
        setStarted(null);
        if (a.draftVisual) void design(text, a);
        else if (a.model?.cached && a.key && a.result?.rowCount) void reread(a);
        return next;
      } catch (e) {
        if (gone(my)) return null;
        setError(e instanceof Error ? readerError(e.message) : "The query failed.");
        if (e instanceof QueryError && e.signIn) {
          // after sign-in the page reloads on its thread and asks it again
          if (!opts.replay) writeThread(text, refine);
          setGated(true);
        }
        setPhase("idle");
        setStarted(null);
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c.chainId, c.chainSlug, network, router, history, design, onRoute],
  );

  /** the reader's own SQL, run through the same guard */
  const runSql = useCallback(async () => {
    setPhase("running");
    setError(null);
    setGated(false);
    setRange(null);
    setDrill(null);
    setSel([]);
    setInspect(false);
    try {
      const out = await post<{ sql: string; result: QueryResult; names: Names; sources?: SourceNote[]; moves?: QueryAnswer["moves"] }>({ sql: sqlDraft, x: answer?.chart.x });
      const cols = new Set(out.result.columns.map((k) => k.name));
      origin.current = null;
      let next: QueryAnswer | null = null;
      setAnswer((prev) => {
        const chart: ChartSpec = prev?.chart ?? { kind: "table", series: [] };
        const v = prev?.visual;
        const fits = !!v && v.panels.every((p) => (!p.x || cols.has(p.x)) && p.series.every((s) => cols.has(s.column))) && v.stats.every((s) => cols.has(s.column));
        const dFits = !!prev?.drill && [...prev.drill.sql.matchAll(/\{\{\s*(\w+)/g)].every((m) => cols.has(m[1]));
        next = { ...(prev as QueryAnswer), note: "Your edit of the query.", sql: out.sql, chart, drill: dFits ? prev!.drill : null, result: out.result, totals: null, names: out.names ?? {}, sources: out.sources ?? [], moves: out.moves ?? null, visual: fits ? v! : null };
        return next;
      });
      if (next && !(next as QueryAnswer).visual) void design(history[history.length - 1]?.prompt ?? "", next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The query failed.");
    } finally {
      setPhase("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.chainId, sqlDraft, history, design, answer?.chart.x]);

  /** an answer in the page's state, with the thread's last turn following its SQL: a follow-up refines what is in view */
  const show = (a: QueryAnswer) => {
    setAnswer(a);
    setSqlDraft(a.sql);
    setHistory((h) => h.map((t, i) => (i === h.length - 1 ? { ...t, sql: a.sql, title: a.title } : t)));
    setRange(null);
    setDrill(null);
    setSel([]);
    setInspect(false);
  };

  /** a window button: the answer in view, read again over another span. No model is asked */
  const moveWindow = async (key: SpanKey) => {
    const from = answer;
    if (!from?.result) return;
    setMoving(key);
    setPhase("running");
    setError(null);
    setGated(false);
    try {
      const out = await post<Moved>({ move: { sql: from.sql, drill: from.drill?.sql, x: from.chart.x, span: key, title: from.title, note: from.note } });
      origin.current ??= from;
      show(movedAnswer(from, out, key));
    } catch (e) {
      setError(e instanceof Error ? readerError(e.message) : "The query failed.");
    } finally {
      setMoving(null);
      setPhase("idle");
    }
  };

  /** the SQL, opened from a tile or from the provenance block: brought into view */
  const openSql = () => {
    setSqlOpen(true);
    requestAnimationFrame(() => document.getElementById(SQL_DRAWER_ID)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

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
      const title = fillTitle(answer.drill.title, row, answer.names), span = bucketOf(row[answer.chart.x ?? ""], answer.chart.x, answer.result?.rows ?? []);
      setDrill({ title, row, index, answer: null, error: null, prev: sel, span });
      setSel([]);
      try {
        const out = await post<DrillAnswer>({ drill: { sql: answer.drill.sql, row, span } });
        setDrill((d) => (d && d.index === index ? { ...d, answer: out } : d));
        setDigSelection({
          kind: "records",
          title,
          brief: [`Open on the Query page: ${title} (${out.result.rowCount} rows), from:`, out.sql, "Rows:", ...out.result.rows.slice(0, 12).map((r) => "- " + out.result.columns.map((k) => `${k.name}=${String(r[k.name])}`).join(" "))].join("\n"),
          // on the network's page, a record opens on the chain its row or the opened row names
          hrefs: out.result.rows.slice(0, 8).flatMap((r) => doorFor("tx_hash", r.tx_hash, rowBase(base, row) ?? base, r) ?? []),
        });
      } catch (e) {
        setDrill((d) => (d && d.index === index ? { ...d, error: e instanceof Error ? e.message : "The transactions did not load." } : d));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answer, drill, sel, c.chainId, base],
  );

  // a shared link asks on load, its follow-ups after it, and so does a
  // question typed into the search bar while this page is open (same
  // route, new ?q)
  const qParam = params.get("q");
  const thread = threadKey(params);
  // sent here from the other chain's Query page
  const cameFrom = params.get("from");
  const asked = useRef<string | null>(tab.initial ? JSON.stringify(threadOf(tab.initial)) : null);
  // the latest ask, read by the effect below without making it a trigger:
  // only a new thread in the URL may ask, never a re-render (each answer changes ask)
  const askRef = useRef(ask);
  askRef.current = ask;
  useEffect(() => {
    // params trail a replaceState by a render: ask only the thread the address bar holds
    if (!qParam || thread === asked.current || thread !== threadKey(new URL(window.location.href).searchParams)) return;
    asked.current = thread;
    const [first, ...then] = JSON.parse(thread) as string[];
    // a thread a tab keeps opens with no model (a reload, a link to a question asked before); another tab's opens in its own page
    const k = tabNow.current.land([first, ...then]);
    if (!k) return;
    if (k !== "ask") return void restore(k);
    void (async () => {
      let h = await askRef.current(first, false, { replay: true });
      for (const t of then) {
        if (!h || asked.current !== thread) return;
        h = await askRef.current(t, true, { replay: true, hist: h });
      }
    })();
  }, [thread, qParam]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      setDigSelection(null);
    };
  }, []);

  const allRows: Row[] = answer?.result?.rows ?? [];
  const names = answer?.names ?? {};
  const visual = answer?.visual ?? null;
  // a time series' edge buckets that the window cuts through wear a label
  const drawn = useMemo(() => withEdges(visual, answer), [visual, answer]);
  const canDrill = !!answer?.drill;
  const charted = !!visual && visual.panels.some((p) => p.kind !== "table");
  // the basic layout is never drawn while the real one is on its way
  const laying = designing || (!!answer?.draftVisual && !!answer.result?.rowCount);
  const recordRows = !!answer?.result && isTxList(answer.result.columns);
  const busy = phase !== "idle";
  const working = phase === "query" && asking !== null;
  const crumbs = working ? [...asking.prior, asking.text] : answer ? history.map((t) => t.prompt) : [];
  const stale = index && index !== "empty" && Date.now() / 1000 - index.untilUnix > STALE_S ? index : null;
  const elapsed = started ? Math.floor((Date.now() - started) / 1000) : 0;

  // the tab keeps the thread on the line, and the answer once it stands
  const line = JSON.stringify(crumbs);
  useEffect(() => {
    if (answer && answer === seeded.current) return;
    tabNow.current.onChange(JSON.parse(line) as string[], history, answer);
  }, [line, history, answer]);

  // every surface below the chart reads the rows through the selection
  const picked = useMemo(() => applySelection(allRows, sel), [allRows, sel]);

  /** a row opens what it is about: its transaction, the thing its axis names, else its records */
  const openRow = (r: Row) => {
    const door = rowDoor(r, answer?.result?.columns ?? [], visual, base);
    if (door) return router.push(door);
    const i = allRows.indexOf(r);
    if (i >= 0) void openDrill(r, i);
  };
  const drilled = drill?.answer?.result ?? null;
  // what the inspector lists: the drilled records, else the picked rows
  const level = drill
    ? { title: drill.title, columns: drilled?.columns ?? [], rows: drilled?.rows ?? [], total: drilled?.rows.length ?? 0, names: drill.answer?.names ?? {}, visual: null }
    : { title: answer?.title ?? "", columns: answer?.result?.columns ?? [], rows: picked, total: allRows.length, names, visual };

  const { selWords, selForModel } = useSelectionWords({ sel, allRows, names, visual, sym });
  // each figure says how it moved against the period before, once that period is read
  const prior = usePrior(answer, c.chainId);

  const submit = () => {
    const extra = answer && about && sel.length ? `${FILTER_MARK}${selForModel()}.)` : "";
    // a live monitor ran no SQL for the writer to refine: what is typed under it is a new question
    void ask(prompt + extra, !!answer && !answer.monitor);
  };

  const popZoom = useCallback(() => {
    const d = drillNow.current;
    if (d) setSel(d.prev);
    setDrill(null);
    setDigSelection(null);
  }, []);

  // keys: / asks, R opens the rows, Esc steps back out (sheet, zoom, selection)
  useQueryKeys({ inspect, drill: !!drill, sel: sel.length, rows: level.total, answer: !!answer }, { inputRef, setInspect, setSel, popZoom });

  return (
    // the prompt box below is this page's search bar, so its shell (query-tabs.tsx) draws none. An answer's title is the h1
    <>
      {picker && <div className="mb-6">{picker}</div>}
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
        <AskSection
          crumbs={crumbs} answer={answer} drill={drill} sel={sel} selWords={selWords}
          prompt={prompt} setPrompt={setPrompt} setAbout={setAbout} submit={submit} inputRef={inputRef}
          phase={phase} moving={moving !== null} elapsed={elapsed} stale={stale} error={error} gated={gated}
          c={c} network={network} examples={examples} ask={ask}
        />

        {/* a question on its way stands in the answer's frame: the grid shows at once, and fills as each part lands */}
        {working && <AnswerSkeleton question={asking.text} status={`${progress(events)} · ${elapsed} s`} />}

        {answer && !working && (
          <section className="flex flex-col gap-5">
            {/* the answer, and its takeaway in one quiet lead */}
            <AnswerHead answer={answer} visual={visual} history={history} c={c} network={network} base={base} cameFrom={cameFrom} pinnable={pinnable} laying={laying} reading={reading} />

            {/* the chart, full width; a drill zooms it in place */}
            <div className="flex min-w-0 flex-col gap-3">
              <StageBar
                answer={answer} drill={drill} sel={sel} picked={picked} allRows={allRows} level={level} charted={charted} canDrill={canDrill} popZoom={popZoom} setInspect={setInspect}
                own={(origin.current ?? answer).moves?.own ?? null} moving={moving} busy={busy || laying} onMove={(k) => void moveWindow(k)} onOwn={() => origin.current && show(origin.current)}
                sqlOpen={sqlOpen} onSql={setSqlOpen}
              />
              {sqlOpen && answer.result && !drill && <SqlDrawer answer={answer} c={c} busy={busy} draft={sqlDraft} onDraft={setSqlDraft} onRun={() => void runSql()} onClose={() => setSqlOpen(false)} />}

              <ZoomStage level={drill ? `drill-${drill.index}` : laying ? "laying" : "answer"}>
                <AnswerStage
                  answer={answer} visual={visual} drawn={drawn} drill={drill} laying={laying} charted={charted} canDrill={canDrill} recordRows={recordRows} pinnable={pinnable}
                  allRows={allRows} picked={picked} names={names} history={history} c={c} network={network} base={base} sym={sym}
                  sel={sel} setSel={setSel} range={range} setRange={setRange} hoverKey={hoverKey} setHoverKey={setHoverKey} hoverTx={hoverTx} setHoverTx={setHoverTx}
                  setInspect={setInspect} openRow={openRow} openDrill={openDrill} ask={ask} prior={prior} onSql={openSql}
                />
              </ZoomStage>
            </div>

            {/* where the figures came from, folded away until asked */}
            {/* a monitor ran no SQL: its card says where its moves come from */}
            {!answer.monitor && (
              <QueryHow
                answer={answer}
                visual={visual}
                names={names}
                base={base}
                drill={drill}
                designing={designing}
                linked={history.length > 0}
                sqlOpen={sqlOpen}
                onSqlOpen={(open) => (open ? openSql() : setSqlOpen(false))}
              />
            )}
            {answer.result && <p className="font-mono text-[10.5px] leading-relaxed text-zinc-400 dark:text-zinc-500">{SQL_CAVEAT}</p>}
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
          sql={drill ? drill.answer?.sql : answer.sql}
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
    </>
  );
}
