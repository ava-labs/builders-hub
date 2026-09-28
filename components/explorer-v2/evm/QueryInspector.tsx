"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Download, Table2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fnInk } from "@/components/explorer-v2/ui";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import type { Names } from "@/lib/explorer-query/types";
import type { ColumnMeta } from "@/lib/explorer-query/clickhouse";
import type { VisualSpec } from "@/lib/explorer-query/visual";
import { fmt, fmtX, nameFor, spanOf } from "./QueryVisual";
import { LEDGER_KNOWN, ResultTable, type Row, ago, doorFor, downloadCsv, formatOf, header, isAddress, isTime, isTxList, toUnix } from "./QueryRows";

/* The rows behind the chart, read in a sheet beside it. The chart is
   the index: whatever the reader has picked on it is what the sheet
   lists, drawn by the rows' shape. Transactions read as cards, a
   ranking as bars with their share, anything else as a table whose
   headers carry each column's spread. The plain table is the last
   resort, one switch away. */

const numericType = (c: ColumnMeta) => /Int|Float|Decimal/.test(c.type);

/** what the rows are: transactions, a ranking of named things, or rows */
export type Shape = { kind: "tx" } | { kind: "rank"; label: string; value: string } | { kind: "table" };

export function shapeOf(columns: ColumnMeta[], rows: Row[], visual: VisualSpec | null): Shape {
  if (isTxList(columns)) return { kind: "tx" };
  const first = rows[0] ?? {};
  const timed = columns.some((c) => isTime(first[c.name]));
  const text = columns.filter((c) => !numericType(c));
  const nums = columns.filter(numericType);
  if (!timed && nums.length > 0 && text.length >= 1 && text.length <= 2) {
    const lead = visual?.panels.flatMap((p) => p.series).find((s) => nums.some((n) => n.name === s.column))?.column;
    return { kind: "rank", label: text[0].name, value: lead ?? nums[0].name };
  }
  // a series over time reads the same way: one bar per bucket, in order
  const when = columns.find((c) => isTime(first[c.name]));
  if (when && nums.length > 0 && text.length <= 2) {
    const lead = visual?.panels.flatMap((p) => p.series).find((s) => nums.some((n) => n.name === s.column))?.column;
    return { kind: "rank", label: when.name, value: lead ?? nums[0].name };
  }
  return { kind: "table" };
}

/* ------------------------------------------------------------------ */
/* transactions, one card each                                          */

export function TxCards({ rows, names, visual, base, sym, step = 40 }: { rows: Row[]; names: Names; visual: VisualSpec | null; base: string; sym: string; step?: number }) {
  const [shown, setShown] = useState(step);
  const keys = Object.keys(rows[0] ?? {});
  // the figure the question was about, else what the transaction cost
  const own = keys.find((k) => !LEDGER_KNOWN.has(k) && typeof rows[0]?.[k] === "number");
  const valueCol = own ?? (keys.includes("fee_avax") ? "fee_avax" : null);
  const who = (col: string, v: unknown) => nameFor(names, col, v) ?? (isAddress(v) ? truncate(v, 5) : String(v ?? ""));
  return (
    <ul className="flex flex-col">
      {rows.slice(0, shown).map((r, i) => {
        const hash = String(r.tx_hash);
        const failed = r.status === 0 || r.status === "0";
        const mName = nameFor(names, "method_id", r.method_id);
        const method = mName ?? (r.method_id && r.method_id !== "0x" ? String(r.method_id).toLowerCase() : "transfer");
        const v = valueCol ? r[valueCol] : null;
        return (
          <li key={`${hash}-${i}`}>
            <Link href={`${base}/tx/${hash}`} className="flex flex-col gap-1 rounded-xl px-3 py-2.5 transition-colors hover:bg-zinc-100/80 focus-visible:bg-zinc-100/80 focus-visible:outline-none dark:hover:bg-zinc-900 dark:focus-visible:bg-zinc-900">
              <span className="flex items-baseline gap-2">
                <span aria-label={failed ? "reverted" : "succeeded"} className={cn("h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full", failed ? "bg-[#E6212F]" : "bg-emerald-500")} />
                <span className={cn("min-w-0 flex-1 truncate font-mono text-[12.5px]", mName ? fnInk : "text-zinc-500 dark:text-zinc-400")} title={String(r.method_id ?? "")}>
                  {method}
                </span>
                {typeof v === "number" && valueCol && (
                  <span className="shrink-0 font-mono text-[12.5px] tabular-nums text-zinc-900 dark:text-zinc-50">{fmt(v, formatOf(valueCol, visual), sym)}</span>
                )}
              </span>
              <span className="flex items-baseline gap-2 pl-3.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="min-w-0 flex-1 truncate">
                  {who("from_address", r.from_address)}
                  <span className="px-1.5 text-zinc-300 dark:text-zinc-700">→</span>
                  {who("to_address", r.to_address)}
                </span>
                {isTime(r.t) && (
                  <span className="shrink-0 tabular-nums text-zinc-400 dark:text-zinc-500" title={`${String(r.t).replace("T", " ").slice(0, 19)} UTC`}>
                    {ago(toUnix(r.t))} ago
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
      {rows.length > shown && <More left={rows.length - shown} step={step} onMore={() => setShown((n) => n + step)} />}
    </ul>
  );
}

function More({ left, step, onMore }: { left: number; step: number; onMore: () => void }) {
  return (
    <li>
      <button type="button" onClick={onMore} className="w-full px-3 py-3 text-left font-mono text-[11px] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
        Show {formatNumber(Math.min(step, left))} more of {formatNumber(left)}
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* a ranking: each thing, its figure, and its share of the whole        */

export function RankList({
  rows,
  shape,
  names,
  visual,
  base,
  sym,
  onOpen,
  step = 60,
}: {
  rows: Row[];
  shape: { label: string; value: string };
  names: Names;
  visual: VisualSpec | null;
  base: string;
  sym: string;
  onOpen?: (row: Row) => void;
  step?: number;
}) {
  const [shown, setShown] = useState(step);
  const vals = rows.map((r) => (typeof r[shape.value] === "number" ? (r[shape.value] as number) : 0));
  const max = Math.max(0, ...vals);
  const total = vals.reduce((a, b) => a + b, 0);
  const f = formatOf(shape.value, visual);
  // a share of a share reads as nonsense
  const share = f !== "percent" && vals.every((v) => v >= 0) && total > 0;
  const span = spanOf(rows.map((r) => r[shape.label]));
  return (
    <ul className="flex flex-col">
      <li className="flex items-baseline justify-between px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
        <span>{header(shape.label)}</span>
        <span>{header(shape.value)}</span>
      </li>
      {rows.slice(0, shown).map((r, i) => {
        const raw = r[shape.label];
        const name = nameFor(names, shape.label, raw);
        const text = name ?? (isAddress(raw) ? truncate(raw, 6) : isTime(raw) ? fmtX(raw, span) : String(raw ?? ""));
        const v = vals[i];
        const door = doorFor(shape.label, raw, base);
        const body = (
          <>
            <span className="flex items-baseline gap-3">
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-zinc-900 dark:text-zinc-50" title={String(raw ?? "")}>
                {text}
                {name && isAddress(raw) && <span className="ml-2 text-[10px] text-zinc-400 dark:text-zinc-600">{truncate(raw, 4)}</span>}
              </span>
              {share && <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{((v / total) * 100).toFixed(v / total < 0.1 ? 1 : 0)}%</span>}
              <span className="w-20 shrink-0 text-right font-mono text-[12.5px] tabular-nums text-zinc-900 dark:text-zinc-50">{fmt(r[shape.value], f, sym)}</span>
            </span>
            <span aria-hidden className="block h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
              <span className="block h-full rounded-full bg-zinc-800 dark:bg-zinc-300" style={{ width: `${max > 0 ? Math.max(1, (v / max) * 100) : 0}%` }} />
            </span>
          </>
        );
        const cls = "flex w-full flex-col gap-1.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-100/80 focus-visible:bg-zinc-100/80 focus-visible:outline-none dark:hover:bg-zinc-900 dark:focus-visible:bg-zinc-900";
        return (
          <li key={`${String(raw)}-${i}`}>
            {onOpen ? (
              <button type="button" onClick={() => onOpen(r)} className={cls}>
                {body}
              </button>
            ) : door ? (
              <Link href={door} className={cls}>
                {body}
              </Link>
            ) : (
              <div className={cn(cls, "hover:bg-transparent dark:hover:bg-transparent")}>{body}</div>
            )}
          </li>
        );
      })}
      {rows.length > shown && <More left={rows.length - shown} step={step} onMore={() => setShown((n) => n + step)} />}
    </ul>
  );
}

/* ------------------------------------------------------------------ */

/** the rows by their shape; `table` forces the plain table */
export function RowsBody({
  columns,
  rows,
  names,
  visual,
  base,
  sym,
  onOpen,
  table = false,
}: {
  columns: ColumnMeta[];
  rows: Row[];
  names: Names;
  visual: VisualSpec | null;
  base: string;
  sym: string;
  onOpen?: (row: Row) => void;
  table?: boolean;
}) {
  if (!rows.length) return <p className="px-3 py-6 font-mono text-[12px] text-zinc-400 dark:text-zinc-500">No rows in this selection.</p>;
  const shape = shapeOf(columns, rows, visual);
  if (!table && shape.kind === "tx") return <TxCards rows={rows} names={names} visual={visual} base={base} sym={sym} />;
  if (!table && shape.kind === "rank") return <RankList rows={rows} shape={shape} names={names} visual={visual} base={base} sym={sym} onOpen={onOpen} />;
  return (
    <div className="-mx-1 [&_a]:outline-offset-2">
      <ResultTable
        columns={columns}
        rows={rows}
        names={names}
        visual={visual}
        base={base}
        sym={sym}
        span="other"
        picked={null}
        onPick={onOpen ? (r) => onOpen(r) : undefined}
        step={100}
        hist
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the sheet                                                            */

function useDesktop() {
  const [desk, setDesk] = useState(true);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    const on = () => setDesk(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return desk;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

export function QueryInspector({
  open,
  onClose,
  title,
  sub,
  columns,
  rows,
  total,
  names,
  visual,
  base,
  sym,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  /** the answer or the drilled group the rows belong to */
  title: string;
  /** the selection in words, when there is one */
  sub?: string;
  columns: ColumnMeta[];
  /** the selected rows only */
  rows: Row[];
  /** all rows at this level, selected or not */
  total: number;
  names: Names;
  visual: VisualSpec | null;
  base: string;
  sym: string;
  onOpen?: (row: Row) => void;
}) {
  const desk = useDesktop();
  const still = useReducedMotion();
  const [table, setTable] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const shape = shapeOf(columns, rows, visual);
  const wide = table || shape.kind === "table";

  // open: hold the page still, focus the sheet; close: hand focus back
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = requestAnimationFrame(() => closeBtn.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prev;
      back?.focus?.();
    };
  }, [open]);

  // tab stays inside the sheet while it is open
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !panel.current) return;
    const els = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const slide = desk ? { x: "100%" } : { y: "100%" };
  const motionT = still ? { duration: 0 } : { type: "spring" as const, stiffness: 380, damping: 38, mass: 0.9 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="veil"
          aria-hidden
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={still ? { duration: 0 } : { duration: 0.2 }}
          className="fixed inset-0 z-[80] bg-zinc-950/20 backdrop-blur-[2px] dark:bg-black/50"
        />
      )}
      {open && (
        <motion.div
          key="sheet"
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onKeyDown={trap}
          initial={slide}
          animate={{ x: 0, y: 0 }}
          exit={slide}
          transition={motionT}
          className={cn(
            "fixed z-[81] flex flex-col bg-white shadow-[0_24px_64px_-24px_rgba(24,24,27,0.45)] dark:bg-zinc-950 dark:shadow-[0_24px_64px_-24px_rgba(0,0,0,0.9)] dark:ring-1 dark:ring-zinc-800/80",
            desk
              ? cn("inset-y-0 right-0 max-w-[100vw] transition-[width] duration-300 ease-out motion-reduce:transition-none", wide ? "w-[min(56rem,94vw)]" : "w-[420px]")
              : "inset-x-0 bottom-0 h-[88dvh] rounded-t-3xl",
          )}
        >
          {!desk && <span aria-hidden className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" />}
          <div className="flex items-start gap-3 px-5 pb-3 pt-4">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h2 id={titleId} className="flex items-baseline gap-2 text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Rows
                <span className="font-mono text-[12px] font-normal tabular-nums text-zinc-400 dark:text-zinc-500">
                  {rows.length === total ? formatNumber(total) : `${formatNumber(rows.length)} of ${formatNumber(total)}`}
                </span>
              </h2>
              <p className="truncate text-[12.5px] text-zinc-500 dark:text-zinc-400" title={sub ?? title}>
                {sub ?? title}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {shape.kind !== "table" && (
                <button
                  type="button"
                  onClick={() => setTable((v) => !v)}
                  aria-pressed={table}
                  title={table ? "Back to the list" : "Show all rows as table"}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-full px-2.5 font-mono text-[11px] transition-colors",
                    table ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
                  )}
                >
                  <Table2 className="h-3.5 w-3.5" /> Table
                </button>
              )}
              <button
                type="button"
                onClick={() => downloadCsv({ title, columns, rows, names })}
                disabled={!rows.length}
                title="Download these rows as CSV"
                className="flex h-8 items-center gap-1.5 rounded-full px-2.5 font-mono text-[11px] text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
              <button
                ref={closeBtn}
                type="button"
                onClick={onClose}
                aria-label="Close rows"
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-8">
            <RowsBody columns={columns} rows={rows} names={names} visual={visual} base={base} sym={sym} onOpen={onOpen} table={table} />
          </div>
          <p className="shrink-0 px-5 py-2.5 font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
            Esc closes · R toggles
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
