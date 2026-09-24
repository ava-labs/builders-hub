"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowUpRight, Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { Board, CellLabel, HEAD, ROW, RowDoor, idInk, fnInk } from "@/components/explorer-v2/ui";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import { RailRow } from "./EvmTx";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import { setSelection, askAbout } from "@/components/explorer-v2/dig/selection";
import type { ChartSpec, DrillAnswer, Names, QueryAnswer, Turn } from "@/lib/explorer-query/types";
import type { ColumnMeta, QueryResult } from "@/lib/explorer-query/clickhouse";
import type { Format, VisualSpec } from "@/lib/explorer-query/visual";
import { QueryVisual, fmt, fmtX, nameFor, spanOf } from "./QueryVisual";

/* A question about the chain, answered as a sheet in the explorer's
   own grammar. The query stage returns rows first and the page draws
   them at once; the layout stage then arranges them (headline figures,
   panels, a short reading). Beside the answer, the rail says where the
   figures came from: the table, the window the database holds, what was
   scanned, and the SQL. Any group opens into its transactions, drawn as
   the explorer draws transactions everywhere else. */

const EXAMPLES: { group: string; hue: string; items: { q: string; hint: string }[] }[] = [
  {
    group: "Activity",
    hue: "#E6212F",
    items: [
      { q: "Transactions per 5 minutes, with reverts", hint: "Throughput and failure, bucketed" },
      { q: "Busiest senders in the last hour", hint: "Who is sending the most" },
    ],
  },
  {
    group: "Gas and fees",
    hue: "#d97706",
    items: [
      { q: "Fees burned per 5 minutes", hint: "AVAX removed from supply" },
      { q: "Gas reserved per block against the limit", hint: "How full blocks run" },
    ],
  },
  {
    group: "Contracts",
    hue: "#0061E2",
    items: [
      { q: "Most called methods", hint: "Decoded, with reverts and callers" },
      { q: "Top contracts by gas charged", hint: "Who the chain works for" },
    ],
  },
  {
    group: "Tokens",
    hue: "#0d9488",
    items: [
      { q: "USDC transfers per 5 minutes, count and volume", hint: "Stablecoin flow" },
      { q: "Largest USDT transfers in the last hour", hint: "Size, sender, receiver" },
    ],
  },
];

/* the suggested questions: frosted cards over a soft wash of each
   category's hue, a row you swipe on a phone and a grid on a desk */
function Suggestions({ onAsk }: { onAsk: (q: string) => void }) {
  const cards = EXAMPLES.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group, hue: g.hue })));
  return (
    <div className="relative isolate -mx-5 overflow-hidden px-5 py-6 sm:mx-0 sm:rounded-3xl sm:px-6">
      {/* the wash the glass sits on */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-zinc-50 dark:bg-zinc-950" />
      <div aria-hidden className="absolute -left-16 -top-20 -z-10 h-72 w-72 rounded-full bg-[#E6212F]/25 blur-3xl dark:bg-[#E6212F]/20" />
      <div aria-hidden className="absolute left-1/3 top-10 -z-10 h-64 w-64 rounded-full bg-[#d97706]/20 blur-3xl dark:bg-[#d97706]/15" />
      <div aria-hidden className="absolute -bottom-24 right-1/4 -z-10 h-80 w-80 rounded-full bg-[#0061E2]/25 blur-3xl dark:bg-[#0061E2]/20" />
      <div aria-hidden className="absolute -right-16 -top-10 -z-10 h-64 w-64 rounded-full bg-[#0d9488]/25 blur-3xl dark:bg-[#0d9488]/20" />

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        {cards.map((c) => (
          <button
            key={c.q}
            type="button"
            onClick={() => onAsk(c.q)}
            className="group relative flex min-h-[9.5rem] w-[15.5rem] shrink-0 snap-start flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-white/60 bg-white/55 p-4 text-left shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_24px_-12px_rgba(24,24,27,0.25)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/75 hover:shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_16px_32px_-14px_rgba(24,24,27,0.35)] sm:w-auto dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)] dark:hover:bg-white/[0.1]"
          >
            {/* the card's own tint, strongest in the corner */}
            <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-50 blur-2xl transition-opacity group-hover:opacity-80" style={{ background: c.hue }} />
            <span className="relative flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: c.hue }} />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-300">{c.group}</span>
            </span>
            <span className="relative flex flex-col gap-1.5">
              <span className="text-[16px] font-medium leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">{c.q}</span>
              <span className="flex items-center justify-between gap-3 text-[12.5px] text-zinc-500 dark:text-zinc-400">
                {c.hint}
                <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:group-hover:text-zinc-50" />
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

type Row = Record<string, unknown>;
type Span = ReturnType<typeof spanOf>;

/* ------------------------------------------------------------------ */
/* columns as people read them                                         */

const HEADERS: Record<string, string> = {
  t: "Time",
  method_id: "Method",
  txs: "Txs",
  share_pct: "Share",
  unique_senders: "Callers",
  senders: "Callers",
  reverted: "Reverted",
  fees_avax: "Fees",
  fee_avax: "Fee",
  gas_charged: "Gas charged",
  gas_reserved: "Gas reserved",
  gas_limit: "Gas limit",
  address: "Address",
  to_address: "To",
  from_address: "From",
  tx_hash: "Hash",
  block_number: "Block",
  status: "Status",
};

const header = (col: string) => HEADERS[col] ?? col.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** the unit a column is in: the layout's word first, then its name */
function formatOf(col: string, visual: VisualSpec | null): Format {
  const fromVisual = visual?.panels.flatMap((p) => p.series).find((s) => s.column === col)?.format ?? visual?.stats.find((s) => s.column === col)?.format;
  if (fromVisual) return fromVisual;
  if (/pct|share|percent|rate/.test(col)) return "percent";
  if (/avax|fee/.test(col)) return "avax";
  if (/gas/.test(col)) return "gas";
  return "number";
}

const isAddress = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const isHash = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
const isSelector = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{8}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(v);

function doorFor(col: string, v: unknown, base: string): string | null {
  const c = col.toLowerCase();
  if (isAddress(v)) return `${base}/address/${v}`;
  if (isHash(v)) return c.includes("block") ? null : `${base}/tx/${v}`;
  if (typeof v === "number" && Number.isInteger(v) && (c === "block_number" || c === "block" || c.endsWith("_block"))) return `${base}/block/${v}`;
  return null;
}

function fillTitle(template: string, row: Row, names: Names): string {
  return template.replace(/\{\{\s*([A-Za-z_]\w*)\s*(?::(?:bytes|raw))?\s*\}\}/g, (_m, col: string) => {
    const v = row[col];
    if (v === undefined || v === null) return "?";
    return nameFor(names, col, v) ?? (isAddress(v) || isHash(v) ? truncate(v, 6) : String(v));
  });
}

const toUnix = (s: string) => Math.floor(new Date(s.replace(" ", "T") + (s.length <= 10 ? "T00:00:00Z" : "Z")).getTime() / 1000);

function duration(secs: number): string {
  if (secs < 90) return `${Math.round(secs)} s`;
  if (secs < 5400) return `${Math.round(secs / 60)} min`;
  if (secs < 172800) return `${(secs / 3600).toFixed(1)} h`;
  return `${Math.round(secs / 86400)} days`;
}

function ago(unix: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - unix);
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
}

/* ------------------------------------------------------------------ */
/* the result rows                                                     */

function ResultTable({
  columns,
  rows,
  names,
  visual,
  base,
  sym,
  span,
  onPick,
  picked,
  dim,
}: {
  columns: ColumnMeta[];
  rows: Row[];
  names: Names;
  visual: VisualSpec | null;
  base: string;
  sym: string;
  span: Span;
  onPick?: (row: Row, i: number) => void;
  picked: number | null;
  dim?: (i: number) => boolean;
}) {
  const numeric = new Set(columns.filter((c) => /Int|Float|Decimal/.test(c.type)).map((c) => c.name));
  const tpl = columns.map((c) => (numeric.has(c.name) ? "8.5rem" : "minmax(9rem,1fr)")).join(" ");
  return (
    <div className="overflow-x-auto">
      <div className="min-w-max md:min-w-0">
        <div className={cn(HEAD, "grid")} style={{ gridTemplateColumns: tpl }}>
          {columns.map((c) => (
            <span key={c.name} className={cn("truncate", numeric.has(c.name) && "text-right")} title={`${c.name} · ${c.type}`}>
              {header(c.name)}
            </span>
          ))}
        </div>
        {rows.slice(0, 200).map((r, i) => (
          <div
            key={i}
            role={onPick ? "button" : undefined}
            tabIndex={onPick ? 0 : undefined}
            onClick={(e) => {
              if (onPick && !(e.target as HTMLElement).closest("a")) onPick(r, i);
            }}
            onKeyDown={(e) => {
              if (onPick && e.key === "Enter" && e.target === e.currentTarget) onPick(r, i);
            }}
            className={cn(ROW, "grid items-baseline", onPick && "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900", picked === i && "bg-zinc-100 dark:bg-zinc-900", dim?.(i) && "opacity-40")}
            style={{ gridTemplateColumns: tpl }}
          >
            {columns.map((c) => {
              const v = r[c.name];
              const name = nameFor(names, c.name, v);
              const door = doorFor(c.name, v, base);
              if (numeric.has(c.name)) {
                const f = formatOf(c.name, visual);
                return (
                  <span key={c.name} className="text-right font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-50">
                    {typeof v === "number" ? fmt(v, f, sym) : String(v ?? "")}
                  </span>
                );
              }
              const main = name ?? (isAddress(v) || isHash(v) ? truncate(v, 8) : isSelector(v) ? v.toLowerCase() : isTime(v) ? fmtX(v, span === "other" ? "hours" : span) : String(v ?? ""));
              const cls = cn("min-w-0 truncate font-mono text-[12px]", name && isSelector(v) ? fnInk : name ? "text-zinc-900 dark:text-zinc-50" : isSelector(v) ? "text-zinc-400 dark:text-zinc-500" : door ? idInk : "text-zinc-600 dark:text-zinc-300");
              const body = (
                <>
                  {main}
                  {name && (isAddress(v) || isSelector(v)) && <span className="ml-2 text-[10px] text-zinc-400 dark:text-zinc-600">{isAddress(v) ? truncate(v, 4) : String(v).toLowerCase()}</span>}
                </>
              );
              return door ? (
                <Link key={c.name} href={door} title={String(v)} className={cn(cls, "hover:text-[#E6212F]")}>
                  {body}
                </Link>
              ) : (
                <span key={c.name} title={String(v)} className={cls}>
                  {body}
                </span>
              );
            })}
          </div>
        ))}
        {rows.length > 200 && <p className="px-5 py-3 font-mono text-[11px] text-zinc-400 md:px-6">First 200 of {formatNumber(rows.length)} rows.</p>}
      </div>
    </div>
  );
}

/* transactions, drawn as the explorer draws them everywhere else */
const TX_COLS = "md:grid-cols-[0.75rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.8fr)_6.5rem_6.5rem_minmax(0,7rem)_3rem]";

function TxLedger({ rows, names, base, sym }: { rows: Row[]; names: Names; base: string; sym: string }) {
  const who = (col: string, v: unknown) => nameFor(names, col, v) ?? (isAddress(v) ? truncate(v, 6) : "");
  return (
    <div className="overflow-x-auto">
      <div className="divide-y divide-zinc-200 md:min-w-[56rem] lg:min-w-0 dark:divide-zinc-800">
        <div className={cn(HEAD, "grid-cols-[0.75rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.8fr)_6.5rem_6.5rem_minmax(0,7rem)_3rem]")}>
          <span />
          <span>Hash</span>
          <span>Method</span>
          <span>From → To</span>
          <span className="text-right">Block</span>
          <span className="text-right">Gas charged</span>
          <span className="text-right">Fee</span>
          <span className="text-right">Age</span>
        </div>
        {rows.map((r) => {
          const hash = String(r.tx_hash);
          const m = r.method_id;
          const mName = nameFor(names, "method_id", m);
          const failed = r.status === 0 || r.status === "0";
          return (
            <RowDoor key={hash} href={`${base}/tx/${hash}`} className={cn(ROW, TX_COLS)}>
              <span className="flex h-3 w-3 items-center justify-center">{failed && <X className="h-3 w-3 text-[#E6212F]" strokeWidth={2.5} aria-label="reverted" />}</span>
              <span className={cn("min-w-0 truncate font-mono text-[12.5px]", idInk)}>{truncate(hash, 6)}</span>
              <span className="min-w-0">
                <CellLabel>Method</CellLabel>
                <span className={cn("block truncate font-mono text-[12px]", mName ? fnInk : "text-zinc-400 dark:text-zinc-500")} title={String(m ?? "")}>
                  {mName ?? (m && m !== "0x" ? String(m).toLowerCase() : "transfer")}
                </span>
              </span>
              <span className="col-span-2 flex min-w-0 items-center gap-1.5 font-mono text-[12px] text-zinc-500 md:col-span-1 dark:text-zinc-400">
                <CellLabel>From → To</CellLabel>
                <Link href={`${base}/address/${String(r.from_address)}`} className="truncate hover:text-[#E6212F]" title={String(r.from_address)}>
                  {who("from_address", r.from_address)}
                </Link>
                <span className="shrink-0 text-zinc-300 dark:text-zinc-700">→</span>
                <Link href={`${base}/address/${String(r.to_address)}`} className="truncate hover:text-[#E6212F]" title={String(r.to_address)}>
                  {who("to_address", r.to_address)}
                </Link>
              </span>
              <Link href={`${base}/block/${String(r.block_number)}`} className={cn("font-mono text-[12px] tabular-nums hover:text-[#E6212F] md:text-right", idInk)}>
                <CellLabel>Block</CellLabel>
                {typeof r.block_number === "number" ? formatNumber(r.block_number) : String(r.block_number ?? "")}
              </Link>
              <span className="font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Gas charged</CellLabel>
                {typeof r.gas_charged === "number" ? formatNumber(r.gas_charged) : ""}
              </span>
              <span className="font-mono text-[12px] tabular-nums text-zinc-900 md:text-right dark:text-zinc-50">
                <CellLabel>Fee</CellLabel>
                {typeof r.fee_avax === "number" ? fmt(r.fee_avax, "avax", sym) : ""}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-400 md:text-right dark:text-zinc-500">{isTime(r.t) ? ago(toUnix(r.t)) : ""}</span>
            </RowDoor>
          );
        })}
      </div>
    </div>
  );
}

const isTxList = (cols: ColumnMeta[]) => ["tx_hash", "from_address", "to_address"].every((k) => cols.some((c) => c.name === k));

/* ------------------------------------------------------------------ */

interface OpenDrill {
  title: string;
  row: Row;
  index: number;
  answer: DrillAnswer | null;
  error: string | null;
}

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

export function EvmQuery({ network }: { network: string }) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken ?? "AVAX";

  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"idle" | "query" | "running">("idle");
  const [designing, setDesigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<QueryAnswer | null>(null);
  const [history, setHistory] = useState<Turn[]>([]);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [sqlDraft, setSqlDraft] = useState("");
  const [range, setRange] = useState<[number, number] | null>(null);
  const [drill, setDrill] = useState<OpenDrill | null>(null);
  const [started, setStarted] = useState<number | null>(null);
  const [, tick] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const drillRef = useRef<HTMLDivElement>(null);
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

  /** the second stage: arrange rows the page already shows */
  const design = useCallback(
    async (question: string, a: QueryAnswer) => {
      if (!a.result || a.result.rows.length === 0) return;
      const my = ++token.current;
      setDesigning(true);
      try {
        const out = await post<{ visual: VisualSpec; designer: boolean; ms: number }>({
          design: { question, title: a.title, note: a.note, columns: a.result.columns, rows: a.result.rows, names: a.names, chart: a.chart },
        });
        if (my !== token.current) return;
        setAnswer((prev) => (prev && prev.sql === a.sql ? { ...prev, visual: out.visual, model: { ...(prev.model ?? { steps: 0, ms: 0, tries: 0 }), designMs: out.ms, designer: out.designer } } : prev));
      } catch {
        /* the rows stay; the sheet shows them as a table */
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
      token.current++;
      setPhase("query");
      setStarted(Date.now());
      setError(null);
      setRange(null);
      setDrill(null);
      setDesigning(false);
      setSqlOpen(false);
      const hist = refine ? history : [];
      try {
        const a = await post<QueryAnswer>({ prompt: text, history: hist, skipDesign: true });
        setAnswer(a);
        setSqlDraft(a.sql);
        setHistory([...hist, { prompt: text, sql: a.sql, title: a.title }].slice(-6));
        setPrompt("");
        const url = new URL(window.location.href);
        if (!refine) url.searchParams.set("q", text);
        window.history.replaceState(null, "", url.toString());
        setPhase("idle");
        setStarted(null);
        void design(text, a);
      } catch (e) {
        setError(e instanceof Error ? e.message : "The query failed.");
        setPhase("idle");
        setStarted(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c.chainId, history, design],
  );

  /** the reader's own SQL, run through the same guard */
  const runSql = useCallback(async () => {
    setPhase("running");
    setError(null);
    setRange(null);
    setDrill(null);
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
      if (drill?.index === index) {
        setDrill(null);
        setSelection(null);
        return;
      }
      const title = fillTitle(answer.drill.title, row, answer.names);
      setDrill({ title, row, index, answer: null, error: null });
      setTimeout(() => drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      try {
        const out = await post<DrillAnswer>({ drill: { sql: answer.drill.sql, row } });
        setDrill((d) => (d && d.index === index ? { ...d, answer: out } : d));
        setSelection({
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
    [answer, drill, c.chainId, base],
  );

  // a shared link asks on load
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) void ask(q, false);
  }, [ask]);
  useEffect(() => () => setSelection(null), []);

  const reset = () => {
    token.current++;
    setAnswer(null);
    setHistory([]);
    setError(null);
    setPrompt("");
    setRange(null);
    setDrill(null);
    setDesigning(false);
    setSelection(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    window.history.replaceState(null, "", url.toString());
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const rows: Row[] = answer?.result?.rows ?? [];
  const names = answer?.names ?? {};
  const visual = answer?.visual ?? null;
  const canDrill = !!answer?.drill;
  const charted = !!visual && visual.panels.some((p) => p.kind !== "table");
  const firstX = visual?.panels.find((p) => p.x)?.x ?? answer?.chart.x;
  const span = useMemo(() => (firstX ? spanOf(rows.map((r) => r[firstX])) : "other"), [rows, firstX]);
  const tables = answer?.sql ? [...new Set([...answer.sql.matchAll(/\b(?:FROM|JOIN)\s+(raw_\w+)/gi)].map((m) => m[1]))] : [];
  const cov = answer?.coverage;
  const covSecs = cov ? toUnix(cov.until) - toUnix(cov.since) : 0;
  const busy = phase !== "idle";
  const elapsed = started ? Math.floor((Date.now() - started) / 1000) : 0;
  const shareUrl = typeof window !== "undefined" && history[0] ? `${window.location.origin}${window.location.pathname}?q=${encodeURIComponent(history[0].prompt)}` : "";

  const input = (
    <div className="flex items-end gap-2 rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 shadow-[0_8px_24px_-16px_rgba(24,24,27,0.3)] transition-colors focus-within:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-within:border-zinc-100">
      <textarea
        ref={inputRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void ask(prompt, !!answer);
          }
        }}
        rows={1}
        autoFocus={!answer}
        disabled={busy}
        placeholder={answer ? "Refine this answer: only reverted, per hour, add fees" : `Ask ${c.chainName} about its transactions, gas, contracts or tokens`}
        className="max-h-40 min-h-[1.75rem] flex-1 resize-none bg-transparent py-1 font-mono text-[13px] leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-60 dark:text-zinc-50 dark:placeholder:text-zinc-600"
      />
      <button
        type="button"
        onClick={() => void ask(prompt, !!answer)}
        disabled={busy || !prompt.trim()}
        aria-label={answer ? "Refine" : "Ask"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-opacity disabled:opacity-25 dark:bg-zinc-100 dark:text-zinc-900"
      >
        <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );

  return (
    <EvmShell network={network}>
      <div className="flex flex-col gap-8">
        {/* the question */}
        <section className="flex flex-col gap-3">
          {answer && history.length > 0 && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 font-mono text-[11px]">
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-zinc-400 dark:text-zinc-500">
                {history.map((t, i) => (
                  <span key={i} className="flex items-baseline gap-2">
                    {i > 0 && <span className="text-zinc-300 dark:text-zinc-700">/</span>}
                    <span className={cn(i === history.length - 1 && "text-zinc-700 dark:text-zinc-200")}>{t.prompt}</span>
                  </span>
                ))}
              </span>
              <button type="button" onClick={reset} className="shrink-0 uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500">
                New question
              </button>
            </div>
          )}
          {input}
          {busy && (
            <p className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
              {phase === "running" ? "Running your SQL" : "Writing and testing the SQL"} · {elapsed} s
            </p>
          )}
          {error && <p className="border-l-2 border-[#E6212F] pl-3 font-mono text-[12px] text-[#E6212F]">{error}</p>}
          {!answer && !busy && (
            <div className="pt-3">
              <Suggestions onAsk={(q) => void ask(q, false)} />
            </div>
          )}
        </section>

        {answer && (
          <>
            {/* the sheet: the answer on the left, where it came from on the right */}
            <section className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <h1 className="font-mono text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">{answer.title}</h1>
                {answer.note && <p className="max-w-3xl text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">{answer.note}</p>}
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
                <Board divide={false} className="flex min-w-0 flex-col gap-6 border px-5 py-5 md:px-6">
                  {charted && visual ? (
                    <QueryVisual
                      visual={visual}
                      rows={rows}
                      names={names}
                      sym={sym}
                      canDrill={canDrill}
                      onPick={(r) => {
                        const i = rows.indexOf(r);
                        if (i >= 0) void openDrill(r, i);
                      }}
                      range={range}
                      onRange={setRange}
                      onZoom={(lo, hi) => void ask(`Only between ${String(lo)} and ${String(hi)} inclusive, same figures, finer buckets if that helps.`, true)}
                      selected={drill && firstX ? drill.row[firstX] : undefined}
                    />
                  ) : designing ? (
                    <div className="flex flex-col gap-5" aria-busy="true">
                      <div className="grid grid-cols-2 gap-px bg-zinc-200 sm:grid-cols-4 dark:bg-zinc-800">
                        {[0, 1, 2, 3].map((k) => (
                          <div key={k} className="flex flex-col gap-2 bg-white px-5 py-4 dark:bg-zinc-950">
                            <span className="h-2 w-16 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                            <span className="h-5 w-24 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col gap-2">
                        {[92, 74, 61, 48, 40, 33, 27].map((w) => (
                          <span key={w} className="h-4 animate-pulse bg-zinc-100 dark:bg-zinc-900" style={{ width: `${w}%` }} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="font-mono text-[12px] text-zinc-500">{rows.length ? "The rows are below." : "The query returned no rows."}</p>
                  )}

                  {visual && visual.callouts.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Reading</span>
                      <ul className="flex flex-col gap-1.5">
                        {visual.callouts.map((k, i) => (
                          <li key={i} className="text-[13.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                            {k}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Board>

                {/* provenance */}
                <Board divide={false} className="flex flex-col self-start border">
                  <RailRow label="Source" sub="Indexed ClickHouse tables, read-only">
                    {tables.length ? tables.join(", ") : "none"}
                  </RailRow>
                  {cov && (
                    <RailRow
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
                        </>
                      }
                    >
                      {duration(covSecs)}
                    </RailRow>
                  )}
                  {answer.result && (
                    <RailRow label="Result" sub={`${formatNumber(answer.result.rowsRead)} rows scanned in ${(answer.result.elapsedMs / 1000).toFixed(2)} s`}>
                      {formatNumber(answer.result.rowCount)} row{answer.result.rowCount === 1 ? "" : "s"}
                      {answer.result.truncated ? " (capped)" : ""}
                    </RailRow>
                  )}
                  <div className="flex flex-col gap-2.5 px-5 py-3.5">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Query</span>
                    <span className="flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px]">
                      <button type="button" onClick={() => setSqlOpen((v) => !v)} className="text-zinc-900 transition-colors hover:text-[#E6212F] dark:text-zinc-50">
                        {sqlOpen ? "Hide SQL" : "Edit SQL"}
                      </button>
                      <button type="button" onClick={() => copy("sql", answer.sql)} className="flex items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
                        {copied === "sql" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} SQL
                      </button>
                      {shareUrl && (
                        <button type="button" onClick={() => copy("link", shareUrl)} className="flex items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
                          {copied === "link" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Link
                        </button>
                      )}
                    </span>
                    <span className="font-mono text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                      Sonnet 5 wrote it in {Math.round((answer.model?.ms ?? 0) / 1000)} s
                      {answer.model?.tries ? `, ${answer.model.tries} test run${answer.model.tries === 1 ? "" : "s"}` : ""}.
                      {designing ? " Opus 5.5 is laying it out." : answer.model?.designMs ? ` Opus 5.5 laid it out in ${Math.round(answer.model.designMs / 1000)} s.` : ""}
                    </span>
                  </div>
                </Board>
              </div>

              {sqlOpen && (
                <Board divide={false} className="flex flex-col gap-3 border px-5 py-4 md:px-6">
                  <textarea
                    value={sqlDraft}
                    onChange={(e) => setSqlDraft(e.target.value)}
                    spellCheck={false}
                    rows={Math.min(18, Math.max(5, sqlDraft.split("\n").length + 1))}
                    className="w-full resize-y bg-zinc-50 px-3 py-2 font-mono text-[12px] leading-relaxed text-zinc-900 outline-none dark:bg-zinc-900/50 dark:text-zinc-100"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
                    <span className="text-zinc-400 dark:text-zinc-500">
                      One SELECT over raw_blocks, raw_txs, raw_logs or raw_traces, with chain_id = {c.chainId}. At most 2,000 rows.
                    </span>
                    <button type="button" onClick={() => void runSql()} disabled={busy || sqlDraft.trim() === answer.sql.trim()} className="bg-zinc-900 px-3 py-1.5 uppercase tracking-[0.14em] text-white disabled:opacity-25 dark:bg-zinc-100 dark:text-zinc-900">
                      Run
                    </button>
                  </div>
                  {answer.drill && (
                    <details className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      <summary className="cursor-pointer select-none">How a group opens into its transactions</summary>
                      <pre className="mt-2 overflow-x-auto bg-zinc-50 px-3 py-2 leading-relaxed dark:bg-zinc-900/50">{answer.drill.sql}</pre>
                    </details>
                  )}
                </Board>
              )}
            </section>

            {/* the rows */}
            {answer.result && answer.result.columns.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">Rows · {formatNumber(rows.length)}</span>
                  {canDrill && <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Select a row or a bar to list its transactions.</span>}
                </div>
                <Board>
                  {isTxList(answer.result.columns) ? (
                    <TxLedger rows={rows} names={names} base={base} sym={sym} />
                  ) : (
                    <ResultTable
                      columns={answer.result.columns}
                      rows={rows}
                      names={names}
                      visual={visual}
                      base={base}
                      sym={sym}
                      span={span}
                      onPick={canDrill ? (r, i) => void openDrill(r, i) : undefined}
                      picked={drill?.index ?? null}
                      dim={range ? (i) => i < range[0] || i > range[1] : undefined}
                    />
                  )}
                </Board>
              </section>
            )}

            {/* the transactions behind one group */}
            {drill && (
              <section ref={drillRef} className="flex scroll-mt-24 flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
                    {drill.title}
                    {drill.answer && <span className="text-zinc-400 dark:text-zinc-500"> · {formatNumber(drill.answer.result.rowCount)}</span>}
                  </span>
                  <span className="flex items-center gap-4 font-mono text-[11px]">
                    {drill.answer && (
                      <button type="button" onClick={() => askAbout(`Explain these transactions: ${drill.title}.`)} className="text-zinc-600 transition-colors hover:text-[#E6212F] dark:text-zinc-300">
                        Ask the assistant
                      </button>
                    )}
                    {drill.answer && (
                      <button type="button" onClick={() => copy("drill", drill.answer!.sql)} className="flex items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
                        {copied === "drill" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} SQL
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDrill(null);
                        setSelection(null);
                      }}
                      className="text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-50"
                    >
                      Close
                    </button>
                  </span>
                </div>
                <Board>
                  {!drill.answer && !drill.error && (
                    <div className="flex flex-col gap-2 px-5 py-4 md:px-6">
                      {[0, 1, 2, 3].map((k) => (
                        <span key={k} className="h-4 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                      ))}
                    </div>
                  )}
                  {drill.error && <p className="px-5 py-4 font-mono text-[12px] text-[#E6212F] md:px-6">{drill.error}</p>}
                  {drill.answer &&
                    (drill.answer.result.rowCount === 0 ? (
                      <p className="px-5 py-4 font-mono text-[12px] text-zinc-400 md:px-6">No transactions matched.</p>
                    ) : isTxList(drill.answer.result.columns) ? (
                      <TxLedger rows={drill.answer.result.rows} names={drill.answer.names} base={base} sym={sym} />
                    ) : (
                      <ResultTable columns={drill.answer.result.columns} rows={drill.answer.result.rows} names={drill.answer.names} visual={null} base={base} sym={sym} span="other" picked={null} />
                    ))}
                </Board>
              </section>
            )}
          </>
        )}
      </div>
    </EvmShell>
  );
}
