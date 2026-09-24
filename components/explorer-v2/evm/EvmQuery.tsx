"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Area, Bar, Brush, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { Board, SectionHeader, HEAD, ROW, INK, idInk, fnInk } from "@/components/explorer-v2/ui";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import { setSelection, askAbout } from "@/components/explorer-v2/dig/selection";
import type { ChartSpec, DrillAnswer, Names, QueryAnswer, Turn } from "@/lib/explorer-query/types";
import type { ColumnMeta, QueryResult } from "@/lib/explorer-query/clickhouse";

/* Ask the chain a question; get a chart you can audit. The model writes
   one ClickHouse SELECT; the page draws the rows and shows the SQL that
   made them, editable and re-runnable. The server decodes what the rows
   name (selectors to functions, addresses to contracts and tokens), and
   every group opens: click a bar or a row and the records behind it list
   underneath, each a door to its own page. A brush selects a range and
   asks the next question about that alone; the chat bubble can be asked
   about whatever is open. */

const TONES = ["#E6212F", "#0061E2", "#0d9488", "#d97706", "#7c3aed", "#db2777"];

const EXAMPLES = [
  "Most popular methods over the last 7 days",
  "Transactions per hour over the last 3 days, with reverts",
  "Fees burned per day over the last 30 days, in AVAX",
  "Top 15 contracts by gas charged in the last 24 hours",
  "Gas reserved per block against the limit, last 2 hours",
  "USDC transfers per hour over the last 2 days, count and volume",
];

type Row = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* values, names, doors                                                */

const isAddress = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const isHash = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
const isSelector = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{8}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(v);

function fmtNum(v: unknown): string {
  if (typeof v !== "number") return String(v ?? "");
  if (Number.isInteger(v)) return formatNumber(v);
  const a = Math.abs(v);
  return a >= 1000 ? formatNumber(Math.round(v)) : a >= 1 ? v.toFixed(2) : a >= 0.01 ? v.toFixed(4) : v.toPrecision(3);
}

function fmtAxis(v: unknown): string {
  if (typeof v !== "number") return String(v ?? "");
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

type Span = "minutes" | "hours" | "days" | "other";

/** a time label as short as the series allows */
function fmtX(v: unknown, span: Span): string {
  if (isTime(v)) {
    const s = v.replace("T", " ");
    if (span === "days") return s.slice(5, 10);
    if (span === "hours") return s.slice(5, 16);
    return s.slice(11, 16);
  }
  return typeof v === "number" ? formatNumber(v) : String(v ?? "");
}

function spanOf(xs: unknown[]): Span {
  const ts = xs.filter(isTime).map((s) => new Date(s.replace(" ", "T") + (s.length <= 10 ? "T00:00:00Z" : "Z")).getTime());
  if (ts.length < 2) return "other";
  const w = Math.max(...ts) - Math.min(...ts);
  return w <= 3 * 3600e3 ? "minutes" : w <= 3 * 86400e3 ? "hours" : "days";
}

/** the decoded name for a cell, if the server found one */
function nameFor(names: Names, col: string, v: unknown): string | undefined {
  return typeof v === "string" ? names[col]?.[v.toLowerCase()] : undefined;
}

/** a cell as a person reads it: name, short hex, number, or text */
function cellText(names: Names, col: string, v: unknown, span: Span): string {
  const name = nameFor(names, col, v);
  if (name) return name;
  if (isAddress(v) || isHash(v)) return truncate(v, 8);
  if (isSelector(v)) return v;
  if (typeof v === "number") return fmtNum(v);
  if (isTime(v)) return span === "other" ? v.replace("T", " ") : fmtX(v, span);
  return String(v ?? "");
}

/** where a cell leads, if anywhere */
function doorFor(col: string, v: unknown, base: string): string | null {
  const c = col.toLowerCase();
  if (isAddress(v)) return `${base}/address/${v}`;
  if (isHash(v)) return c.includes("block") ? null : `${base}/tx/${v}`;
  if (typeof v === "number" && Number.isInteger(v) && (c === "block_number" || c === "block" || c.endsWith("_block") || c === "number")) return `${base}/block/${v}`;
  return null;
}

/** the drill title with the row's values, named where the server named them */
function fillTitle(template: string, row: Row, names: Names): string {
  return template.replace(/\{\{\s*([A-Za-z_]\w*)\s*(?::(?:bytes|raw))?\s*\}\}/g, (_m, col: string) => {
    const v = row[col];
    if (v === undefined || v === null) return "?";
    return nameFor(names, col, v) ?? (isAddress(v) || isHash(v) ? truncate(v, 6) : String(v));
  });
}

/* ------------------------------------------------------------------ */
/* the rows                                                            */

function RowsTable({
  columns,
  rows,
  names,
  base,
  span,
  dim,
  onPick,
  picked,
  limit = 200,
}: {
  columns: ColumnMeta[];
  rows: Row[];
  names: Names;
  base: string;
  span: Span;
  /** rows outside the brushed range fade */
  dim?: (i: number) => boolean;
  /** rows are groups: clicking one opens its records */
  onPick?: (row: Row, i: number) => void;
  picked?: number | null;
  limit?: number;
}) {
  const grid = { gridTemplateColumns: `repeat(${columns.length}, minmax(7rem, 1fr))` };
  return (
    <div className="overflow-x-auto">
      <div className={cn(HEAD, "grid")} style={grid}>
        {columns.map((col) => (
          <span key={col.name} className="truncate" title={col.type}>
            {col.name}
          </span>
        ))}
      </div>
      {rows.slice(0, limit).map((r, i) => (
        <div
          key={i}
          role={onPick ? "button" : undefined}
          tabIndex={onPick ? 0 : undefined}
          onClick={(e) => {
            if (!onPick || (e.target as HTMLElement).closest("a")) return;
            onPick(r, i);
          }}
          onKeyDown={(e) => {
            if (onPick && e.key === "Enter" && e.target === e.currentTarget) onPick(r, i);
          }}
          className={cn(ROW, "grid", onPick && "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900", picked === i && "bg-zinc-100 dark:bg-zinc-900", dim?.(i) && "opacity-40")}
          style={grid}
        >
          {columns.map((col) => {
            const v = r[col.name];
            const door = doorFor(col.name, v, base);
            const name = nameFor(names, col.name, v);
            const text = cellText(names, col.name, v, span);
            const tone = name ? (isSelector(v) ? fnInk : "text-zinc-900 dark:text-zinc-50") : typeof v === "number" ? "text-zinc-900 dark:text-zinc-50" : isSelector(v) ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400";
            const inner = (
              <>
                <span className="truncate">{text}</span>
                {name && (isAddress(v) || isSelector(v)) && <span className="truncate text-[10px] text-zinc-400 dark:text-zinc-600">{isAddress(v) ? truncate(v, 6) : v}</span>}
              </>
            );
            return door ? (
              <Link key={col.name} href={door} className={cn("flex min-w-0 flex-col font-mono text-[12px] hover:text-[#E6212F]", name ? "text-zinc-900 dark:text-zinc-50" : idInk)} title={String(v)}>
                {inner}
              </Link>
            ) : (
              <span key={col.name} className={cn("flex min-w-0 flex-col font-mono text-[12px] tabular-nums", tone)} title={String(v)}>
                {inner}
              </span>
            );
          })}
        </div>
      ))}
      {rows.length > limit && <p className="px-5 py-3 font-mono text-[11px] text-zinc-400 md:px-6">first {limit} of {formatNumber(rows.length)} rows</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface OpenDrill {
  title: string;
  row: Row;
  index: number;
  answer: DrillAnswer | null;
  error: string | null;
  showSql: boolean;
}

export function EvmQuery({ network }: { network: string }) {
  const c = useChainContext();
  const router = useRouter();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken ?? "AVAX";

  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<QueryAnswer | null>(null);
  const [history, setHistory] = useState<Turn[]>([]);
  const [sqlDraft, setSqlDraft] = useState("");
  const [showSql, setShowSql] = useState(false);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [drill, setDrill] = useState<OpenDrill | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const drillRef = useRef<HTMLDivElement>(null);

  const ask = useCallback(
    async (q: string, refine: boolean) => {
      const text = q.trim();
      if (!text) return;
      setBusy(refine ? "refining" : "asking");
      setError(null);
      setRange(null);
      setDrill(null);
      const hist = refine ? history : [];
      try {
        const res = await fetch("/api/explorer/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chainId: c.chainId, prompt: text, history: hist }),
        });
        const body = (await res.json()) as QueryAnswer & { error?: string };
        if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`);
        setAnswer(body);
        setSqlDraft(body.sql);
        setHistory([...hist, { prompt: text, sql: body.sql, title: body.title }].slice(-6));
        setPrompt("");
        if (!refine) {
          const url = new URL(window.location.href);
          url.searchParams.set("q", text);
          window.history.replaceState(null, "", url.toString());
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "the query failed");
      } finally {
        setBusy(null);
      }
    },
    [c.chainId, history],
  );

  /** the reader edited the SQL: run it as written */
  const runSql = useCallback(async () => {
    setBusy("running");
    setError(null);
    setRange(null);
    setDrill(null);
    try {
      const res = await fetch("/api/explorer/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chainId: c.chainId, sql: sqlDraft }),
      });
      const body = (await res.json()) as { sql: string; result: QueryResult; names: Names; error?: string };
      if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`);
      setAnswer((prev) => {
        const chart: ChartSpec = prev?.chart ?? { kind: "table", series: [] };
        // keep the chart if its columns survived the edit, else fall back to rows
        const cols = new Set(body.result.columns.map((k) => k.name));
        const keep = chart.kind !== "none" && (!chart.x || cols.has(chart.x)) && chart.series.every((s) => cols.has(s.column));
        return {
          title: prev?.title ?? "Your query",
          note: "Edited by hand and re-run.",
          sql: body.sql,
          chart: keep ? chart : { kind: "table", series: [] },
          drill: keep ? (prev?.drill ?? null) : null,
          result: body.result,
          names: body.names ?? {},
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "the query failed");
    } finally {
      setBusy(null);
    }
  }, [c.chainId, sqlDraft]);

  /** one row of the answer, opened into the records behind it */
  const openDrill = useCallback(
    async (row: Row, index: number) => {
      if (!answer?.drill) return;
      const title = fillTitle(answer.drill.title, row, answer.names);
      setDrill({ title, row, index, answer: null, error: null, showSql: false });
      setTimeout(() => drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      try {
        const res = await fetch("/api/explorer/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chainId: c.chainId, drill: { sql: answer.drill.sql, row } }),
        });
        const body = (await res.json()) as DrillAnswer & { error?: string };
        if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`);
        setDrill((d) => (d && d.index === index ? { ...d, answer: body } : d));
        // the chat bubble can be asked about what is open
        const hashCol = body.result.columns.find((k) => k.name.toLowerCase().includes("hash"))?.name;
        setSelection({
          kind: "records",
          title,
          brief: [
            `Open on the Query page: ${title} (${body.result.rowCount} rows, from this SQL):`,
            body.sql,
            "First rows:",
            ...body.result.rows.slice(0, 12).map((r) => "- " + body.result.columns.map((k) => `${k.name}=${String(r[k.name])}`).join(" ")),
          ].join("\n"),
          hrefs: hashCol ? body.result.rows.slice(0, 8).map((r) => `${base}/tx/${String(r[hashCol])}`) : [],
        });
      } catch (e) {
        setDrill((d) => (d && d.index === index ? { ...d, error: e instanceof Error ? e.message : "the records did not load" } : d));
      }
    },
    [answer, c.chainId, base],
  );

  // a shared link: ?q= asks on load
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      setPrompt(q);
      void ask(q, false);
    }
  }, [ask]);
  useEffect(() => () => setSelection(null), []);

  const reset = () => {
    setAnswer(null);
    setHistory([]);
    setError(null);
    setPrompt("");
    setRange(null);
    setDrill(null);
    setSelection(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    window.history.replaceState(null, "", url.toString());
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const rows: Row[] = answer?.result?.rows ?? [];
  const names = answer?.names ?? {};
  const chart = answer?.chart;
  const xKey = chart?.x;
  const span = useMemo(() => (xKey ? spanOf(rows.map((r) => r[xKey])) : "other"), [rows, xKey]);
  const drawable = !!chart && chart.kind !== "table" && chart.kind !== "none" && !!xKey && chart.series.length > 0 && rows.length > 0;
  // the x axis names records (block numbers): clicking a point opens one
  const xDoors = !!xKey && rows.length > 0 && !!doorFor(xKey, rows[0][xKey], base);
  const canDrill = !!answer?.drill;
  const xLabel = (v: unknown) => (xKey ? (nameFor(names, xKey, v) ?? fmtX(v, span)) : "");

  // the brushed range, summed per series; shares and rates average instead
  const picked = range ? rows.slice(range[0], range[1] + 1) : rows;
  const isRatio = (s: { unit?: string; label: string; column: string }) => /%|share|ratio|rate|price|avg|average|median|p\d\d/i.test(`${s.unit ?? ""} ${s.label} ${s.column}`);
  const sums =
    chart?.series.map((s) => {
      const vals = picked.map((r) => r[s.column]).filter((v): v is number => typeof v === "number");
      const total = vals.reduce((acc, v) => acc + v, 0);
      return isRatio(s) && vals.length ? total / vals.length : total;
    }) ?? [];
  const rangeLabel = range && xKey ? `${xLabel(rows[range[0]]?.[xKey])} to ${xLabel(rows[range[1]]?.[xKey])}` : null;

  const onPoint = (row: Row | undefined) => {
    if (!row || !xKey) return;
    if (canDrill) {
      const i = rows.indexOf(row);
      void openDrill(row, i);
      return;
    }
    const door = doorFor(xKey, row[xKey], base);
    if (door) router.push(door);
  };

  return (
    <EvmShell network={network}>
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-4">
          <SectionHeader
            label="Query"
            action={
              answer ? (
                <button type="button" onClick={reset} className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500">
                  New question
                </button>
              ) : undefined
            }
          />
          <Board divide={false} className="flex flex-col gap-4 border px-5 py-5 md:px-6">
            <p className="font-mono text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Ask {c.chainName} a question in plain words. The answer is a chart, the query that made it, and a door into every record it counts.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
                rows={2}
                placeholder={answer ? "Refine: make it daily, only reverted, add fees..." : "Most popular methods over the last 7 days"}
                disabled={!!busy}
                className="min-h-[3.25rem] flex-1 resize-none border border-zinc-200 bg-transparent px-3 py-2 font-mono text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-900 disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100"
              />
              <button
                type="button"
                onClick={() => void ask(prompt, !!answer)}
                disabled={!!busy || !prompt.trim()}
                className="h-[3.25rem] shrink-0 border border-zinc-900 px-5 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-900 transition-colors hover:bg-zinc-900 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-900 dark:border-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
              >
                {busy ? `${busy}…` : answer ? "Refine" : "Ask"}
              </button>
            </div>
            {!answer && !busy && (
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => {
                      setPrompt(ex);
                      void ask(ex, false);
                    }}
                    className="border border-zinc-200 px-2.5 py-1 font-mono text-[11px] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-50"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
            {busy && (
              <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                {busy === "running" ? "Running your query on ClickHouse…" : "Writing the query, testing it, then running it in full. Fifteen to sixty seconds."}
              </p>
            )}
            {error && <p className="border border-[#E6212F]/40 px-3 py-2 font-mono text-[11px] text-[#E6212F]">{error}</p>}
          </Board>
        </section>

        {answer && (
          <section className="flex flex-col gap-4">
            <SectionHeader label={answer.title} />
            <Board divide={false} className="flex flex-col gap-5 border px-5 py-5 md:px-6">
              {answer.note && <p className="font-mono text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-300">{answer.note}</p>}

              {/* the chart */}
              {drawable && chart && xKey && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                    <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
                      {chart.series.map((s, i) => (
                        <span key={s.column} className="flex items-center gap-1.5">
                          <span className="h-2 w-2" style={{ background: TONES[i % TONES.length] }} />
                          {s.label}
                          {s.unit && <span className="text-zinc-400 dark:text-zinc-600">{s.unit}</span>}
                        </span>
                      ))}
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-600">hover reads · {canDrill ? "click opens the records" : xDoors ? "click opens the block" : "drag selects"}</span>
                  </div>
                  <div className="h-72 text-zinc-900 dark:text-zinc-100">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={rows}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                        barCategoryGap="18%"
                        className={xDoors || canDrill ? "cursor-pointer" : undefined}
                        onClick={(s) => onPoint((s as { activePayload?: { payload: Row }[] } | null)?.activePayload?.[0]?.payload)}
                      >
                        <CartesianGrid vertical={false} stroke="rgba(161,161,170,0.18)" />
                        <XAxis dataKey={xKey} tickFormatter={xLabel} tick={{ fontSize: 10, fontFamily: "var(--font-geist-mono)" }} tickLine={false} axisLine={false} minTickGap={28} interval={rows.length <= 16 ? 0 : "preserveEnd"} />
                        <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fontFamily: "var(--font-geist-mono)" }} tickLine={false} axisLine={false} width={52} />
                        <RechartsTooltip
                          cursor={chart.kind === "bar" ? { fill: "rgba(161,161,170,0.10)" } : { stroke: "rgba(161,161,170,0.4)" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null;
                            const r = payload[0].payload as Row;
                            const name = nameFor(names, xKey, r[xKey]);
                            return (
                              <TipPlate>
                                <p className="font-mono text-[10px] text-zinc-500">
                                  {name ?? fmtX(r[xKey], span)}
                                  {name && <span className="ml-2 text-zinc-300 dark:text-zinc-600">{String(r[xKey]).length > 20 ? truncate(String(r[xKey]), 6) : String(r[xKey])}</span>}
                                </p>
                                {chart.series.map((s, i) => (
                                  <p key={s.column} className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                                    <span className="h-1.5 w-1.5" style={{ background: TONES[i % TONES.length] }} />
                                    {fmtNum(r[s.column])} <span className="text-zinc-400">{s.unit ?? s.label}</span>
                                  </p>
                                ))}
                                {(canDrill || xDoors) && <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-300 dark:text-zinc-600">{canDrill ? "click for the records" : "click opens"}</p>}
                              </TipPlate>
                            );
                          }}
                        />
                        {chart.series.map((s, i) => {
                          const tone = TONES[i % TONES.length];
                          if (chart.kind === "bar") return <Bar key={s.column} dataKey={s.column} fill={tone} fillOpacity={0.85} stackId={chart.stacked ? "s" : undefined} isAnimationActive={false} minPointSize={1} />;
                          if (chart.kind === "area") return <Area key={s.column} type="monotone" dataKey={s.column} stroke={tone} fill={tone} fillOpacity={0.18} strokeWidth={1.5} stackId={chart.stacked ? "s" : undefined} isAnimationActive={false} />;
                          return <Line key={s.column} type="monotone" dataKey={s.column} stroke={tone} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />;
                        })}
                        {rows.length > 12 && (
                          <Brush
                            dataKey={xKey}
                            height={22}
                            travellerWidth={8}
                            stroke="#A2AFB2"
                            fill="transparent"
                            tickFormatter={xLabel}
                            onChange={(r) => {
                              const s = r?.startIndex ?? 0;
                              const e = r?.endIndex ?? rows.length - 1;
                              setRange(s === 0 && e === rows.length - 1 ? null : [s, e]);
                            }}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* what the brush picked out */}
                  {range && (
                    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border border-zinc-900 px-3 py-2 font-mono text-[11px] dark:border-zinc-100">
                      <span className="flex flex-wrap items-baseline gap-x-3 tabular-nums text-zinc-900 dark:text-zinc-50">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E6212F]">Selected</span>
                        <span>{range[1] - range[0] + 1} points</span>
                        <span className="text-zinc-500 dark:text-zinc-400">{rangeLabel}</span>
                        {chart.series.map((s, i) => (
                          <span key={s.column} className="text-zinc-500 dark:text-zinc-400">
                            {isRatio(s) ? "avg " : ""}
                            {fmtNum(sums[i])} {s.unit ?? s.label}
                          </span>
                        ))}
                      </span>
                      <span className="flex items-center gap-4 text-[10px] uppercase tracking-[0.14em]">
                        <button
                          type="button"
                          onClick={() => {
                            const lo = rows[range[0]]?.[xKey];
                            const hi = rows[range[1]]?.[xKey];
                            void ask(`Only between ${String(lo)} and ${String(hi)} (inclusive), same figures, finer buckets if that helps.`, true);
                          }}
                          className="text-zinc-600 hover:text-[#E6212F] dark:text-zinc-300"
                        >
                          Zoom in
                        </button>
                        <button type="button" onClick={() => setRange(null)} className="text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-50">
                          Clear
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {answer.chart.kind === "none" && <p className="font-mono text-[12px] text-zinc-500">Nothing to draw for this question.</p>}

              {/* provenance: where the figures came from */}
              {answer.result && (
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-zinc-200 pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                  <span className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                    <span>ClickHouse</span>
                    <span>
                      <span className={INK}>{formatNumber(answer.result.rowCount)}</span> rows{answer.result.truncated ? " (capped)" : ""}
                    </span>
                    <span>{formatNumber(answer.result.rowsRead)} rows read</span>
                    <span>{(answer.result.elapsedMs / 1000).toFixed(2)} s</span>
                    {answer.model && <span>model {(answer.model.ms / 1000).toFixed(0)} s · {answer.model.tries} tr{answer.model.tries === 1 ? "y" : "ies"}</span>}
                    <span>{answer.result.ranAt.slice(11, 19)} UTC</span>
                  </span>
                  <button type="button" onClick={() => setShowSql((v) => !v)} className={cn("transition-colors hover:text-[#E6212F]", showSql && "text-zinc-900 dark:text-zinc-50")}>
                    {showSql ? "Hide SQL" : "Show SQL"}
                  </button>
                </div>
              )}

              {/* the query itself, editable */}
              {showSql && (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={sqlDraft}
                    onChange={(e) => setSqlDraft(e.target.value)}
                    spellCheck={false}
                    rows={Math.min(18, Math.max(6, sqlDraft.split("\n").length + 1))}
                    className="w-full resize-y border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[12px] leading-relaxed text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-100 dark:focus:border-zinc-100"
                  />
                  <div className="flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.14em]">
                    <span className="text-zinc-400 dark:text-zinc-500">One SELECT on raw_blocks, raw_txs, raw_logs, raw_traces. chain_id = {c.chainId}. 2,000 rows at most.</span>
                    <button type="button" onClick={() => void runSql()} disabled={!!busy || sqlDraft.trim() === answer.sql.trim()} className="text-zinc-900 hover:text-[#E6212F] disabled:opacity-40 dark:text-zinc-50">
                      Run edited SQL
                    </button>
                  </div>
                  {answer.drill && (
                    <div className="flex flex-col gap-1 pt-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Drill: the records behind one row</span>
                      <pre className="overflow-x-auto border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">{answer.drill.sql}</pre>
                    </div>
                  )}
                </div>
              )}
            </Board>

            {/* the rows, with doors; groups open into their records */}
            {answer.result && answer.result.columns.length > 0 && (
              <Board>
                {canDrill && (
                  <p className="px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:px-6 dark:text-zinc-500">Click a row to list the transactions behind it</p>
                )}
                <RowsTable
                  columns={answer.result.columns}
                  rows={rows}
                  names={names}
                  base={base}
                  span={span}
                  dim={range ? (i) => i < range[0] || i > range[1] : undefined}
                  onPick={canDrill ? (row, i) => void openDrill(row, i) : undefined}
                  picked={drill?.index ?? null}
                />
              </Board>
            )}

            {/* the records behind the picked row */}
            {drill && (
              <div ref={drillRef} className="flex flex-col gap-4 scroll-mt-24">
                <SectionHeader
                  label={drill.title}
                  action={
                    <span className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.14em]">
                      {drill.answer && (
                        <button type="button" onClick={() => askAbout(`Explain these records: ${drill.title}.`)} className="text-zinc-600 transition-colors hover:text-[#E6212F] dark:text-zinc-300">
                          Ask about these
                        </button>
                      )}
                      {drill.answer && (
                        <button type="button" onClick={() => setDrill((d) => (d ? { ...d, showSql: !d.showSql } : d))} className="text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-50">
                          {drill.showSql ? "Hide SQL" : "SQL"}
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
                  }
                />
                <Board divide={false} className="border-l-2 border-l-[#E6212F]">
                  {!drill.answer && !drill.error && <p className="px-5 py-4 font-mono text-[11px] text-zinc-400 md:px-6">Loading the records…</p>}
                  {drill.error && <p className="px-5 py-4 font-mono text-[11px] text-[#E6212F] md:px-6">{drill.error}</p>}
                  {drill.answer && (
                    <>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 md:px-6 dark:text-zinc-500">
                        <span>
                          <span className={INK}>{formatNumber(drill.answer.result.rowCount)}</span> records{drill.answer.result.rowCount >= 100 ? " (first 100)" : ""}
                        </span>
                        <span>{(drill.answer.result.elapsedMs / 1000).toFixed(2)} s</span>
                        <span>every hash, block and address is a door</span>
                      </div>
                      {drill.showSql && <pre className="overflow-x-auto border-y border-zinc-200 bg-zinc-50 px-5 py-3 font-mono text-[11px] leading-relaxed text-zinc-600 md:px-6 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">{drill.answer.sql}</pre>}
                      <RowsTable columns={drill.answer.result.columns} rows={drill.answer.result.rows} names={drill.answer.names} base={base} span="other" limit={100} />
                    </>
                  )}
                </Board>
              </div>
            )}
          </section>
        )}

        {history.length > 1 && (
          <section className="flex flex-col gap-3">
            <SectionHeader label="This thread" />
            <ol className="flex flex-col gap-1.5 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
              {history.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-5 shrink-0 text-right text-zinc-300 dark:text-zinc-700">{i + 1}</span>
                  <span className="min-w-0 truncate">{t.prompt}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-300 dark:text-zinc-600">Prototype. Figures come from the indexer's raw tables, not from the node. Check anything that matters against the chain. {sym} figures divide wei by 1e18.</p>
      </div>
    </EvmShell>
  );
}
