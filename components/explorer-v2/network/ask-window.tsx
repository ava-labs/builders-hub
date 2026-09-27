"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, Check, ChevronRight, ChevronsUpDown, Copy, Rows3, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import { AvalancheLoader } from "@/components/explorer-v2/evm/AvalancheLoader";
import { CARD, QueryVisual, fmt, nameFor } from "@/components/explorer-v2/evm/QueryVisual";
import { PanelRows, fillTitle, formatOf, header, isAddress, isTxList, rowDoor, type Row } from "@/components/explorer-v2/evm/QueryRows";
import { QueryInspector, RowsBody } from "@/components/explorer-v2/evm/QueryInspector";
import { Crumbs, DrillView, ZoomStage, type OpenDrill } from "@/components/explorer-v2/evm/QueryZoom";
import { QueryError, SQL_CAVEAT, postQuery, progress, reads, streamQuery } from "@/components/explorer-v2/evm/query-client";
import { askChainsOf, queryHref, routeFor, scopeOf, sentOf, towerOfRow, towersOf, type AskChain, type AskThread } from "@/components/explorer-v2/network/ask-route";
import { rememberQuestion } from "@/lib/explorer-query/recent";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import type { QueryEvent } from "@/lib/explorer-query/answer";
import type { DrillAnswer, QueryAnswer, Turn } from "@/lib/explorer-query/types";
import type { VisualSpec } from "@/lib/explorer-query/visual";
import type { Node } from "@/components/explorer-v2/network/icm-map";

/* A question asked in the city, answered in a window over it. The city's
   search sends a question here instead of to the Query page, so a reader
   can stay in the city: the window asks the chain the question names, else
   the P-Chain for a question about validators, staking, L1s or subnets
   (about the L1 picked in the city, when one is), else the chain picked,
   else the C-Chain, and it says which one it asked. The answer draws as the Query page draws it, from the Query
   page's own parts: its figures, its chart, its rows, and the SQL a click
   away. A follow-up refines it, and Open in Query takes the thread to the
   full page. The thread rides the city's URL (?ask= the question, one
   &then= per follow-up, &on= the chain), so a reload or a link opens the
   answer again.
   The city answers too: the towers the answer's rows name (by EVM chain
   ID, subnet ID or blockchain ID) light and the rest recede, the tower of
   the bar or row under the pointer lights as a hover does, and a mark that
   names a chain opens it in the city. */

// the city's wiring reads the routes through the window
export { askChainsOf, queryHref, routeFor };
export type { AskChain, AskThread };

/** the window's width: two fifths of the screen, between 460 and 640 pixels, in steps of 20 */
export function useAskWidth(): number {
  const of = () => (typeof window === "undefined" ? 560 : Math.round(Math.min(640, Math.max(460, window.innerWidth * 0.4)) / 20) * 20);
  const [w, setW] = useState(of);
  useEffect(() => {
    const on = () => setW(of());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

/* a chain's mark at the switch's size, its initial when it has none */
function Mark({ uri, name }: { uri: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!uri || broken)
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 font-mono text-[8px] font-bold uppercase text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
        {name.charAt(0)}
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={uri} alt="" onError={() => setBroken(true)} className="h-4 w-4 shrink-0 rounded-full bg-white object-contain ring-1 ring-zinc-200 dark:ring-zinc-800" />;
}

export function AskWindow({
  thread,
  chains,
  picked = null,
  nodes = [],
  onThread,
  onClose,
  onLit,
  onHover,
  onOpen,
}: {
  /** what to ask when the window opens; a link's follow-ups are asked after it, in order */
  thread: AskThread;
  chains: AskChain[];
  /** the chain picked in the city, by slug: the switch offers it */
  picked?: string | null;
  /** the thread as the reader grows it (a follow-up, another chain), for the URL */
  onThread: (t: AskThread) => void;
  onClose: () => void;
  /** the city's towers, which the answer's rows may name */
  nodes?: Node[];
  /** the towers the answer's rows name; null when they name none */
  onLit?: (ids: Set<string> | null) => void;
  /** the tower of the bar or row under the pointer */
  onHover?: (id: string | null) => void;
  /** a mark or row that names a chain opens its tower in the city */
  onOpen?: (id: string) => void;
}) {
  const router = useRouter();
  const { openLoginModal } = useLoginModalTrigger();
  const chainOf = (slug: string) => chains.find((x) => x.slug === slug) ?? chains[0];
  const [on, setOnState] = useState<AskChain>(() => chainOf(thread.on));
  const onRef = useRef(on);
  const setOn = (c: AskChain) => {
    onRef.current = c;
    setOnState(c);
  };
  // the window's own thread: the URL keeps every follow-up, the engine reads the last few turns
  const [asked, setAskedState] = useState<AskThread>(() => ({ ...thread, on: chainOf(thread.on).slug }));
  const askedRef = useRef(asked);
  // mounted: a question still on its way when the window shuts must not move the URL
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const setAsked = (t: AskThread) => {
    askedRef.current = t;
    setAskedState(t);
    if (live.current) onThread(t);
  };

  const [phase, setPhase] = useState<"idle" | "query">("idle");
  // what the engine has done so far on this question
  const [events, setEvents] = useState<QueryEvent[]>([]);
  const [started, setStarted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // the anonymous limit was hit: the error offers sign-in, which lifts it
  const [gated, setGated] = useState(false);
  const [answer, setAnswer] = useState<QueryAnswer | null>(null);
  const [history, setHistory] = useState<Turn[]>([]);
  const [designing, setDesigning] = useState(false);
  // a kept answer's reading, being written again
  const [reading, setReading] = useState(false);
  const [drill, setDrill] = useState<OpenDrill | null>(null);
  const [inspect, setInspect] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prompt, setPrompt] = useState("");
  // the chain the question was first put to, when the engine said its data lives on the other one
  const [routedFrom, setRoutedFrom] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<unknown>(undefined);
  const [hoverRow, setHoverRow] = useState<Row | null>(null);
  const [hoverTx, setHoverTx] = useState<string | null>(null);
  const [, tick] = useState(0);
  const token = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // the elapsed clock while a question runs
  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [started]);

  /** the second stage: lay out rows the window already shows */
  const design = async (c: AskChain, question: string, a: QueryAnswer) => {
    if (!a.result || a.result.rows.length === 0) return;
    const my = ++token.current;
    setDesigning(true);
    try {
      const out = await postQuery<{ visual: VisualSpec; designer: boolean; ms: number }>({
        chainId: c.chainId,
        // a kept answer is laid out by the server from its own SQL
        ...(a.key ? { key: a.key } : { design: { question, title: a.title, note: a.note, columns: a.result.columns, rows: a.result.rows, names: a.names, chart: a.chart } }),
      });
      if (my !== token.current) return;
      setAnswer((prev) => (prev && prev.sql === a.sql ? { ...prev, visual: out.visual, draftVisual: false, model: { ...(prev.model ?? { steps: 0, ms: 0, tries: 0 }), designMs: out.ms, designer: out.designer } } : prev));
    } catch {
      // the designer failed: draw the basic layout rather than wait forever
      if (my === token.current) setAnswer((prev) => (prev && prev.sql === a.sql ? { ...prev, draftVisual: false } : prev));
    } finally {
      if (my === token.current) setDesigning(false);
    }
  };

  /** a kept layout's sentences, written again from the rows just fetched */
  const reread = async (c: AskChain, a: QueryAnswer) => {
    const my = token.current;
    setReading(true);
    try {
      const out = await postQuery<{ callouts: string[] }>({ chainId: c.chainId, key: a.key, reading: true });
      if (my !== token.current) return;
      setAnswer((prev) => (prev && prev.sql === a.sql && prev.visual ? { ...prev, visual: { ...prev.visual, callouts: out.callouts } } : prev));
    } catch {
      /* the chart stands without its reading */
    } finally {
      if (my === token.current) setReading(false);
    }
  };

  /* one question on one chain, or a follow-up on the answer in view (hist
     is the thread so far). Resolves to the thread with this turn, or null
     when it stopped. */
  const ask = async (c: AskChain, q: string, hist: Turn[], scope: AskChain | null = null): Promise<Turn[] | null> => {
    const text = q.trim();
    if (!text) return null;
    const my = ++token.current;
    setOn(c);
    setEvents([]);
    setPhase("query");
    setStarted(Date.now());
    setError(null);
    setGated(false);
    setReading(false);
    setDesigning(false);
    setDrill(null);
    setInspect(false);
    setSqlOpen(false);
    // the pointer's row belongs to the answer that is going
    setHoverKey(undefined);
    setHoverRow(null);
    scroller.current?.scrollTo({ top: 0 });
    try {
      // a first P-Chain question about an L1 carries its subnet, out of sight
      const sent = hist.length === 0 && c.kind === "pchain" ? sentOf(text, scope) : text;
      const a = await streamQuery({ chainId: c.chainId, prompt: sent, history: hist }, (e) => {
        if (my === token.current) setEvents((prev) => [...prev, e]);
      });
      if (my !== token.current || !live.current) return null;
      // the engine says the data lives on the other chain: the question is asked there, as the Query page does
      if (a.route && a.route !== c.slug && hist.length === 0) {
        const there = chains.find((x) => x.slug === a.route);
        if (there) {
          setRoutedFrom(c.label);
          const keep = there.kind === "pchain" ? scope : null;
          setAsked({ ...askedRef.current, on: there.slug, for: keep?.slug ?? null });
          return ask(there, text, [], keep);
        }
      }
      const next = [...hist, { prompt: sent, sql: a.sql, title: a.title }].slice(-6);
      setAnswer(a);
      setHistory(next);
      setPhase("idle");
      setStarted(null);
      if (hist.length === 0) rememberQuestion(c.slug, text);
      if (a.draftVisual) void design(c, text, a);
      else if (a.model?.cached && a.key && a.result?.rowCount) void reread(c, a);
      return next;
    } catch (e) {
      if (my !== token.current) return null;
      setError(e instanceof Error ? e.message : "The query failed.");
      setGated(e instanceof QueryError && e.signIn);
      setPhase("idle");
      setStarted(null);
      return null;
    }
  };

  // the thread is asked once, when the window opens: the question, then each follow-up on the answer before it
  const opened = useRef(false);
  const askRef = useRef(ask);
  askRef.current = ask;
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void (async () => {
      let h = await askRef.current(chainOf(thread.on), thread.q, [], scopeOf(thread, chains));
      for (const t of thread.then) {
        if (!h) return;
        h = await askRef.current(onRef.current, t, h);
      }
    })();
    // once, when the window opens; a new question opens a new window
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** the switch: the question again on another chain; its follow-ups were written for this one */
  const switchTo = (c: AskChain, scope: AskChain | null = null) => {
    const q = askedRef.current.q;
    setRoutedFrom(null);
    setAnswer(null);
    setHistory([]);
    setAsked({ q, then: [], on: c.slug, for: scope?.slug ?? null });
    void ask(c, q, [], scope);
  };

  /** the box at the foot: a follow-up on the answer, or the question again after it failed */
  const submit = () => {
    const text = prompt.trim();
    if (!text || phase !== "idle") return;
    const first = !answer;
    void ask(onRef.current, text, first ? [] : history, first ? scopeOf(askedRef.current, chains) : null).then((h) => {
      if (!h) return;
      setPrompt("");
      const t = askedRef.current;
      setAsked(first ? { q: text, then: [], on: onRef.current.slug, for: t.for ?? null } : { ...t, on: onRef.current.slug, then: [...t.then, text] });
    });
  };

  const busy = phase !== "idle";
  // the L1 the P-Chain question was for, when it was
  const scope = scopeOf(asked, chains);
  const base = `/explorer/mainnet/${on.slug}`;
  const sym = on.symbol || "AVAX";
  const allRows: Row[] = answer?.result?.rows ?? [];
  const columns = answer?.result?.columns ?? [];
  const names = answer?.names ?? {};
  const visual = answer?.visual ?? null;
  const canDrill = !!answer?.drill;
  const recordRows = !!answer?.result && isTxList(columns);
  const charted = !!visual && visual.panels.some((p) => p.kind !== "table");
  // the basic layout is never drawn while the real one is on its way
  const laying = designing || (!!answer?.draftVisual && !!answer.result?.rowCount);
  const elapsed = started ? Math.floor((Date.now() - started) / 1000) : 0;
  const drilled = drill?.answer?.result ?? null;
  // what the rows sheet lists: the drilled records, else the answer's rows
  const level = drill
    ? { title: drill.title, columns: drilled?.columns ?? [], rows: drilled?.rows ?? [], names: drill.answer?.names ?? {}, visual: null }
    : { title: answer?.title ?? "", columns, rows: allRows, names, visual };

  /* the city answers: the towers the rows name light, and the pointer's tower lights as a hover */
  const towers = useMemo(() => towersOf(nodes), [nodes]);
  const xs = useMemo(() => [...new Set((visual?.panels ?? []).flatMap((p) => (p.x ? [p.x] : [])))], [visual]);
  const lit = useMemo(() => {
    const s = new Set<string>();
    for (const r of answer?.result?.rows ?? []) {
      const t = towerOfRow(towers, r, xs[0]);
      if (t) s.add(t);
    }
    return s.size ? s : null;
  }, [answer?.result, towers, xs]);
  const hoverTower = useMemo(() => {
    if (hoverRow) return towerOfRow(towers, hoverRow, xs[0]);
    if (hoverKey === undefined || !lit) return null;
    const x = xs.find((k) => allRows.some((r) => r[k] === hoverKey));
    const r = x ? allRows.find((row) => row[x] === hoverKey) : undefined;
    return r ? towerOfRow(towers, r, x) : null;
  }, [hoverRow, hoverKey, lit, xs, allRows, towers]);
  // the city hears when the set or the pointer's tower changes, not on every render of the page
  const tell = useRef({ onLit, onHover });
  tell.current = { onLit, onHover };
  useEffect(() => {
    tell.current.onLit?.(lit);
  }, [lit]);
  useEffect(() => {
    tell.current.onHover?.(hoverTower);
  }, [hoverTower]);
  // rows that name towers open them; the window's rows can then open what they name
  const opens = canDrill || recordRows || !!lit;

  /** one mark or row, opened into the records behind it, in the chart's place */
  const openDrill = async (row: Row, index: number) => {
    if (!answer?.drill) return;
    if (drill) {
      // one level down at a time: the same mark again goes back up
      if (drill.index === index) setDrill(null);
      return;
    }
    const title = fillTitle(answer.drill.title, row, answer.names);
    setDrill({ title, row, index, answer: null, error: null, prev: [] });
    try {
      const out = await postQuery<DrillAnswer>({ chainId: on.chainId, drill: { sql: answer.drill.sql, row } });
      setDrill((d) => (d && d.index === index ? { ...d, answer: out } : d));
    } catch (e) {
      setDrill((d) => (d && d.index === index ? { ...d, error: e instanceof Error ? e.message : "The transactions did not load." } : d));
    }
  };
  /** a row opens what it is about, as on the Query page: its transaction, the thing its axis names, the chain it names in the city, else its records */
  const openRow = (r: Row) => {
    const door = rowDoor(r, columns, visual, base);
    if (door) return router.push(door);
    const tower = onOpen ? towerOfRow(towers, r, xs[0]) : null;
    if (tower) return onOpen!(tower);
    const i = allRows.indexOf(r);
    if (i >= 0) void openDrill(r, i);
  };

  // the switch: the C-Chain, the P-Chain, the P-Chain about the L1 in view, and that L1
  const l1 = scope ?? chains.find((c) => c.slug === picked && c.subnetId) ?? (on.subnetId ? on : null);
  const options: { c: AskChain; scope: AskChain | null }[] = [
    { c: chainOf("c-chain"), scope: null },
    { c: chainOf("p-chain"), scope: null },
    ...(l1 ? [{ c: chainOf("p-chain"), scope: l1 }] : []),
    ...[on.slug, picked].flatMap((s) => (s && s !== "c-chain" && s !== "p-chain" ? chains.filter((c) => c.slug === s).map((c) => ({ c, scope: null })) : [])),
  ].filter((x, i, all) => all.findIndex((y) => y.c.slug === x.c.slug && y.scope?.slug === x.scope?.slug) === i);
  const quiet = "flex items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50";
  const turns = [asked.q, ...asked.then];
  // one question the title already says needs no line of its own
  const said = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const echoed = !busy && !error && !!answer && turns.length === 1 && said(answer.title) === said(asked.q);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* a div, not a <header>: the site styles header elements for its navbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200/70 py-2 pl-4 pr-2.5 dark:border-zinc-800/70">
        <DropdownMenu>
          <DropdownMenuTrigger
            title="The chain this question was asked of"
            className="group flex min-w-0 items-center gap-2 rounded-lg py-1 pr-1.5 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 outline-none transition-colors hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-[#0061E2]/40 dark:text-zinc-500 dark:hover:text-zinc-100"
          >
            <span className="shrink-0">Asked of</span>
            <Mark uri={on.logo} name={on.label} />
            <span className="min-w-0 truncate">
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{on.label}</span>
              {scope && ` · for ${scope.label}`}
            </span>
            <ChevronsUpDown className="h-3 w-3 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56" onEscapeKeyDown={(e) => e.stopPropagation()}>
            {options.map((x) => {
              const current = x.c.slug === on.slug && (x.scope?.slug ?? null) === (scope?.slug ?? null);
              return (
                <DropdownMenuItem key={`${x.c.slug}:${x.scope?.slug ?? ""}`} onSelect={() => !current && switchTo(x.c, x.scope)} className="gap-3">
                  <Mark uri={x.c.logo} name={x.c.label} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {x.c.label}
                    {x.scope && <span className="font-normal text-zinc-500 dark:text-zinc-400"> · for {x.scope.label}</span>}
                  </span>
                  {current && <span aria-label="Asked of this chain" className="h-1.5 w-1.5 shrink-0 bg-[#E6212F]" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="flex-1" />
        <Link
          href={queryHref(asked, chains)}
          className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-[#E6212F] dark:text-zinc-400"
        >
          Open in Query
          <ArrowUpRight className="h-3 w-3" />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the answer"
          title="Close the answer (Esc)"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-3.5">
        {/* the thread: the question and each follow-up that refined it */}
        <p className={cn("flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500", echoed && "hidden")}>
          {turns.map((t, i) => (
            <span key={i} className="flex items-baseline gap-2">
              {i > 0 && <span className="text-zinc-300 dark:text-zinc-700">/</span>}
              <span className={cn(i === turns.length - 1 && "text-zinc-700 dark:text-zinc-200")}>{t}</span>
            </span>
          ))}
        </p>

        {busy && (
          <div className="mt-3">
            <AvalancheLoader status={`${progress(events)} · ${elapsed} s`} height={200} />
          </div>
        )}
        {error && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-2 border-[#E6212F] pl-3">
            <p className="font-mono text-[12px] text-[#E6212F]">{error.charAt(0).toUpperCase() + error.slice(1)}</p>
            {gated && (
              <button
                type="button"
                onClick={() => openLoginModal()}
                className="border border-zinc-900 bg-zinc-900 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Sign in
              </button>
            )}
            {/* an ask that failed on its way goes again: the question, or the follow-up still in the box */}
            {!gated && !/not indexed/i.test(error) && (!answer || !!prompt.trim()) && (
              <button type="button" onClick={() => (answer ? submit() : void ask(on, asked.q, [], scope))} className="font-mono text-[11px] text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-[#E6212F] dark:text-zinc-50 dark:decoration-zinc-700">
                Try again
              </button>
            )}
            {!gated && /not indexed/i.test(error) && on.slug !== "c-chain" && (
              <button type="button" onClick={() => switchTo(chainOf("c-chain"))} className="font-mono text-[11px] text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-[#E6212F] dark:text-zinc-50 dark:decoration-zinc-700">
                Ask the C-Chain instead
              </button>
            )}
          </div>
        )}

        {answer && (
          <section className={cn("flex flex-col gap-4 transition-opacity duration-300", !echoed && "mt-3", busy && "opacity-40")}>
            <div className="flex flex-col gap-1.5">
              {routedFrom && <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">This data lives on the {on.label}, so it is answered there.</span>}
              <h2 className="text-[18px] font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">{answer.title}</h2>
              {!laying && reading && (
                <span aria-busy="true" aria-label="Writing the reading" className="flex flex-col gap-1.5 pt-1">
                  {[92, 64].map((w) => (
                    <span key={w} className="h-3 animate-pulse rounded-sm bg-zinc-200/80 dark:bg-zinc-800" style={{ width: `${w}%` }} />
                  ))}
                </span>
              )}
              {!laying && !reading && visual && visual.callouts.length > 0 ? (
                <p className="text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">{reads(visual.callouts)}</p>
              ) : (
                !reading && answer.note && <p className="text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">{answer.note}</p>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-2.5">
              <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                {drill ? (
                  <Crumbs items={[{ label: answer.title, onClick: () => setDrill(null) }, { label: drill.title }]} />
                ) : (
                  <span className="min-w-0 truncate font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                    {charted && opens ? (lit && onOpen ? "Open a mark to find it in the city." : "Open a mark to see what it names.") : ""}
                  </span>
                )}
                {level.rows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setInspect(true)}
                    aria-haspopup="dialog"
                    className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 font-mono text-[11px] tabular-nums text-zinc-700 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  >
                    <Rows3 className="h-3.5 w-3.5" />
                    Rows ({formatNumber(level.rows.length)})
                  </button>
                )}
              </div>

              <ZoomStage level={drill ? `drill-${drill.index}` : laying ? "laying" : "answer"}>
                {drill ? (
                  <div className={cn(CARD, "overflow-hidden px-5 py-5")}>
                    <DrillView drill={drill} base={base} sym={sym} hoverTx={hoverTx} onHoverTx={setHoverTx} onRows={() => setInspect(true)} />
                  </div>
                ) : laying ? (
                  // one draw: the loader holds the space until the layout is final
                  <div aria-busy="true" className={cn(CARD, "flex min-h-[16rem] flex-1 flex-col")}>
                    <AvalancheLoader status="Rows are in. Laying out the chart" fill framed={false} />
                  </div>
                ) : charted && visual ? (
                  <QueryVisual
                    visual={visual}
                    rows={allRows}
                    names={names}
                    sym={sym}
                    canDrill={opens}
                    // a mark that is one thing on the chain opens that thing's own page, and a chain its tower
                    onPick={openRow}
                    hoverKey={hoverKey}
                    onHoverKey={setHoverKey}
                    stack
                    renderTable={(p) => (
                      <PanelRows
                        panel={p}
                        columns={columns}
                        rows={allRows}
                        names={names}
                        visual={visual}
                        base={base}
                        sym={sym}
                        onPick={opens ? openRow : undefined}
                        onAll={() => setInspect(true)}
                        onHover={lit ? setHoverRow : undefined}
                        limit={8}
                      />
                    )}
                  />
                ) : allRows.length === 1 ? (
                  // one row is a set of figures: each column on its own card
                  <div className="grid grid-cols-2 gap-3">
                    {columns.map((col) => {
                      const v = allRows[0][col.name];
                      const f = formatOf(col.name, visual);
                      return (
                        <div key={col.name} className={cn(CARD, "flex min-w-0 flex-col gap-2 px-4 py-4")}>
                          <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{header(col.name)}</span>
                          <span className="truncate font-mono text-[21px] leading-none tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                            {typeof v === "number" ? fmt(v, /pct|percent|ratio/i.test(col.name) && f === "number" ? "percent" : f, sym) : (nameFor(names, col.name, v) ?? (isAddress(v) ? truncate(String(v), 6) : String(v ?? "")))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : allRows.length ? (
                  // no chart to index the rows: the rows, by their shape, are the view
                  <div className={cn(CARD, "px-2 py-3")}>
                    <RowsBody columns={columns} rows={allRows} names={names} visual={visual} base={base} sym={sym} onOpen={canDrill || lit ? openRow : undefined} onHover={lit ? setHoverRow : undefined} />
                  </div>
                ) : (
                  <p className={cn(CARD, "px-5 py-10 font-mono text-[12px] text-zinc-500")}>The query returned no rows.</p>
                )}
              </ZoomStage>
            </div>

            {/* where the figures came from: the SQL, a click away */}
            <div className="flex flex-col gap-2">
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px]">
                <button type="button" onClick={() => setSqlOpen((v) => !v)} aria-expanded={sqlOpen} className="flex items-center gap-1 text-zinc-900 transition-colors hover:text-[#E6212F] dark:text-zinc-50">
                  <ChevronRight className={cn("h-3 w-3 transition-transform duration-200 motion-reduce:transition-none", sqlOpen && "rotate-90")} />
                  {sqlOpen ? "Hide SQL" : "SQL"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard?.writeText(answer.sql).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1400);
                    })
                  }
                  className={quiet}
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy
                </button>
                {answer.result && (
                  <span className="tabular-nums text-zinc-400 dark:text-zinc-500">
                    {formatNumber(answer.result.rowCount)} row{answer.result.rowCount === 1 ? "" : "s"} · {formatNumber(answer.result.rowsRead)} scanned in {(answer.result.elapsedMs / 1000).toFixed(2)} s
                  </span>
                )}
              </span>
              {sqlOpen && (
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-zinc-50 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-zinc-800 ring-1 ring-zinc-200/70 dark:bg-zinc-900/50 dark:text-zinc-200 dark:ring-zinc-800">
                  {answer.sql}
                </pre>
              )}
              <p className="font-mono text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">{SQL_CAVEAT}</p>
            </div>
          </section>
        )}
      </div>

      {/* the follow-up: it refines the answer in view */}
      <div className="shrink-0 border-t border-zinc-200/70 p-3 dark:border-zinc-800/70">
        <div className="flex items-end gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-100">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              } else if (e.key === "Escape") {
                // the box lets go first; the next Escape shuts the window
                e.stopPropagation();
                e.currentTarget.blur();
              }
            }}
            rows={1}
            disabled={busy}
            aria-label={answer ? "Refine this answer" : `Ask ${on.label}`}
            placeholder={answer ? (on.kind === "pchain" ? "Refine this answer: only L1s, per week" : "Refine this answer: only reverted, per hour") : `Ask ${on.label} a question`}
            className="max-h-32 min-h-[1.75rem] flex-1 resize-none bg-transparent py-1 font-mono text-[12.5px] leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-60 dark:text-zinc-50 dark:placeholder:text-zinc-600"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !prompt.trim()}
            aria-label={answer ? "Refine" : "Ask"}
            className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-opacity disabled:opacity-25 dark:bg-zinc-100 dark:text-zinc-900"
          >
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {/* the rows sheet, as the Query page opens it; on the body, since the window's glass would hold a fixed sheet inside it */}
      {answer &&
        typeof document !== "undefined" &&
        createPortal(
          <QueryInspector
            open={inspect}
            onClose={() => setInspect(false)}
            title={level.title}
            sub={drill ? drill.title : undefined}
            columns={level.columns}
            rows={level.rows}
            total={level.rows.length}
            names={level.names}
            visual={level.visual}
            base={base}
            sym={sym}
            sql={drill ? drill.answer?.sql : answer.sql}
            hint="Esc closes"
            onOpen={
              !drill && (lit || (canDrill && !recordRows))
                ? (r) => {
                    setInspect(false);
                    openRow(r);
                  }
                : undefined
            }
          />,
          document.body,
        )}
    </div>
  );
}
