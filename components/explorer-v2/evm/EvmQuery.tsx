"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageSquarePlus, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import { setSelection as setDigSelection } from "@/components/explorer-v2/dig/selection";
import type { ChartSpec, DrillAnswer, Names, QueryAnswer, SourceNote, Turn } from "@/lib/explorer-query/types";
import type { QueryEvent } from "@/lib/explorer-query/answer";
import type { Coverage, QueryResult } from "@/lib/explorer-query/clickhouse";
import type { VisualSpec } from "@/lib/explorer-query/visual";
import { type Selection, applySelection, describe } from "@/lib/explorer-query/selection";
import { isAddress, isHash, isTime } from "@/lib/explorer-query/values";
import { CARD, QueryVisual, fmt, nameFor, tipX, zoneOf } from "./QueryVisual";
import { type Row, NoteText, PanelRows, doorFor, fillTitle, formatOf, header, isTxList, rowDoor } from "./QueryRows";
import { QueryHome } from "./QueryHome";
import { PinToBoard } from "./QueryBoard";
import { QueryInspector, RowsBody } from "./QueryInspector";
import { Crumbs, DrillView, type OpenDrill, ZoomStage } from "./QueryZoom";
import { bucketOf } from "./drill-plot";
import { QueryLoader } from "./QueryLoader";
import { PromptBox, ThreadLine, placeholderOf } from "./QueryWorking";
import { FILTER_MARK, NO_QUERY, QueryError, SQL_CAVEAT, cutLine, postQuery, progress, readerError, reads, rowCount, rowsLabel, sourceLines, streamQuery, withEdges } from "./query-client";
import { QueryMonitor } from "./QueryMonitor";
import { EXAMPLES, PCHAIN_EXAMPLES, examplesFor } from "@/lib/explorer-query/examples";
import { rememberQuestion } from "@/lib/explorer-query/recent";
import { askHref } from "@/lib/explorer-query/board-links";
import { NETWORK_SLUG, rowBase } from "@/lib/explorer-query/target";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import { type Kept, threadOf } from "@/lib/explorer-query/threads";
import { QueryHow } from "./QueryHow";
import { type TabLink, QueryTabs } from "./query-tabs";
import { runTileSql } from "./query-board-bits";

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
  const { openLoginModal } = useLoginModalTrigger();
  const [answer, setAnswer] = useState<QueryAnswer | null>(seed?.answer ?? null);
  const [history, setHistory] = useState<Turn[]>(seed?.turns ?? []);
  // what the tab gave the page: drawn again, not reported back as new
  const seeded = useRef<QueryAnswer | null>(seed?.answer ?? null);
  const [sqlOpen, setSqlOpen] = useState(false);
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
  const still = useReducedMotion();
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
      setSqlOpen(false);
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
      const out = await post<{ sql: string; result: QueryResult; names: Names; sources?: SourceNote[] }>({ sql: sqlDraft });
      const cols = new Set(out.result.columns.map((k) => k.name));
      let next: QueryAnswer | null = null;
      setAnswer((prev) => {
        const chart: ChartSpec = prev?.chart ?? { kind: "table", series: [] };
        const v = prev?.visual;
        const fits = !!v && v.panels.every((p) => (!p.x || cols.has(p.x)) && p.series.every((s) => cols.has(s.column))) && v.stats.every((s) => cols.has(s.column));
        const dFits = !!prev?.drill && [...prev.drill.sql.matchAll(/\{\{\s*(\w+)/g)].every((m) => cols.has(m[1]));
        next = { ...(prev as QueryAnswer), note: "Your edit of the query.", sql: out.sql, chart, drill: dFits ? prev!.drill : null, result: out.result, totals: null, names: out.names ?? {}, sources: out.sources ?? [], visual: fits ? v! : null };
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

  /** a picked value in words a person reads: its name, its clock, its figure */
  const humanValue = (col: string, v: unknown): string => {
    const n = nameFor(names, col, v);
    if (n) return n;
    // in the zone the chart's axis and chips read in, named: the words also go to the model, which reads UTC rows
    if (isTime(v)) return tipX(v, "hours", zoneOf(allRows.map((r) => r[col])));
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
    // a live monitor ran no SQL for the writer to refine: what is typed under it is a new question
    void ask(prompt + extra, !!answer && !answer.monitor);
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
          {busy && <QueryLoader status={`${phase === "running" ? "Running your SQL" : progress(events)} · ${elapsed} s`} />}
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

            {/* the chart, full width; a drill zooms it in place */}
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
                {drill ? (
                  <Crumbs items={[{ label: answer.title, onClick: popZoom }, { label: drill.title }]} />
                ) : (
                  <span className="min-w-0 truncate font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                    {sel.length ? `${formatNumber(picked.length)} of ${rowCount(allRows.length)}` : [cutLine(answer), charted ? (canDrill ? "Drag or click to filter. Open a mark with ›." : "Drag or click to filter.") : ""].filter(Boolean).join(" · ")}
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
                      Rows ({drill || sel.length || !answer ? formatNumber(level.rows.length) : rowsLabel(answer, level.rows.length)})
                      <kbd className="hidden rounded bg-white px-1 text-[10px] text-zinc-400 sm:inline dark:bg-zinc-950 dark:text-zinc-500">R</kbd>
                    </button>
                  )}
                </span>
              </div>

              <ZoomStage level={drill ? `drill-${drill.index}` : laying ? "laying" : "answer"}>
                {answer.monitor ? (
                  // a live feed of the chain's own moves, read from its RPC as each block is made
                  <QueryMonitor spec={answer.monitor} base={base} />
                ) : drill ? (
                  <div className={cn(CARD, "px-4 py-4 sm:px-5 sm:py-5")}>
                    <DrillView drill={drill} base={rowBase(base, drill.row) ?? base} sym={sym} hoverTx={hoverTx} onHoverTx={setHoverTx} onRows={() => setInspect(true)} />
                  </div>
                ) : laying ? (
                  // one draw: the loader holds the space until the layout is final
                  <div aria-busy="true" className={cn(CARD, "flex min-h-[18rem] flex-1 flex-col")}>
                    <QueryLoader status="Rows are in. Laying out the chart" fill framed={false} />
                  </div>
                ) : charted && visual ? (
                  <QueryVisual
                    visual={drawn ?? visual}
                    rows={allRows}
                    names={names}
                    sym={sym}
                    totals={answer.totals}
                    span={answer.span}
                    base={base}
                    canDrill={canDrill || recordRows}
                    // a mark that is one thing on the chain (a transaction, a
                    // contract, a validator, a block) opens that thing's own page
                    onPick={openRow}
                    hoverKey={hoverKey}
                    onHoverKey={setHoverKey}
                    range={range}
                    onRange={setRange}
                    onZoom={(lo, hi) => void ask(`Only between ${String(lo)} and ${String(hi)} inclusive, same figures, finer buckets if that helps.`, true)}
                    selection={sel}
                    onSelection={setSel}
                    panelAction={pinnable ? (i) => <PinToBoard chain={c.chainSlug!} network={network} answer={answer} panelIndex={i} thread={history.map((t) => t.prompt)} /> : undefined}
                    // the designer's tables: the rows in its columns, each row a door
                    renderTable={(p) => (
                      <PanelRows
                        panel={p}
                        columns={answer.result?.columns ?? []}
                        rows={picked}
                        names={names}
                        visual={visual}
                        base={base}
                        sym={sym}
                        onPick={canDrill || recordRows ? openRow : undefined}
                        onAll={() => setInspect(true)}
                      />
                    )}
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
                            {typeof v === "number" ? fmt(v, f, sym) : (nameFor(names, col.name, v) ?? (isAddress(v) ? truncate(String(v), 6) : String(v ?? "")))}
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
                  <p className={cn(CARD, "px-5 py-10 font-mono text-[12px] text-zinc-500")}>{answer.result ? "The query returned no rows." : NO_QUERY}</p>
                )}
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
                c={c}
                drill={drill}
                designing={designing}
                busy={busy}
                linked={history.length > 0}
                sqlOpen={sqlOpen}
                onSqlOpen={setSqlOpen}
                sqlDraft={sqlDraft}
                onSqlDraft={setSqlDraft}
                onRun={() => void runSql()}
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
