"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/components/explorer-v2/format";
import { applySelection } from "@/lib/explorer-query/selection";
import type { Format } from "@/lib/explorer-query/visual-spec";
import { rowCount } from "../query-client";
import { fmt, spanOf, xText, zoneOf } from "../query-format";
import type { PanelProps } from "./sheet";

/** the panel's own rows as a table: its x and its series, sortable, and
    only the selected rows while a selection stands */
export function PanelTable({ panel, rows, names, sym, canDrill, onPick, hoverKey, onHoverKey, live }: PanelProps) {
  const x = panel.x!;
  const [span, zone] = useMemo(() => [spanOf(rows.map((r) => r[x])), zoneOf(rows.map((r) => r[x]))] as const, [rows, x]);
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);
  const kept = useMemo(() => applySelection(rows, live), [rows, live]);
  const shown = useMemo(() => {
    if (!sort) return kept;
    const k = sort.col;
    return [...kept].sort((a, b) => {
      const va = a[k];
      const vb = b[k];
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va ?? "").localeCompare(String(vb ?? ""));
      return sort.dir === "asc" ? c : -c;
    });
  }, [kept, sort]);
  const cols = [{ column: x, label: x.replace(/_/g, " "), format: "number" as Format, isX: true }, ...panel.series.map((s) => ({ column: s.column, label: s.label, format: s.format, isX: false }))];
  const flip = (col: string) => setSort((cur) => (cur?.col === col ? (cur.dir === "desc" ? { col, dir: "asc" } : null) : { col, dir: "desc" }));

  return (
    <div className="flex flex-col gap-2">
      {live.length > 0 && (
        <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
          {formatNumber(kept.length)} of {rowCount(rows.length)}
        </span>
      )}
      <div className="max-h-[26rem] overflow-auto">
        <table className="w-full border-collapse font-mono text-[12px] tabular-nums">
          <thead className="sticky top-0 bg-white/90 backdrop-blur dark:bg-zinc-950/90">
            <tr>
              {cols.map((c) => (
                <th key={c.column} className={cn("border-b border-zinc-100 px-3 py-2 font-normal dark:border-zinc-900", c.isX ? "text-left" : "text-right")}>
                  <button type="button" onClick={() => flip(c.column)} className="inline-flex items-center gap-1 rounded text-[10px] uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 dark:text-zinc-400 dark:hover:text-zinc-100">
                    {c.label}
                    {sort?.col === c.column && (sort.dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr
                key={i}
                onClick={() => canDrill && onPick(r)}
                onMouseEnter={() => onHoverKey?.(r[x])}
                onMouseLeave={() => onHoverKey?.(undefined)}
                className={cn("transition-colors", canDrill && "cursor-pointer", hoverKey !== undefined && hoverKey === r[x] ? "bg-zinc-50 dark:bg-zinc-900" : canDrill && "hover:bg-zinc-50 dark:hover:bg-zinc-900")}
              >
                {cols.map((c) => (
                  <td key={c.column} className={cn("px-3 py-1.5", c.isX ? "text-left text-zinc-800 dark:text-zinc-200" : "text-right text-zinc-900 dark:text-zinc-50")}>
                    {c.isX ? xText(names, x, r[x], span === "other" ? "other" : span, zone) : fmt(r[c.column], c.format, sym)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
