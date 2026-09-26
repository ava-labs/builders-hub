"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip as RechartsTooltip, XAxis, YAxis, ZAxis } from "recharts";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { cn } from "@/lib/utils";
import { HEAD, ROW, idInk, fnInk } from "@/components/explorer-v2/ui";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import type { Names } from "@/lib/explorer-query/types";
import type { ColumnMeta } from "@/lib/explorer-query/clickhouse";
import type { Format, Panel, VisualSpec } from "@/lib/explorer-query/visual";
import { order } from "@/lib/explorer-query/selection";
import { fmt, fmtX, nameFor, spanOf } from "./QueryVisual";

/* The rows of a query answer, as the explorer reads them: the column
   words, the doors out of a cell and a row, the generic table, a table
   panel and the one-dot-per-transaction plot. Shared by the answer page,
   its zoom, its rows inspector and the board tiles. */

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

/** the columns a list of transactions carries as standard; anything else is the query's own figure */
export const LEDGER_KNOWN = new Set(["t", "tx_hash", "method_id", "from_address", "to_address", "block_number", "gas_charged", "fee_avax", "status"]);

/** where one row of an answer opens: its transaction, for a list of
    transactions, else the page of the thing a chart's axis names (a
    contract, a validator, a block); null when it names nothing */
export function rowDoor(row: Row, columns: ColumnMeta[], visual: VisualSpec | null, base: string): string | null {
  if (isTxList(columns) && isHash(row.tx_hash)) return `${base}/tx/${row.tx_hash}`;
  for (const p of visual?.panels ?? []) {
    const door = p.x ? doorFor(p.x, row[p.x], base) : null;
    if (door) return door;
  }
  return null;
}

/* a table the designer laid out: its columns, in its order, the first
   rows in place and the rest a click away. Hashes, addresses and blocks
   are links; a row opens what it is about. */
export function PanelRows({
  panel,
  columns,
  rows,
  names,
  visual,
  base,
  sym,
  onPick,
  onAll,
  limit = 10,
}: {
  panel: Panel;
  columns: ColumnMeta[];
  rows: Row[];
  names: Names;
  visual: VisualSpec | null;
  base: string;
  sym: string;
  onPick?: (row: Row) => void;
  /** every row, in the sheet */
  onAll?: () => void;
  limit?: number;
}) {
  const named = panel.series.map((s) => columns.find((c) => c.name === s.column)).filter((c): c is ColumnMeta => !!c);
  const cols = named.length ? named : columns;
  const when = cols.find((c) => isTime(rows[0]?.[c.name]))?.name;
  const span = when ? spanOf(rows.map((r) => r[when])) : "other";
  if (!rows.length) return <p className="py-6 font-mono text-[12px] text-zinc-400 dark:text-zinc-500">No rows in this selection.</p>;
  return (
    <div className="flex flex-col">
      <div className="-mx-4 sm:-mx-5">
        <ResultTable columns={cols} rows={rows.slice(0, limit)} names={names} visual={visual} base={base} sym={sym} span={span} picked={null} onPick={onPick ? (r) => onPick(r) : undefined} />
      </div>
      {rows.length > limit && onAll && (
        <button
          type="button"
          onClick={onAll}
          className="self-start rounded-full px-3 py-1.5 font-mono text-[11px] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 -ml-3 mt-1 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
        >
          All {formatNumber(rows.length)} rows
        </button>
      )}
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
