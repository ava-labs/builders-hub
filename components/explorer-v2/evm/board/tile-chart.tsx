"use client";

/* A chart tile's drawing: its slice of the answer (tile-visual.ts), drawn
   with the page's own charts from the rows the tile kept. The figures
   count the whole result while the tile holds the answer's totals, and a
   chart is told when its rows stop at a LIMIT, as on the answer's grid. */

import { useMemo } from "react";
import type { ChartTile } from "@/lib/explorer-query/board";
import { tileVisual } from "@/lib/explorer-query/tile-visual";
import { QueryVisual } from "@/components/explorer-v2/evm/QueryVisual";
import { PanelRows, doorFor, isTxList } from "@/components/explorer-v2/evm/QueryRows";
import { RowsBody } from "@/components/explorer-v2/evm/QueryInspector";
import type { Row } from "./parts";

/** whether a tile's marks open anything: a transaction, a thing's own page, or records */
function opens(tile: ChartTile, base: string): boolean {
  const snap = tile.snapshot;
  if (!snap) return false;
  if (tile.drill || isTxList(snap.columns)) return true;
  return tile.visual.panels.some((p) => !!p.x && snap.rows.slice(0, 50).some((r) => doorFor(p.x!, r[p.x!], base)));
}

/** the tile's rows drawn with the page's own charts; every mark opens what it is about */
export function TileChart({
  tile,
  sym,
  base,
  onMark,
  onDrill,
  onRows,
}: {
  tile: ChartTile;
  sym: string;
  base: string;
  /** a mark or a row of the tile */
  onMark?: (row: Row) => void;
  /** a row of a list, into its records */
  onDrill?: (row: Row) => void;
  /** every row, in the sheet */
  onRows?: () => void;
}) {
  const visual = useMemo(() => tileVisual(tile), [tile]);
  const open = useMemo(() => opens(tile, base), [tile, base]);
  const snap = tile.snapshot;
  if (!snap) {
    return (
      <div aria-busy="true" className="flex h-56 flex-col justify-end gap-2 pb-2">
        <span className="sr-only">Running the query</span>
        <div className="flex h-full items-end gap-2">
          {[40, 62, 48, 80, 58, 72, 50, 66].map((h, i) => (
            <span key={i} className="flex-1 animate-pulse rounded-sm bg-zinc-100 dark:bg-zinc-900" style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    );
  }
  const charts = visual.panels.filter((p) => p.kind !== "table" && p.x && p.series.length > 0);
  // no chart to index the rows: the rows, by their shape, are the tile; a figures tile draws its figures alone
  if (charts.length === 0 && !tile.figures)
    return (
      <div className="-mx-3 max-h-[26rem] overflow-y-auto overscroll-contain">
        <RowsBody columns={snap.columns} rows={snap.rows} names={snap.names} visual={visual} base={base} sym={sym} onOpen={tile.drill ? onDrill : undefined} />
      </div>
    );
  return (
    <QueryVisual
      visual={visual}
      rows={snap.rows}
      names={snap.names}
      sym={sym}
      totals={snap.totals}
      cut={snap.cut}
      canDrill={open && !!onMark}
      onPick={onMark ?? (() => {})}
      base={base}
      titles={visual.panels.length > 1}
      cards={false}
      renderTable={(p) => (
        <PanelRows panel={p} columns={snap.columns} rows={snap.rows} names={snap.names} visual={visual} base={base} sym={sym} onPick={open ? onMark : undefined} onAll={onRows} limit={8} />
      )}
    />
  );
}
