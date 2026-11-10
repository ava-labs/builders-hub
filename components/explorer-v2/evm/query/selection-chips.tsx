"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Names } from "@/lib/explorer-query/types";
import { clearColumn, withPick, type Selection } from "@/lib/explorer-query/selection";
import { chipRange, chipValue, zoneOf } from "../query-format";
import { MOTION, useReduced } from "./motion";
import { ACCENT, type Row } from "./sheet";

/* ------------------------------------------------------------------ */
/* the selection, as chips                                             */

const ACT = "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 dark:text-zinc-400 dark:hover:text-zinc-100";

export function SelectionChips({
  selection,
  onSelection,
  rows,
  names,
  formatValue,
  onZoom,
  onOpen,
  onAsk,
  className,
}: {
  selection: Selection;
  onSelection: (s: Selection) => void;
  /** the answer's rows: a time reads in the zone its column's axis reads in (zoneOf) */
  rows: Row[];
  names: Names;
  /** a label for one picked value; return undefined to use the default */
  formatValue?: (column: string, value: string | number) => string | undefined;
  /** when given, a range pick offers to ask again inside that range */
  onZoom?: (lo: unknown, hi: unknown) => void;
  /** when one mark is picked and it has records: open them */
  onOpen?: () => void;
  /** make the selection the subject of the next question */
  onAsk?: () => void;
  className?: string;
}) {
  const reduced = useReduced();
  const zone = (column: string) => zoneOf(rows.map((r) => r[column]));
  const chips = selection.flatMap((p) =>
    p.kind === "range"
      ? [{ key: `${p.column}:range`, text: chipRange(names, p.column, p.from, p.to, zone(p.column)), column: p.column, drop: () => onSelection(clearColumn(selection, p.column)) }]
      : p.values.map((v) => ({
          key: `${p.column}:${v}`,
          text: formatValue?.(p.column, v) ?? chipValue(names, p.column, v, zone(p.column)),
          column: p.column,
          drop: () => onSelection(withPick(selection, { kind: "value", column: p.column, values: p.values.filter((q) => q !== v) })),
        })),
  );
  const range = selection.find((p) => p.kind === "range");
  const t = reduced ? { duration: 0 } : MOTION;
  return (
    <AnimatePresence initial={false}>
      {chips.length > 0 && (
        <motion.div key="chips" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={t} className={cn("overflow-hidden", className)}>
          <div role="list" aria-label="Selection" className="flex flex-wrap items-center gap-1.5 pb-1">
            <AnimatePresence initial={false} mode="popLayout">
              {chips.map((c) => (
                <motion.span
                  key={c.key}
                  role="listitem"
                  layout={!reduced}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={t}
                  title={c.column.replace(/_/g, " ")}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pr-0.5 pl-2.5 font-mono text-[11px] tabular-nums text-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-100"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />
                  {c.text}
                  <button
                    type="button"
                    onClick={c.drop}
                    aria-label={`Remove ${c.text}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
                  >
                    <XIcon className="h-3 w-3" strokeWidth={2} />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
            {range && onZoom && (
              <button
                type="button"
                onClick={() => onZoom(range.from, range.to)}
                className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Zoom in
              </button>
            )}
            {onOpen && (
              <button type="button" onClick={onOpen} className={ACT}>
                Open records
              </button>
            )}
            {onAsk && (
              <button type="button" onClick={onAsk} className={ACT}>
                Ask about this
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelection([])}
              className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 dark:text-zinc-500 dark:hover:text-zinc-50"
            >
              Clear
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
