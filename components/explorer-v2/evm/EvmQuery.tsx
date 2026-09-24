"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip as RechartsTooltip, XAxis, YAxis, ZAxis } from "recharts";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { ArrowUp, ArrowUpRight, Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { Board, CellLabel, HEAD, ROW, RowDoor, idInk, fnInk } from "@/components/explorer-v2/ui";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import { RailRow } from "./EvmTx";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import { setSelection, askAbout } from "@/components/explorer-v2/dig/selection";
import type { ChartSpec, DrillAnswer, Names, QueryAnswer, Turn } from "@/lib/explorer-query/types";
import type { QueryEvent } from "@/lib/explorer-query/answer";
import type { ColumnMeta, QueryResult } from "@/lib/explorer-query/clickhouse";
import type { Format, VisualSpec } from "@/lib/explorer-query/visual";
import { QueryVisual, fmt, fmtX, nameFor, spanOf } from "./QueryVisual";
import { AvalancheLoader } from "./AvalancheLoader";
import { EXAMPLES } from "@/lib/explorer-query/examples";

/* A question about the chain, answered as a sheet in the explorer's
   own grammar. The query stage returns rows first and the page draws
   them at once; the layout stage then arranges them (headline figures,
   panels, a short reading). Beside the answer, the rail says where the
   figures came from: the table, the window the database holds, what was
   scanned, and the SQL. Any group opens into its transactions, drawn as
   the explorer draws transactions everywhere else. */


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
  lead,
  hoverKey,
  onHoverKey,
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
  /** the chart's x column and first series: each row shows its own bar */
  lead?: { x: string; col: string; max: number } | null;
  hoverKey?: unknown;
  onHoverKey?: (k: unknown) => void;
}) {
  const numeric = new Set(columns.filter((c) => /Int|Float|Decimal/.test(c.type)).map((c) => c.name));
  const tpl = (lead ? "4.5rem " : "") + columns.map((c) => (numeric.has(c.name) ? "8.5rem" : "minmax(9rem,1fr)")).join(" ");
  return (
    <div className="overflow-x-auto">
      <div className="min-w-max md:min-w-0">
        <div className={cn(HEAD, "grid")} style={{ gridTemplateColumns: tpl }}>
          {lead && <span title="this row's bar on the chart">Chart</span>}
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
            onMouseEnter={() => lead && onHoverKey?.(r[lead.x])}
            onMouseLeave={() => lead && onHoverKey?.(undefined)}
            className={cn(
              ROW,
              "grid items-center",
              onPick && "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900",
              picked === i && "bg-zinc-100 dark:bg-zinc-900",
              lead && hoverKey !== undefined && r[lead.x] === hoverKey && "bg-zinc-50 dark:bg-zinc-900",
              dim?.(i) && "opacity-40",
            )}
            style={{ gridTemplateColumns: tpl }}
          >
            {lead && (
              <span className="flex h-3 items-center" aria-hidden>
                <span
                  className={cn("block h-2 transition-colors", picked === i || (hoverKey !== undefined && r[lead.x] === hoverKey) ? "bg-zinc-900 dark:bg-zinc-50" : "bg-zinc-300 dark:bg-zinc-700")}
                  style={{ width: `${Math.max(4, (lead.max > 0 && typeof r[lead.col] === "number" ? (r[lead.col] as number) / lead.max : 0) * 100)}%` }}
                />
              </span>
            )}
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

/* transactions, drawn as the explorer draws them everywhere else. The
   columns follow what the query returned: the standard ones where they
   exist, then whatever else it carried (an amount, a value, a token),
   so the figure the question was about is never dropped. */
const LEDGER_KNOWN = new Set(["t", "tx_hash", "method_id", "from_address", "to_address", "block_number", "gas_charged", "fee_avax", "status"]);

function TxLedger({
  columns,
  rows,
  names,
  visual,
  base,
  sym,
  hoverTx,
  onHoverTx,
}: {
  columns: ColumnMeta[];
  rows: Row[];
  names: Names;
  visual: VisualSpec | null;
  base: string;
  sym: string;
  hoverTx?: string | null;
  onHoverTx?: (h: string | null) => void;
}) {
  const has = new Set(columns.map((c) => c.name));
  const extras = columns.filter((c) => !LEDGER_KNOWN.has(c.name));
  const numericExtra = (c: ColumnMeta) => /Int|Float|Decimal/.test(c.type);
  const cols: { key: string; head: string; width: string; right?: boolean }[] = [
    { key: "status", head: "", width: "0.75rem" },
    { key: "tx_hash", head: "Hash", width: "minmax(0,1.1fr)" },
    ...(has.has("method_id") ? [{ key: "method_id", head: "Method", width: "minmax(0,1fr)" }] : []),
    { key: "from_to", head: "From → To", width: "minmax(0,1.7fr)" },
    ...extras.map((c) => ({ key: c.name, head: header(c.name), width: numericExtra(c) ? "8.5rem" : "minmax(0,1fr)", right: numericExtra(c) })),
    ...(has.has("block_number") ? [{ key: "block_number", head: "Block", width: "6.5rem", right: true }] : []),
    ...(has.has("gas_charged") ? [{ key: "gas_charged", head: "Gas charged", width: "6.5rem", right: true }] : []),
    // fee = gas charged x price per gas: show the price so a row can be checked
    ...(has.has("fee_avax") && has.has("gas_charged") ? [{ key: "__price", head: "nAVAX / gas", width: "6.5rem", right: true }] : []),
    ...(has.has("fee_avax") ? [{ key: "fee_avax", head: "Fee", width: "minmax(0,7rem)", right: true }] : []),
    ...(has.has("t") ? [{ key: "t", head: "Time (UTC)", width: "5rem", right: true }] : []),
  ];
  const tpl = { gridTemplateColumns: cols.map((c) => c.width).join(" ") };
  // price per gas in nAVAX, and the list's median to spot tips far above it
  const priceOf = (r: Row) => (typeof r.fee_avax === "number" && typeof r.gas_charged === "number" && r.gas_charged > 0 ? (r.fee_avax / r.gas_charged) * 1e9 : null);
  const prices = rows.map(priceOf).filter((v): v is number => v !== null).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : null;
  const who = (col: string, v: unknown) => nameFor(names, col, v) ?? (isAddress(v) ? truncate(v, 6) : "");

  const cell = (key: string, r: Row) => {
    const v = r[key];
    switch (key) {
      case "status":
        return <span className="flex h-3 w-3 items-center justify-center">{(v === 0 || v === "0") && <X className="h-3 w-3 text-[#E6212F]" strokeWidth={2.5} aria-label="reverted" />}</span>;
      case "tx_hash":
        return <span className={cn("min-w-0 truncate font-mono text-[12.5px]", idInk)}>{truncate(String(v), 6)}</span>;
      case "method_id": {
        const mName = nameFor(names, "method_id", v);
        return (
          <span className={cn("block min-w-0 truncate font-mono text-[12px]", mName ? fnInk : "text-zinc-400 dark:text-zinc-500")} title={String(v ?? "")}>
            {mName ?? (v && v !== "0x" ? String(v).toLowerCase() : "transfer")}
          </span>
        );
      }
      case "from_to":
        return (
          <span className="flex min-w-0 items-center gap-1.5 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
            <Link href={`${base}/address/${String(r.from_address)}`} className="truncate hover:text-[#E6212F]" title={String(r.from_address)}>
              {who("from_address", r.from_address)}
            </Link>
            <span className="shrink-0 text-zinc-300 dark:text-zinc-700">→</span>
            <Link href={`${base}/address/${String(r.to_address)}`} className="truncate hover:text-[#E6212F]" title={String(r.to_address)}>
              {who("to_address", r.to_address)}
            </Link>
          </span>
        );
      case "block_number":
        return (
          <Link href={`${base}/block/${String(v)}`} className={cn("text-right font-mono text-[12px] tabular-nums hover:text-[#E6212F]", idInk)}>
            {typeof v === "number" ? formatNumber(v) : String(v ?? "")}
          </Link>
        );
      case "gas_charged":
        return <span className="text-right font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">{typeof v === "number" ? formatNumber(v) : ""}</span>;
      case "__price": {
        const p = priceOf(r);
        if (p === null) return <span />;
        const over = median !== null && median > 0 && p > median * 20;
        return (
          <span
            className={cn("text-right font-mono text-[12px] tabular-nums", over ? "text-amber-600 dark:text-amber-400" : "text-zinc-500 dark:text-zinc-400")}
            title={over ? `${Math.round(p / median!)}x the list's median price: a priority tip far above the base fee` : "effective price per gas, fee / gas charged"}
          >
            {p >= 100 ? formatNumber(Math.round(p)) : p >= 1 ? p.toFixed(2) : p.toFixed(3)}
          </span>
        );
      }
      case "fee_avax":
        return <span className="text-right font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-50">{typeof v === "number" ? fmt(v, "avax", sym) : ""}</span>;
      case "t":
        return (
          <span className="text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400" title={isTime(v) ? `${ago(toUnix(v))} ago` : undefined}>
            {isTime(v) ? v.replace("T", " ").slice(11, 19) : ""}
          </span>
        );
      default: {
        // the query's own figures: an amount in a token, a value, a label
        const name = nameFor(names, key, v);
        if (typeof v === "number") return <span className="text-right font-mono text-[12.5px] tabular-nums text-zinc-900 dark:text-zinc-50">{fmt(v, formatOf(key, visual), sym)}</span>;
        if (isAddress(v))
          return (
            <Link href={`${base}/address/${v}`} className={cn("min-w-0 truncate font-mono text-[12px] hover:text-[#E6212F]", name ? "text-zinc-900 dark:text-zinc-50" : idInk)} title={v}>
              {name ?? truncate(v, 6)}
            </Link>
          );
        return <span className="min-w-0 truncate font-mono text-[12px] text-zinc-600 dark:text-zinc-300">{name ?? String(v ?? "")}</span>;
      }
    }
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[48rem] divide-y divide-zinc-200 dark:divide-zinc-800">
        <div className={cn(HEAD, "grid")} style={tpl}>
          {cols.map((c) => (
            <span key={c.key} className={cn("truncate", c.right && "text-right")}>
              {c.head}
            </span>
          ))}
        </div>
        {rows.map((r, i) => {
          const hash = String(r.tx_hash);
          return (
            <RowDoor
              key={`${hash}-${i}`}
              id={`rec-${hash}`}
              href={`${base}/tx/${hash}`}
              onMouseEnter={() => onHoverTx?.(hash)}
              onMouseLeave={() => onHoverTx?.(null)}
              style={tpl}
              className={cn(ROW, "grid items-center", hoverTx === hash && "bg-zinc-50 dark:bg-zinc-900")}
            >
              {cols.map((c) => (
                <span key={c.key} className={cn("min-w-0", c.right && "text-right")}>
                  {cell(c.key, r)}
                </span>
              ))}
            </RowDoor>
          );
        })}
      </div>
    </div>
  );
}

/* the records themselves, as a chart: one dot per transaction, placed
   by when it landed and what it cost, red where it reverted. Hover a dot
   and its row lights; click it and the transaction opens. */
function RecordPlot({
  rows,
  names,
  base,
  sym,
  hoverTx,
  onHoverTx,
}: {
  rows: Row[];
  names: Names;
  base: string;
  sym: string;
  hoverTx: string | null;
  onHoverTx: (h: string | null) => void;
}) {
  const router = useRouter();
  // plot the figure that actually varies: a run of calls all charged the
  // half-limit floor is a flat line in gas and still spreads in fee
  const spread = (k: string) => new Set(rows.map((r) => r[k]).filter((v) => typeof v === "number")).size;
  // the query's own figure (an amount) first, then gas, then fee
  const own = Object.keys(rows[0] ?? {}).find((k) => !LEDGER_KNOWN.has(k) && typeof rows[0][k] === "number" && spread(k) > 1);
  const yCol = own ?? (spread("gas_charged") > 1 ? "gas_charged" : spread("fee_avax") > 0 ? "fee_avax" : spread("gas_charged") > 0 ? "gas_charged" : null);
  const timed = rows.every((r) => isTime(r.t));
  if (!yCol || rows.length < 2) return null;
  const pts = rows.map((r, i) => ({
    x: timed ? toUnix(String(r.t)) : i,
    y: r[yCol] as number,
    hash: String(r.tx_hash),
    failed: r.status === 0 || r.status === "0",
    method: nameFor(names, "method_id", r.method_id) ?? (r.method_id && r.method_id !== "0x" ? String(r.method_id).toLowerCase() : "transfer"),
    from: nameFor(names, "from_address", r.from_address) ?? (isAddress(r.from_address) ? truncate(r.from_address, 5) : ""),
    row: r,
  }));
  const clock = (u: number) => new Date(u * 1000).toISOString().slice(11, 19);
  const yFmt: Format = yCol === "fee_avax" ? "avax" : yCol === "gas_charged" ? "gas" : "compact";
  return (
    <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 pb-3 pt-4 md:px-6 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
        <span className="font-bold uppercase tracking-[0.18em]">{yCol === "fee_avax" ? "Fee" : yCol === "gas_charged" ? "Gas charged" : header(yCol)} per transaction</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
          succeeded
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#E6212F]" />
          reverted
        </span>
      </div>
      <div className="h-44 cursor-pointer text-zinc-900 dark:text-zinc-100">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(161,161,170,0.18)" />
            <XAxis type="number" dataKey="x" domain={["dataMin", "dataMax"]} tickFormatter={(v) => (timed ? clock(v) : `#${v + 1}`)} tick={{ fontSize: 10, fontFamily: "var(--font-geist-mono)" }} tickLine={false} axisLine={false} />
            <YAxis type="number" dataKey="y" tickFormatter={(v) => fmt(v, yFmt, sym, true)} tick={{ fontSize: 10, fontFamily: "var(--font-geist-mono)" }} tickLine={false} axisLine={false} width={56} />
            <ZAxis range={[36, 36]} />
            <RechartsTooltip
              cursor={{ stroke: "rgba(161,161,170,0.4)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const p = payload[0].payload as (typeof pts)[number];
                return (
                  <TipPlate>
                    <p className="flex items-center gap-2 font-mono text-[11px] text-zinc-900 dark:text-zinc-100">
                      <span className={fnInk}>{p.method}</span>
                      {p.failed && <span className="text-[#E6212F]">reverted</span>}
                    </p>
                    <p className="font-mono text-[10px] tabular-nums text-zinc-500">
                      {fmt(p.y, yFmt, sym)} · {timed ? `${clock(p.x)} UTC` : `record ${p.x + 1}`}
                    </p>
                    <p className="font-mono text-[10px] text-zinc-400">
                      {truncate(p.hash, 6)} from {p.from}
                    </p>
                  </TipPlate>
                );
              }}
            />
            <Scatter
              data={pts}
              isAnimationActive={false}
              onMouseEnter={(d: { payload?: { hash: string } }) => onHoverTx(d?.payload?.hash ?? null)}
              onMouseLeave={() => onHoverTx(null)}
              onClick={(d: { payload?: { hash: string } }) => d?.payload?.hash && router.push(`${base}/tx/${d.payload.hash}`)}
            >
              {pts.map((p, i) => (
                <Cell
                  key={`${p.hash}-${i}`}
                  fill={p.failed ? "#E6212F" : "currentColor"}
                  fillOpacity={hoverTx ? (hoverTx === p.hash ? 1 : 0.2) : 0.7}
                  stroke={hoverTx === p.hash ? (p.failed ? "#E6212F" : "currentColor") : "none"}
                  strokeWidth={hoverTx === p.hash ? 6 : 0}
                  strokeOpacity={0.25}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
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

/** one line on where the answer is: who is writing, and the last step */
function progress(events: QueryEvent[]): string {
  let who = "The model";
  let line = "Writing the SQL";
  for (const e of events) {
    if (e.type === "stage") {
      if (e.stage === "cached") return "Kept answer: running its SQL for fresh rows";
      who = e.writer ?? who;
      line = e.stage === "escalated" ? `${who} is taking over` : `${who} is writing the SQL`;
    } else if (e.type === "step") {
      const what = e.kind === "test" ? `test ${e.n}` : "final query";
      line = e.ok ? `${who}: ${what} ran, ${e.detail}` : `${who}: ${what} failed, fixing`;
    }
  }
  return line;
}

export function EvmQuery({ network }: { network: string }) {
  const c = useChainContext();
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
  const [started, setStarted] = useState<number | null>(null);
  // one pointer for the whole sheet: a bar and its row, a dot and its row
  const [hoverKey, setHoverKey] = useState<unknown>(undefined);
  const [hoverTx, setHoverTx] = useState<string | null>(null);
  const router = useRouter();
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
      setDesigning(false);
      setSqlOpen(false);
      const hist = refine ? history : [];
      try {
        const a = await stream({ prompt: text, history: hist }, my);
        if (my !== token.current) return;
        answerSql.current = a.sql;
        setAnswer(a);
        setSqlDraft(a.sql);
        setHistory([...hist, { prompt: text, sql: a.sql, title: a.title }].slice(-6));
        setPrompt("");
        const url = new URL(window.location.href);
        if (!refine) {
          asked.current = text;
          url.searchParams.set("q", text);
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

  // a shared link asks on load, and so does a question typed into the
  // search bar while this page is open (same route, new ?q)
  const qParam = useSearchParams().get("q");
  const asked = useRef<string | null>(null);
  useEffect(() => {
    if (!qParam || qParam === asked.current) return;
    asked.current = qParam;
    void ask(qParam, false);
  }, [qParam, ask]);
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
    asked.current = null;
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
  // the basic layout is never drawn while the real one is on its way
  const laying = designing || (!!answer?.draftVisual && !!answer.result?.rowCount);
  const firstX = visual?.panels.find((p) => p.x)?.x ?? answer?.chart.x;
  const span = useMemo(() => (firstX ? spanOf(rows.map((r) => r[firstX])) : "other"), [rows, firstX]);
  const leadPanel = visual?.panels.find((p) => p.kind !== "table" && p.x && p.series.length);
  const lead = leadPanel
    ? { x: leadPanel.x!, col: leadPanel.series[0].column, max: Math.max(0, ...rows.map((r) => (typeof r[leadPanel.series[0].column] === "number" ? (r[leadPanel.series[0].column] as number) : 0))) }
    : null;
  const recordRows = !!answer?.result && isTxList(answer.result.columns);
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
    // the prompt box below is this page's search bar; the shell's would repeat it
    <EvmShell network={network} search={false}>
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
          {busy && <AvalancheLoader status={`${phase === "running" ? "Running your SQL" : progress(events)} · ${elapsed} s`} />}
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
                  {/* one draw: the loader holds the space until the layout is final */}
                  {laying ? (
                    <div aria-busy="true">
                      <AvalancheLoader status="Rows are in below. Opus 5.5 is laying out the chart" height={260} />
                    </div>
                  ) : charted && visual ? (
                    <QueryVisual
                      visual={visual}
                      rows={rows}
                      names={names}
                      sym={sym}
                      canDrill={canDrill || recordRows}
                      onPick={(r) => {
                        if (recordRows && r.tx_hash) return router.push(`${base}/tx/${String(r.tx_hash)}`);
                        const i = rows.indexOf(r);
                        if (i >= 0) void openDrill(r, i);
                      }}
                      hoverKey={hoverKey}
                      onHoverKey={setHoverKey}
                      range={range}
                      onRange={setRange}
                      onZoom={(lo, hi) => void ask(`Only between ${String(lo)} and ${String(hi)} inclusive, same figures, finer buckets if that helps.`, true)}
                      selected={drill && firstX ? drill.row[firstX] : undefined}
                    />
                  ) : (
                    <p className="font-mono text-[12px] text-zinc-500">{rows.length ? "The rows are below." : "The query returned no rows."}</p>
                  )}

                  {!laying && visual && (visual.callouts.length > 0 || reading) && (
                    <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Reading</span>
                      {/* a kept answer's reading is written again from its fresh rows; hold its space meanwhile */}
                      {reading && (
                        <ul aria-busy="true" aria-label="Writing the reading" className="flex flex-col gap-1.5">
                          {[92, 78, 64].map((w) => (
                            <li key={w} className="flex h-[23px] items-center">
                              <span className="h-2.5 animate-pulse rounded-sm bg-zinc-200/80 dark:bg-zinc-800" style={{ width: `${w}%` }} />
                            </li>
                          ))}
                        </ul>
                      )}
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
                          {answer.anchor && (
                            <span className="mt-1 block text-amber-700 dark:text-amber-400">
                              The index ends {duration(Math.max(0, Math.floor(Date.now() / 1000) - toUnix(answer.anchor)))} before now, so &ldquo;now&rdquo; is its last block, {answer.anchor.slice(11, 16)} UTC.
                            </span>
                          )}
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
                      {answer.model?.cached
                        ? `Kept answer (${answer.model.writer ?? "model"} wrote the SQL); rows fresh in ${Math.round((answer.model.ms ?? 0) / 100) / 10} s.`
                        : `${answer.model?.writer ?? "The model"} wrote it in ${Math.round((answer.model?.ms ?? 0) / 1000)} s${answer.model?.tries ? `, ${answer.model.tries} test run${answer.model.tries === 1 ? "" : "s"}` : ""}.`}
                      {designing ? " Opus 5.5 is laying it out." : answer.model?.designMs ? ` Opus 5.5 laid it out in ${Math.round(answer.model.designMs / 1000)} s.` : ""}
                      {answer.model?.inputTokens ? ` ${Math.round((100 * (answer.model.cacheRead ?? 0)) / answer.model.inputTokens)}% of the prompt read from cache.` : ""}
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
                  {canDrill && !recordRows && <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Select a row or a bar to list its transactions.</span>}
                  {recordRows && <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Select a point or a row to open the transaction.</span>}
                </div>
                <Board>
                  {isTxList(answer.result.columns) ? (
                    <TxLedger columns={answer.result.columns} rows={rows} names={names} visual={visual} base={base} sym={sym} hoverTx={hoverTx} onHoverTx={setHoverTx} />
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
                      lead={lead}
                      hoverKey={hoverKey}
                      onHoverKey={setHoverKey}
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
                      <>
                        <RecordPlot rows={drill.answer.result.rows} names={drill.answer.names} base={base} sym={sym} hoverTx={hoverTx} onHoverTx={setHoverTx} />
                        <TxLedger columns={drill.answer.result.columns} rows={drill.answer.result.rows} names={drill.answer.names} visual={null} base={base} sym={sym} hoverTx={hoverTx} onHoverTx={setHoverTx} />
                      </>
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
