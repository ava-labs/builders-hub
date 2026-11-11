"use client";

/* the row above the stage: the zoom trail, or the window buttons and the hint line; then the SQL and Rows buttons */

import { Braces, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/components/explorer-v2/format";
import type { QueryAnswer } from "@/lib/explorer-query/types";
import type { Selection } from "@/lib/explorer-query/selection";
import { Crumbs, type OpenDrill } from "../QueryZoom";
import { cutLine, rowCount, rowsLabel } from "../query-client";
import type { SpanKey } from "@/lib/explorer-query/window-shift";
import type { Row } from "./sheet";
import { SQL_DRAWER_ID } from "./sql-drawer";
import { WindowButtons } from "./window-buttons";

export function StageBar({
  answer,
  drill,
  sel,
  picked,
  allRows,
  level,
  charted,
  canDrill,
  popZoom,
  setInspect,
  own,
  moving,
  busy,
  onMove,
  onOwn,
  sqlOpen,
  onSql,
}: {
  answer: QueryAnswer;
  drill: OpenDrill | null;
  sel: Selection;
  /** the answer's rows through the selection */
  picked: Row[];
  allRows: Row[];
  /** what the inspector lists: the drilled records, else the picked rows */
  level: { total: number; rows: Row[] };
  charted: boolean;
  canDrill: boolean;
  popZoom: () => void;
  setInspect: (open: boolean) => void;
  /** the window the answer was first given over, when it is none of the buttons' spans */
  own: string | null;
  /** the span a window button is reading now */
  moving: SpanKey | null;
  busy: boolean;
  onMove: (key: SpanKey) => void;
  onOwn: () => void;
  sqlOpen: boolean;
  onSql: (open: boolean) => void;
}) {
  const pill = "flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[11px] tabular-nums transition-colors";
  const off = "bg-zinc-100 text-zinc-700 hover:bg-zinc-200/80 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
      {drill ? (
        <Crumbs items={[{ label: answer.title, onClick: popZoom }, { label: drill.title }]} />
      ) : (
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          {answer.moves && answer.result && <WindowButtons moves={answer.moves} own={own} moving={moving} busy={busy} onMove={onMove} onOwn={onOwn} />}
          <span className="min-w-0 truncate font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
          {sel.length ? `${formatNumber(picked.length)} of ${rowCount(allRows.length)}` : [cutLine(answer), charted ? (canDrill ? "Drag or click to filter. Open a mark with ›." : "Drag or click to filter.") : ""].filter(Boolean).join(" · ")}
          </span>
        </span>
      )}
      <span className="flex items-center gap-1.5">
        {answer.result && !drill && (
          <button type="button" onClick={() => onSql(!sqlOpen)} aria-expanded={sqlOpen} aria-controls={SQL_DRAWER_ID} className={cn(pill, sqlOpen ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900" : off)}>
            <Braces className="h-3.5 w-3.5" />
            SQL
          </button>
        )}
        {level.total > 0 && (
          <button
            type="button"
            onClick={() => setInspect(true)}
            aria-haspopup="dialog"
            aria-keyshortcuts="R"
            className={cn(pill, off)}
          >
            <Rows3 className="h-3.5 w-3.5" />
            Rows ({drill || sel.length || !answer ? formatNumber(level.rows.length) : rowsLabel(answer, level.rows.length)})
            <kbd className="hidden rounded bg-white px-1 text-[10px] text-zinc-400 sm:inline dark:bg-zinc-950 dark:text-zinc-500">R</kbd>
          </button>
        )}
      </span>
    </div>
  );
}
