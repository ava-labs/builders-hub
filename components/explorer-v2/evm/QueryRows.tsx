"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip as RechartsTooltip, XAxis, YAxis, ZAxis } from "recharts";
import { X } from "lucide-react";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { cn } from "@/lib/utils";
import { HEAD, ROW, RowDoor, idInk, fnInk } from "@/components/explorer-v2/ui";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import type { Names } from "@/lib/explorer-query/types";
import type { ColumnMeta } from "@/lib/explorer-query/clickhouse";
import type { Format, VisualSpec } from "@/lib/explorer-query/visual";
import { order } from "@/lib/explorer-query/selection";
import { fmt, fmtX, nameFor, spanOf } from "./QueryVisual";

/* The rows of a query answer, as the explorer reads them: the column
   words, the doors out of a cell, the generic table, the transaction
   ledger and the one-dot-per-transaction plot. Shared by the answer
   page, its zoom and its rows inspector. */

export type Row = Record<string, unknown>;
export type Span = ReturnType<typeof spanOf>;

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

export const header = (col: string) => HEADERS[col] ?? col.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** the unit a column is in: the layout's word first, then its name */
export function formatOf(col: string, visual: VisualSpec | null): Format {
  const fromVisual = visual?.panels.flatMap((p) => p.series).find((s) => s.column === col)?.format ?? visual?.stats.find((s) => s.column === col)?.format;
  if (fromVisual) return fromVisual;
  if (/pct|share|percent|rate/.test(col)) return "percent";
  if (/avax|fee/.test(col)) return "avax";
  if (/gas/.test(col)) return "gas";
  return "number";
}

export const isAddress = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
export const isHash = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
export const isSelector = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{8}$/.test(v);
export const isTime = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(v);

export function doorFor(col: string, v: unknown, base: string): string | null {
  const c = col.toLowerCase();
  // P-Chain ids, as the query returns them: NodeID-…, P-avax1…, CB58 tx ids
  if (typeof v === "string") {
    if (/^NodeID-[1-9A-HJ-NP-Za-km-z]{20,}$/.test(v)) return `${base}/node/${v}`;
    if (/^P-(avax|fuji|local)1[02-9ac-hj-np-z]{20,}$/.test(v)) return `${base}/address/${v}`;
    if (/(^|_)tx_id$/.test(c) && /^[1-9A-HJ-NP-Za-km-z]{40,60}$/.test(v)) return `${base}/tx/${v}`;
  }
  if (typeof v === "number" && Number.isInteger(v) && c === "block_height") return `${base}/block/${v}`;
  if (isAddress(v)) return `${base}/address/${v}`;
  if (isHash(v)) return c.includes("block") ? null : `${base}/tx/${v}`;
  if (typeof v === "number" && Number.isInteger(v) && (c === "block_number" || c === "block" || c.endsWith("_block"))) return `${base}/block/${v}`;
  return null;
}

export function fillTitle(template: string, row: Row, names: Names): string {
  return template.replace(/\{\{\s*([A-Za-z_]\w*)\s*(?::(?:bytes|raw))?\s*\}\}/g, (_m, col: string) => {
    const v = row[col];
    if (v === undefined || v === null) return "?";
    return nameFor(names, col, v) ?? (isAddress(v) || isHash(v) ? truncate(v, 6) : String(v));
  });
}

export const toUnix = (s: string) => Math.floor(new Date(s.replace(" ", "T") + (s.length <= 10 ? "T00:00:00Z" : "Z")).getTime() / 1000);

export function duration(secs: number): string {
  if (secs < 90) return `${Math.round(secs)} s`;
  if (secs < 5400) return `${Math.round(secs / 60)} min`;
  if (secs < 172800) return `${(secs / 3600).toFixed(1)} h`;
  return `${Math.round(secs / 86400)} days`;
}

export function ago(unix: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - unix);
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
}

/* ------------------------------------------------------------------ */
/* the result rows                                                     */

export function ResultTable({
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
  step,
  hist = false,
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
  /** show this many rows, then this many more on each ask; unset, the first 200 */
  step?: number;
  /** a small histogram of each numeric or time column in its header */
  hist?: boolean;
}) {
  const numeric = new Set(columns.filter((c) => /Int|Float|Decimal/.test(c.type)).map((c) => c.name));
  const [shown, setShown] = useState(step ?? 200);
  const tpl = (lead ? "4.5rem " : "") + columns.map((c) => (numeric.has(c.name) ? "8.5rem" : "minmax(9rem,1fr)")).join(" ");
  return (
    <div className="overflow-x-auto">
      <div className="min-w-max md:min-w-0">
        <div className={cn(HEAD, "grid")} style={{ gridTemplateColumns: tpl }}>
          {lead && <span title="this row's bar on the chart">Chart</span>}
          {columns.map((c) => (
            <span key={c.name} className={cn("truncate", numeric.has(c.name) && "text-right")} title={`${c.name} · ${c.type}`}>
              {header(c.name)}
              {hist && <MiniHist rows={rows} column={c.name} numeric={numeric.has(c.name)} />}
            </span>
          ))}
        </div>
        {rows.slice(0, shown).map((r, i) => (
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
        {rows.length > shown &&
          (step ? (
            <button
              type="button"
              onClick={() => setShown((n) => n + step)}
              className="w-full px-5 py-3 text-left font-mono text-[11px] text-zinc-500 transition-colors hover:text-zinc-900 md:px-6 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Show {formatNumber(Math.min(step, rows.length - shown))} more of {formatNumber(rows.length - shown)}
            </button>
          ) : (
            <p className="px-5 py-3 font-mono text-[11px] text-zinc-400 md:px-6">First {formatNumber(shown)} of {formatNumber(rows.length)} rows.</p>
          ))}
      </div>
    </div>
  );
}

/* how one column's values fall, 24px high: sixteen bins between its
   least and greatest value. Times bin by their clock, numbers by size. */
export function MiniHist({ rows, column, numeric }: { rows: Row[]; column: string; numeric: boolean }) {
  const vals: number[] = [];
  for (const r of rows) {
    const v = r[column];
    if (numeric && typeof v === "number" && Number.isFinite(v)) vals.push(v);
    else if (!numeric && isTime(v)) vals.push(order(v) as number);
  }
  if (vals.length < 3) return null;
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of vals) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (hi <= lo) return null;
  const N = 16;
  const bins = new Array<number>(N).fill(0);
  for (const v of vals) bins[Math.min(N - 1, Math.floor(((v - lo) / (hi - lo)) * N))]++;
  const top = Math.max(...bins);
  return (
    <svg aria-hidden viewBox={`0 0 ${N * 4} 24`} preserveAspectRatio="none" className="mt-1 block h-6 w-full text-zinc-300 dark:text-zinc-700">
      {bins.map((b, i) => {
        const h = b ? Math.max(1.5, (b / top) * 24) : 0;
        return <rect key={i} x={i * 4 + 0.5} y={24 - h} width={3} height={h} rx={0.5} fill="currentColor" />;
      })}
    </svg>
  );
}

/* transactions, drawn as the explorer draws them everywhere else. The
   columns follow what the query returned: the standard ones where they
   exist, then whatever else it carried (an amount, a value, a token),
   so the figure the question was about is never dropped. */
export const LEDGER_KNOWN = new Set(["t", "tx_hash", "method_id", "from_address", "to_address", "block_number", "gas_charged", "fee_avax", "status"]);

export function TxLedger({
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
export function RecordPlot({
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

export const isTxList = (cols: ColumnMeta[]) => ["tx_hash", "from_address", "to_address"].every((k) => cols.some((c) => c.name === k));

/** the rows exactly as the query returned them, with decoded names beside
    the raw values they name */
export function downloadCsv(a: { title: string; columns: ColumnMeta[]; rows: Row[]; names: Names }) {
  const cols = a.columns.map((k) => k.name);
  const named = cols.filter((k) => a.names[k] && Object.keys(a.names[k]).length);
  const head = [...cols, ...named.map((k) => `${k}_name`)];
  const cell = (v: unknown) => {
    const t = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lines = a.rows.map((r) => [...cols.map((k) => cell(r[k])), ...named.map((k) => cell(a.names[k]?.[String(r[k]).toLowerCase()] ?? ""))].join(","));
  const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${a.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "query"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
